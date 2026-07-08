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

        // Add environment variable fallback for old controllers
        for ($i = 1; $i <= 3; $i++) {
            $envKeyName = $i === 1 ? 'GEMINI_API_KEY' : "GEMINI_API_KEY_$i";
            $envKey = trim((string) env($envKeyName, ''));
            if ($envKey !== '') {
                $keys[] = $envKey;
            }
        }

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
                $backoffMs = 100;

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

                            $response = Http::withoutVerifying()
                                ->connectTimeout(5)
                                ->timeout(35)
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
}
