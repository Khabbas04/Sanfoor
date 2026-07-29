<?php

namespace App\Services;

use App\Models\ApiKeyUsageLog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Records what each API key spent, on which model.
 *
 * Two stores, because they answer different questions:
 *   - Cache holds the live per-minute and per-day counters. Reading "RPM right
 *     now" from the database would mean a COUNT over the last 60 seconds on every
 *     dashboard refresh.
 *   - The database holds history: tokens, latency, errors, and yesterday.
 *
 * Nothing here may ever break a Gemini call, so every write is wrapped. A missing
 * log row costs a line on a chart; a thrown exception would cost a student their
 * answer.
 */
class GeminiUsageRecorder
{
    /** Live counters are per-minute or per-day; nothing needs to outlive that. */
    private const MINUTE_TTL = 90;

    /**
     * Register one call.
     *
     * @param string $apiKey       the raw key — used only to derive an identifier
     * @param array  $keyList      the configured keys, to resolve the 1-based index
     * @param array{
     *     model: string, request_type: string, latency_ms: int, success: bool,
     *     input_tokens?: int, output_tokens?: int, total_tokens?: int,
     *     error_message?: ?string, error_type?: ?string
     * } $call
     */
    public function record(string $apiKey, array $keyList, array $call): void
    {
        try {
            $model = (string) $call['model'];
            $inputTokens = (int) ($call['input_tokens'] ?? 0);
            $outputTokens = (int) ($call['output_tokens'] ?? 0);
            $totalTokens = (int) ($call['total_tokens'] ?? ($inputTokens + $outputTokens));

            // Live counters first: they are what the dashboard reads for "now", and
            // they must move even if the database write fails.
            $rpm = $this->bumpRequestsPerMinute($apiKey, $model);
            $tpm = $this->bumpTokensPerMinute($apiKey, $model, $totalTokens);
            $rpd = $this->bumpRequestsPerDay($apiKey, $model);

            if (!config('gemini.usage_logging', true)) {
                return;
            }

            ApiKeyUsageLog::create([
                'api_key_id' => $this->keyIndex($apiKey, $keyList),
                'key_fingerprint' => $this->fingerprint($apiKey),
                'model' => $model,
                'request_type' => (string) $call['request_type'],
                'input_tokens' => $inputTokens,
                'output_tokens' => $outputTokens,
                'total_tokens' => $totalTokens,
                'rpm' => $rpm,
                'tpm' => $tpm,
                'rpd' => $rpd,
                'latency_ms' => max(0, (int) ($call['latency_ms'] ?? 0)),
                'success' => (bool) $call['success'],
                'error_message' => $this->sanitiseError($call['error_message'] ?? null),
                'error_type' => $call['error_type'] ?? null,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Gemini usage not recorded: ' . $e->getMessage());
        }
    }

    /* ── live counters ──────────────────────────────────────────────────── */

    /** Requests this key has made on this model in the current minute. */
    public function requestsPerMinute(string $apiKey, string $model): int
    {
        return (int) Cache::get($this->minuteKey('rpm', $apiKey, $model), 0);
    }

    /** Tokens this key has spent on this model in the current minute. */
    public function tokensPerMinute(string $apiKey, string $model): int
    {
        return (int) Cache::get($this->minuteKey('tpm', $apiKey, $model), 0);
    }

    /** Requests this key has made on this model today. */
    public function requestsPerDay(string $apiKey, string $model): int
    {
        return (int) Cache::get($this->dayKey($apiKey, $model), 0);
    }

    private function bumpRequestsPerMinute(string $apiKey, string $model): int
    {
        $key = $this->minuteKey('rpm', $apiKey, $model);
        $value = ((int) Cache::get($key, 0)) + 1;
        Cache::put($key, $value, self::MINUTE_TTL);

        return $value;
    }

    private function bumpTokensPerMinute(string $apiKey, string $model, int $tokens): int
    {
        $key = $this->minuteKey('tpm', $apiKey, $model);
        $value = ((int) Cache::get($key, 0)) + max(0, $tokens);
        Cache::put($key, $value, self::MINUTE_TTL);

        return $value;
    }

    private function bumpRequestsPerDay(string $apiKey, string $model): int
    {
        $key = $this->dayKey($apiKey, $model);
        $value = ((int) Cache::get($key, 0)) + 1;
        Cache::put($key, $value, now()->endOfDay());

        return $value;
    }

    private function minuteKey(string $metric, string $apiKey, string $model): string
    {
        return "gemini_{$metric}_" . $this->fingerprint($apiKey) . '_' . md5($model) . '_' . date('Y-m-d_H-i');
    }

    private function dayKey(string $apiKey, string $model): string
    {
        return 'gemini_rpd_' . $this->fingerprint($apiKey) . '_' . md5($model) . '_' . date('Y-m-d');
    }

    /* ── identity ───────────────────────────────────────────────────────── */

    /**
     * A stable, non-reversible identifier for a key.
     *
     * The key itself never reaches storage: not the database, not the cache key,
     * not a log line.
     */
    public function fingerprint(string $apiKey): string
    {
        return substr(hash('sha256', $apiKey), 0, 16);
    }

    /** 1-based position in the configured list — "Key #3" in the UI. */
    public function keyIndex(string $apiKey, array $keyList): int
    {
        $position = array_search($apiKey, $keyList, true);

        return $position === false ? 0 : $position + 1;
    }

    /**
     * Make an error safe to store.
     *
     * Gemini request URLs carry the key as a query parameter, so any message that
     * might have been built from a URL has everything after `key=` removed before
     * it can be written down.
     */
    private function sanitiseError(?string $message): ?string
    {
        if ($message === null || trim($message) === '') {
            return null;
        }

        $clean = preg_replace('/key=[^\s&"\']+/i', 'key=[redacted]', $message);
        // Belt and braces: strip anything that still looks like a Google API key.
        $clean = preg_replace('/AIza[0-9A-Za-z_\-]{10,}/', '[redacted]', $clean);

        return mb_substr(trim($clean), 0, 255, 'UTF-8');
    }
}
