<?php

namespace App\Services;

use App\Models\AiRequestLog;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Writes the operational record of an advisor request.
 *
 * Every method swallows its own failures: observability is worth having, but never
 * at the cost of the student's answer. A dropped log line is an inconvenience; a
 * 500 because the log table is missing is not acceptable.
 */
class AiRequestLogger
{
    /**
     * Run a logging call so that nothing it does can reach the caller.
     *
     * The methods below already guard their own writes, but this also contains a
     * failure in the logger itself (a bad binding, a fatal in a future edit).
     * Logging is never worth an error page.
     */
    public static function safely(callable $log): void
    {
        try {
            $log();
        } catch (\Throwable $e) {
            Log::warning('AI logging skipped: ' . $e->getMessage());
        }
    }

    public function enabled(): bool
    {
        return (bool) config('ai.features.observability', true);
    }

    /**
     * @param array{
     *     chat_id?: ?int, intent?: ?array, confidence?: ?array, validation?: ?array,
     *     tools_called?: array, fallback_used?: bool, fallback_reason?: ?string,
     *     was_cached?: bool, response_time_ms?: ?int, time_to_first_token_ms?: ?int,
     *     provider_error_type?: ?string
     * } $context
     */
    public function logRequest(?User $user, string $route, array $context = []): void
    {
        if (!$this->enabled()) {
            return;
        }

        try {
            $intent = $context['intent'] ?? null;
            $confidence = $context['confidence'] ?? null;
            $validation = $context['validation'] ?? null;

            AiRequestLog::create([
                'user_id' => $user?->id,
                'chat_id' => $context['chat_id'] ?? null,
                'route_used' => $route,
                'intent' => $intent['intent'] ?? null,
                'intent_confidence' => isset($intent['confidence']) ? (float) $intent['confidence'] : null,
                'answer_confidence' => isset($confidence['score']) ? (float) $confidence['score'] : null,
                'confidence_level' => $confidence['level'] ?? null,
                'tools_called' => $context['tools_called'] ?? [],
                'dropped_ids' => (int) ($validation['dropped_ids'] ?? 0),
                'validation_failed' => isset($validation['valid']) ? !$validation['valid'] : false,
                'fallback_used' => (bool) ($context['fallback_used'] ?? false),
                'fallback_reason' => $context['fallback_reason'] ?? null,
                'was_cached' => (bool) ($context['was_cached'] ?? false),
                'response_time_ms' => $context['response_time_ms'] ?? null,
                'time_to_first_token_ms' => $context['time_to_first_token_ms'] ?? null,
                'provider_error_type' => $context['provider_error_type'] ?? null,
                'prompt_version' => (string) config('ai.prompt_version'),
            ]);
        } catch (\Throwable $e) {
            Log::warning('AI request log skipped: ' . $e->getMessage());
        }
    }

    public function logAction(?User $user, string $action, bool $ok): void
    {
        if (!$this->enabled()) {
            return;
        }

        try {
            AiRequestLog::create([
                'user_id' => $user?->id,
                'route_used' => 'action',
                'action_name' => $action,
                'action_result' => $ok ? 'success' : 'error',
                'prompt_version' => (string) config('ai.prompt_version'),
            ]);
        } catch (\Throwable $e) {
            Log::warning('AI action log skipped: ' . $e->getMessage());
        }
    }

    public function logFeedbackReason(?User $user, ?string $reason): void
    {
        if (!$this->enabled() || $reason === null) {
            return;
        }

        try {
            AiRequestLog::create([
                'user_id' => $user?->id,
                'route_used' => 'feedback',
                'feedback_reason' => $reason,
                'prompt_version' => (string) config('ai.prompt_version'),
            ]);
        } catch (\Throwable $e) {
            Log::warning('AI feedback log skipped: ' . $e->getMessage());
        }
    }
}
