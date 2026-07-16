<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiService
{
    private const RPM_LIMIT = 14;

    public string $workingApiKey = '';

    public function getApiKeys(): array
    {
        $keys = [];
        $csv = (string) config('services.gemini.keys', '');

        foreach (explode(',', $csv) as $key) {
            $value = trim($key);
            if ($value !== '') {
                $keys[] = $value;
            }
        }

        $single = trim((string) config('services.gemini.key', ''));
        if ($single !== '') {
            $keys[] = $single;
        }

        // NOTE: keys are read from config only (services.gemini.*), never env() directly,
        // so the service keeps working after `php artisan config:cache` in production.
        // For multiple keys use the comma-separated GEMINI_API_KEYS env var.

        return array_values(array_unique($keys));
    }

    public function getKeyRpm(string $apiKey): int
    {
        $minute = date('Y-m-d_H-i');
        return (int) Cache::get('gemini_rpm_' . md5($apiKey) . '_' . $minute, 0);
    }

    private function incrementKeyRpm(string $apiKey): void
    {
        $minute = date('Y-m-d_H-i');
        $cacheKey = 'gemini_rpm_' . md5($apiKey) . '_' . $minute;
        $current = (int) Cache::get($cacheKey, 0);
        Cache::put($cacheKey, $current + 1, now()->addSeconds(90));
    }

    public function getKeyCooldownRemaining(string $apiKey): int
    {
        $until = Cache::get('gemini_cooldown_' . md5($apiKey));
        if (!$until) return 0;
        $remaining = $until - time();
        return max(0, $remaining);
    }

    private function setCooldown(string $apiKey, int $seconds, string $reason = ''): void
    {
        $until = time() + $seconds;
        Cache::put('gemini_cooldown_' . md5($apiKey), $until, now()->addSeconds($seconds + 5));
        Cache::put('gemini_cooldown_reason_' . md5($apiKey), $reason, now()->addSeconds($seconds + 5));
        Log::debug("Gemini key cooldown set: " . substr($apiKey, 0, 8) . "... for {$seconds}s reason: {$reason}");
    }

    private function sortKeysByAvailability(array $apiKeys): array
    {
        $scored = [];
        foreach ($apiKeys as $key) {
            $cooldown = $this->getKeyCooldownRemaining($key);
            $rpm = $this->getKeyRpm($key);
            $scored[] = [
                'key' => $key,
                'cooldown' => $cooldown,
                'rpm' => $rpm,
                'available' => $cooldown === 0 && $rpm < self::RPM_LIMIT,
            ];
        }

        usort($scored, function ($a, $b) {
            if ($a['available'] !== $b['available']) {
                return $b['available'] <=> $a['available'];
            }
            if ($a['cooldown'] !== $b['cooldown']) {
                return $a['cooldown'] <=> $b['cooldown'];
            }
            return $a['rpm'] <=> $b['rpm'];
        });

        return array_column($scored, 'key');
    }

    public function callGeminiAPI(array $contents, array $options = [], array $apiKeys = null): string
    {
        if ($apiKeys === null) {
            $apiKeys = $this->getApiKeys();
        }

        if (empty($apiKeys)) {
            throw new \Exception('No Gemini API keys configured');
        }

        $model = trim((string) config('services.gemini.model')) ?: 'gemini-2.5-flash-lite';
        $sortedKeys = $this->sortKeysByAvailability($apiKeys);
        $lastError = 'Unknown Gemini error';

        foreach ($sortedKeys as $apiKey) {
            $keyIndex = array_search($apiKey, $apiKeys, true);

            $cooldown = $this->getKeyCooldownRemaining($apiKey);
            if ($cooldown > 0) {
                $lastError = "key#" . ($keyIndex + 1) . ": in cooldown ({$cooldown}s remaining)";
                continue;
            }

            $rpm = $this->getKeyRpm($apiKey);
            if ($rpm >= self::RPM_LIMIT) {
                $lastError = "key#" . ($keyIndex + 1) . ": RPM limit reached ({$rpm}/" . self::RPM_LIMIT . ")";
                continue;
            }

            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

            try {
                $requestContents = $contents;
                $fullText = '';
                $backoffMs = 120;

                for ($pass = 0; $pass <= 2; $pass++) {
                    for ($retryCount = 0; $retryCount < 2; $retryCount++) {
                        try {
                            $payload = [
                                'contents' => $requestContents,
                                'generationConfig' => array_merge([
                                    'responseMimeType' => 'application/json',
                                    'temperature' => 0.3,
                                ], $options['generationConfig'] ?? []),
                            ];

                            if (isset($options['systemInstruction'])) {
                                $payload['systemInstruction'] = $options['systemInstruction'];
                            }
                            if (isset($options['tools'])) {
                                $payload['tools'] = $options['tools'];
                            }

                            $response = Http::withoutVerifying()
                                ->connectTimeout(3)
                                ->timeout((int) ($options['timeout'] ?? 24))
                                ->withHeaders(['Content-Type' => 'application/json'])
                                ->post($url, $payload);

                            $status = $response->status();

                            if ($status === 429) {
                                $this->setCooldown($apiKey, 60, 'rate_limited_429');
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP 429 (rate limited, cooldown 60s)";
                                continue 3;
                            }

                            if (in_array($status, [401, 403])) {
                                $this->setCooldown($apiKey, 600, 'invalid_key_' . $status);
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP {$status} (invalid/blocked, cooldown 10min)";
                                continue 3;
                            }

                            if ($status === 400) {
                                $this->setCooldown($apiKey, 120, 'bad_request_400');
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP 400 (bad request, cooldown 2min)";
                                continue 3;
                            }

                            if ($status === 503) {
                                if ($retryCount < 1) {
                                    usleep($backoffMs * 1000);
                                    $backoffMs *= 2;
                                    continue;
                                }
                                $this->setCooldown($apiKey, 30, 'server_overloaded_503');
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP 503 (overloaded, cooldown 30s)";
                                continue 3;
                            }

                            if (!$response->successful()) {
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP {$status}";
                                continue 3;
                            }

                            break;
                        } catch (\Exception $e) {
                            if ($retryCount < 1) {
                                usleep($backoffMs * 1000);
                                $backoffMs *= 2;
                                continue;
                            }
                            throw $e;
                        }
                    }

                    $this->incrementKeyRpm($apiKey);

                    $candidate = $response->json('candidates.0');
                    
                    if (isset($candidate['content']['parts'][0]['functionCall'])) {
                        return json_encode([
                            'functionCall' => $candidate['content']['parts'][0]['functionCall']
                        ]);
                    }

                    $chunk = $candidate['content']['parts'][0]['text'] ?? null;

                    if (!is_string($chunk) || trim($chunk) === '') {
                        $lastError = "key#" . ($keyIndex + 1) . ": empty candidate text";
                        continue 2;
                    }

                    $fullText .= $chunk;

                    $finishReason = strtoupper((string) ($candidate['finishReason'] ?? ''));
                    $stopped = in_array($finishReason, ['MAX_TOKENS', 'LENGTH', 'FINISH_REASON_MAX_TOKENS'], true);
                    if (!$stopped || $pass >= 2) {
                        $this->workingApiKey = $apiKey;
                        $dailyKey = 'gemini_key_usage_' . md5($apiKey) . '_' . date('Y-m-d');
                        Cache::put($dailyKey, (int) Cache::get($dailyKey, 0) + 1, now()->endOfDay());
                        return $fullText;
                    }

                    $requestContents[] = ['role' => 'model', 'parts' => [['text' => $chunk]]];
                    $requestContents[] = ['role' => 'user', 'parts' => [['text' => 'أكمل من آخر نقطة بدون تكرار.']]];
                }

                if ($fullText !== '') {
                    $this->workingApiKey = $apiKey;
                    $dailyKey = 'gemini_key_usage_' . md5($apiKey) . '_' . date('Y-m-d');
                    Cache::put($dailyKey, (int) Cache::get($dailyKey, 0) + 1, now()->endOfDay());
                    return $fullText;
                }
            } catch (\Throwable $e) {
                $lastError = "key#" . ($keyIndex + 1) . ": {$e->getMessage()}";
            }
        }

        throw new \Exception("Gemini API failed across all keys. Last error: {$lastError}");
    }

    /**
     * Generate an embedding vector for the given text.
     *
     * Uses the same multi-key rotation, cooldown and RPM accounting as chat calls,
     * so a rate-limited key no longer silently disables the whole RAG feature.
     * Returns null (and logs a warning) only when every key fails.
     */
    public function embedContent(string $text, array $apiKeys = null): ?array
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }

        if ($apiKeys === null) {
            $apiKeys = $this->getApiKeys();
        }
        if (empty($apiKeys)) {
            Log::warning('Gemini embedContent skipped: no API keys configured');
            return null;
        }

        $model = trim((string) config('services.gemini.embedding_model')) ?: 'gemini-embedding-2';
        $sortedKeys = $this->sortKeysByAvailability($apiKeys);
        $lastError = 'unknown';

        foreach ($sortedKeys as $apiKey) {
            if ($this->getKeyCooldownRemaining($apiKey) > 0) {
                $lastError = 'key in cooldown';
                continue;
            }
            if ($this->getKeyRpm($apiKey) >= self::RPM_LIMIT) {
                $lastError = 'key RPM limit reached';
                continue;
            }

            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:embedContent?key={$apiKey}";

            try {
                $response = Http::withoutVerifying()
                    ->connectTimeout(3)
                    ->timeout(8)
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post($url, [
                        'model' => "models/{$model}",
                        'content' => ['parts' => [['text' => $text]]],
                    ]);

                $status = $response->status();

                if ($status === 429) {
                    $this->setCooldown($apiKey, 60, 'embed_rate_limited_429');
                    $lastError = 'HTTP 429';
                    continue;
                }
                if (in_array($status, [401, 403], true)) {
                    $this->setCooldown($apiKey, 600, 'embed_invalid_key_' . $status);
                    $lastError = "HTTP {$status}";
                    continue;
                }
                if (!$response->successful()) {
                    $lastError = "HTTP {$status}";
                    continue;
                }

                $this->incrementKeyRpm($apiKey);
                $values = $response->json('embedding.values');
                if (is_array($values) && !empty($values)) {
                    $this->workingApiKey = $apiKey;
                    return $values;
                }
                $lastError = 'empty embedding payload';
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
            }
        }

        Log::warning("Gemini embedContent failed across all keys. Last error: {$lastError}");
        return null;
    }

    public function parseJsonResponse(string $rawText): array
    {
        // Only strip the outer markdown formatting if the entire response is wrapped in it.
        $clean = preg_replace('/^```(?:json)?\s*(.*?)\s*```$/is', '$1', trim($rawText));

        $decoded = json_decode($clean, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }

        $jsonFragment = $this->extractJsonObject($clean);
        if ($jsonFragment !== null) {
            $decodedFragment = json_decode($jsonFragment, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedFragment)) {
                return $decodedFragment;
            }
        }

        // Final fallback: try to clean escaping issues
        $cleanedText = str_replace("\n", "\\n", $clean);
        $cleanedText = str_replace("\r", "", $cleanedText);
        $cleanedText = preg_replace('/[\x00-\x1F]/', '', $cleanedText);
        $decoded = json_decode($cleanedText, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }

        return [
            'reply' => $this->stripReplyEnvelope($clean) ?: 'حدث خطأ في فهم الرد.',
            'error_parsing' => true,
        ];
    }

    private function extractJsonObject(string $text): ?string
    {
        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        return substr($text, $start, ($end - $start + 1));
    }

    public function stripReplyEnvelope(string $text): string
    {
        $value = trim($text);

        $decoded = json_decode($value, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && isset($decoded['reply'])) {
            return trim((string) $decoded['reply']);
        }

        $value = preg_replace('/```(?:json)?/is', '', $value);
        $value = preg_replace('/^\s*[\{\[]+\s*/u', '', $value);
        $value = preg_replace('/[,\[\]{}]?\s*["\']?(suggested_courses|suggested_course_ids|courses_to_remove|remove_course_ids|follow_up_suggestions|interactive_widget|proposed_schedule)["\']?\s*[:=].*/isu', '', $value);

        if (preg_match('/^\s*["\']?reply["\']?\s*:\s*["\']?(.*)$/isu', $value, $matches)) {
            $value = $matches[1];
        }

        $value = preg_replace('/\s*[\}\]]+\s*$/u', '', $value);
        $value = preg_replace('/[,\[\]{}"\':\s]+$/u', '', $value);

        return trim($value, " \t\n\r\0\x0B\"'");
    }
}
