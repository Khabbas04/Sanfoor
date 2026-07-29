<?php

namespace App\Services;

use App\Models\ApiKeyUsageLog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Everything the Gemini monitoring dashboard reads.
 *
 * Grouped by key AND by model throughout, because a per-key total hides the fact
 * that matters operationally: a key can be comfortable on its chat quota while
 * already exhausted on embeddings, and only the pair tells you that.
 *
 * Quotas are per key (config/gemini.php); the account-wide ceiling is derived as
 * per-key × configured keys, which is how rotation actually behaves — add a key
 * and the ceiling rises on its own instead of drifting from a hardcoded total.
 */
class GeminiUsageAnalytics
{
    public function __construct(
        private GeminiService $gemini,
        private GeminiUsageRecorder $recorder,
    ) {}

    /**
     * The whole dashboard payload.
     *
     * @param array{model?: ?string, api_key_id?: ?int, status?: ?string, days?: int, only_active?: bool, near_limit?: bool} $filters
     */
    public function dashboard(array $filters = []): array
    {
        $days = max(1, min(90, (int) ($filters['days'] ?? 7)));
        $keys = $this->gemini->getApiKeys();
        $models = $this->modelsInPlay();

        $keyRows = $this->keys($keys, $models, $filters);
        $modelRows = $this->models($keys, $models, $filters['model'] ?? null);

        return [
            'logging_enabled' => (bool) config('gemini.usage_logging', true),
            'has_history' => $this->hasHistoryTable(),
            'generated_at' => now()->toISOString(),
            'thresholds' => config('gemini.thresholds'),
            'filters' => [
                'days' => $days,
                'model' => $filters['model'] ?? null,
                'api_key_id' => $filters['api_key_id'] ?? null,
                'status' => $filters['status'] ?? null,
                'only_active' => (bool) ($filters['only_active'] ?? false),
                'near_limit' => (bool) ($filters['near_limit'] ?? false),
            ],
            'available_models' => array_map(fn ($model) => [
                'id' => $model,
                'label' => $this->modelLabel($model),
            ], $models),
            'overview' => $this->overview($keyRows, $modelRows, $days),
            'health' => $this->health($keyRows, $modelRows, $days),
            'models' => $modelRows,
            'keys' => $keyRows,
            'charts' => $this->charts($days, $filters),
        ];
    }

    /* ── overview ───────────────────────────────────────────────────────── */

    private function overview(array $keyRows, array $modelRows, int $days): array
    {
        $counts = ['active' => 0, 'resting' => 0, 'invalid' => 0, 'near_limit' => 0];

        foreach ($keyRows as $key) {
            $counts[$key['status'] === 'invalid' ? 'invalid' : ($key['status'] === 'active' ? 'active' : 'resting')]++;
            if ($key['near_limit']) {
                $counts['near_limit']++;
            }
        }

        $history = $this->historyTotals($days);

        return [
            'total_keys' => count($keyRows),
            'active_keys' => $counts['active'],
            'resting_keys' => $counts['resting'],
            'invalid_keys' => $counts['invalid'],
            'keys_near_limit' => $counts['near_limit'],
            'models_in_use' => count($modelRows),
            'requests_today' => $history['today'],
            'requests_week' => $history['week'],
            'requests_month' => $history['month'],
            'failed_requests_today' => $history['failed_today'],
            'tokens_today' => $history['tokens_today'],
            'avg_response_ms' => $history['avg_latency'],
            'total_conversations' => $this->conversationCount(),
        ];
    }

    private function conversationCount(): int
    {
        return (int) Cache::remember('gemini_monitor_chat_count', 120, function () {
            return Schema::hasTable('chats') ? DB::table('chats')->count() : 0;
        });
    }

    private function historyTotals(int $days): array
    {
        $empty = ['today' => 0, 'week' => 0, 'month' => 0, 'failed_today' => 0, 'tokens_today' => 0, 'avg_latency' => 0];

        if (!$this->hasHistoryTable()) {
            return $empty;
        }

        $today = ApiKeyUsageLog::whereDate('created_at', today())
            ->selectRaw('COUNT(*) as requests')
            ->selectRaw('SUM(CASE WHEN success = 0 OR success = false THEN 1 ELSE 0 END) as failed')
            ->selectRaw('SUM(total_tokens) as tokens')
            ->selectRaw('AVG(CASE WHEN success = 1 OR success = true THEN latency_ms END) as avg_latency')
            ->first();

        return [
            'today' => (int) ($today->requests ?? 0),
            'week' => (int) ApiKeyUsageLog::where('created_at', '>=', now()->subDays(7))->count(),
            'month' => (int) ApiKeyUsageLog::where('created_at', '>=', now()->subDays(30))->count(),
            'failed_today' => (int) ($today->failed ?? 0),
            'tokens_today' => (int) ($today->tokens ?? 0),
            'avg_latency' => (int) round((float) ($today->avg_latency ?? 0)),
        ];
    }

    /* ── per model ──────────────────────────────────────────────────────── */

    /**
     * One row per model, with the account-wide quota picture.
     *
     * @param list<string> $keys
     * @param list<string> $models
     */
    private function models(array $keys, array $models, ?string $onlyModel = null): array
    {
        $rows = [];
        $keyCount = max(1, count($keys));

        foreach ($models as $model) {
            if ($onlyModel !== null && $model !== $onlyModel) {
                continue;
            }

            $limits = $this->limitsFor($model);
            $live = ['rpm' => 0, 'tpm' => 0, 'rpd' => 0, 'active_keys' => 0];

            foreach ($keys as $key) {
                $rpm = $this->recorder->requestsPerMinute($key, $model);
                $live['rpm'] += $rpm;
                $live['tpm'] += $this->recorder->tokensPerMinute($key, $model);
                $live['rpd'] += $this->recorder->requestsPerDay($key, $model);

                if ($rpm > 0 && $this->gemini->getKeyCooldownRemaining($key) === 0) {
                    $live['active_keys']++;
                }
            }

            $today = $this->modelTodayStats($model);

            $rows[] = [
                'id' => $model,
                'label' => $this->modelLabel($model),
                'kind' => $limits['kind'],
                'active_keys' => $live['active_keys'],
                'configured_keys' => count($keys),
                // Account-wide ceiling = per-key limit × keys, because rotation
                // spreads load across every key.
                'quotas' => [
                    'rpm' => $this->quota($live['rpm'], $limits['rpm'] * $keyCount),
                    'tpm' => $this->quota($live['tpm'], $limits['tpm'] * $keyCount),
                    'rpd' => $this->quota($live['rpd'], $limits['rpd'] * $keyCount),
                ],
                'per_key_limits' => ['rpm' => $limits['rpm'], 'tpm' => $limits['tpm'], 'rpd' => $limits['rpd']],
                'requests_today' => $today['requests'],
                'tokens_today' => $today['tokens'],
                'input_tokens_today' => $today['input_tokens'],
                'output_tokens_today' => $today['output_tokens'],
                'success_rate' => $today['success_rate'],
                'error_rate' => $today['error_rate'],
                'avg_response_ms' => $today['avg_latency'],
                'never_used' => $today['requests'] === 0 && $live['rpd'] === 0,
            ];
        }

        return $rows;
    }

    private function modelTodayStats(string $model): array
    {
        $empty = [
            'requests' => 0, 'tokens' => 0, 'input_tokens' => 0, 'output_tokens' => 0,
            'success_rate' => null, 'error_rate' => null, 'avg_latency' => 0,
        ];

        if (!$this->hasHistoryTable()) {
            return $empty;
        }

        $row = ApiKeyUsageLog::where('model', $model)
            ->whereDate('created_at', today())
            ->selectRaw('COUNT(*) as requests')
            ->selectRaw('SUM(total_tokens) as tokens')
            ->selectRaw('SUM(input_tokens) as input_tokens')
            ->selectRaw('SUM(output_tokens) as output_tokens')
            ->selectRaw('SUM(CASE WHEN success = 1 OR success = true THEN 1 ELSE 0 END) as ok')
            ->selectRaw('AVG(CASE WHEN success = 1 OR success = true THEN latency_ms END) as avg_latency')
            ->first();

        $requests = (int) ($row->requests ?? 0);
        if ($requests === 0) {
            return $empty;
        }

        $ok = (int) ($row->ok ?? 0);

        return [
            'requests' => $requests,
            'tokens' => (int) ($row->tokens ?? 0),
            'input_tokens' => (int) ($row->input_tokens ?? 0),
            'output_tokens' => (int) ($row->output_tokens ?? 0),
            'success_rate' => round(($ok / $requests) * 100, 1),
            'error_rate' => round((($requests - $ok) / $requests) * 100, 1),
            'avg_latency' => (int) round((float) ($row->avg_latency ?? 0)),
        ];
    }

    /* ── per key ────────────────────────────────────────────────────────── */

    /**
     * One row per key, each carrying a breakdown per model.
     *
     * @param list<string> $keys
     * @param list<string> $models
     */
    private function keys(array $keys, array $models, array $filters): array
    {
        $rows = [];

        foreach ($keys as $index => $key) {
            $number = $index + 1;
            $fingerprint = $this->recorder->fingerprint($key);
            $cooldown = $this->gemini->getKeyCooldownRemaining($key);
            $reason = (string) Cache::get('gemini_cooldown_reason_' . md5($key), '');
            $legacyRpm = $this->gemini->getKeyRpm($key);

            $perModel = [];
            $worstUsage = 0.0;
            $busiestModel = null;
            $busiestRpm = -1;

            foreach ($models as $model) {
                $limits = $this->limitsFor($model);
                $rpm = $this->recorder->requestsPerMinute($key, $model);
                $tpm = $this->recorder->tokensPerMinute($key, $model);
                $rpd = $this->recorder->requestsPerDay($key, $model);
                $history = $this->keyModelHistory($fingerprint, $model);

                $quotas = [
                    'rpm' => $this->quota($rpm, $limits['rpm']),
                    'tpm' => $this->quota($tpm, $limits['tpm']),
                    'rpd' => $this->quota($rpd, $limits['rpd']),
                ];

                $worstUsage = max($worstUsage, $quotas['rpm']['percent'], $quotas['tpm']['percent'], $quotas['rpd']['percent']);

                if ($rpm > $busiestRpm) {
                    $busiestRpm = $rpm;
                    $busiestModel = $model;
                }

                $perModel[] = array_merge([
                    'id' => $model,
                    'label' => $this->modelLabel($model),
                    'quotas' => $quotas,
                    // "Never used" is a different fact from "used zero times today",
                    // and showing zeros for both hides which keys are actually idle.
                    'never_used' => $rpd === 0 && $history['lifetime'] === 0,
                    'status' => $this->modelHealthLabel($quotas, $history),
                ], $history);
            }

            $status = $this->keyStatus($cooldown, $reason, $legacyRpm);

            $row = [
                'index' => $number,
                'fingerprint' => $fingerprint,
                'masked_key' => substr($key, 0, 8) . '…' . substr($key, -4),
                'status' => $status['status'],
                'status_message' => $status['message'],
                'cooldown_remaining' => $cooldown,
                'cooldown_reason' => $reason,
                'current_model' => $busiestRpm > 0 ? $this->modelLabel((string) $busiestModel) : null,
                'peak_quota_percent' => round($worstUsage, 1),
                'near_limit' => $worstUsage >= (float) config('gemini.thresholds.high', 85),
                'models' => $perModel,
                'history' => $this->keyHistory($fingerprint),
            ];

            if (!$this->passesFilters($row, $filters)) {
                continue;
            }

            $rows[] = $row;
        }

        return $rows;
    }

    /** Lifetime/period counters for one key on one model. */
    private function keyModelHistory(string $fingerprint, string $model): array
    {
        if (!$this->hasHistoryTable()) {
            return ['requests_today' => 0, 'requests_week' => 0, 'requests_month' => 0, 'lifetime' => 0, 'tokens_today' => 0, 'avg_latency' => 0, 'error_rate' => null];
        }

        return Cache::remember("gemini_km_{$fingerprint}_" . md5($model) . '_' . date('Y-m-d-H-i'), 60, function () use ($fingerprint, $model) {
            $base = ApiKeyUsageLog::where('key_fingerprint', $fingerprint)->where('model', $model);

            $today = (clone $base)->whereDate('created_at', today())
                ->selectRaw('COUNT(*) as requests')
                ->selectRaw('SUM(total_tokens) as tokens')
                ->selectRaw('SUM(CASE WHEN success = 1 OR success = true THEN 1 ELSE 0 END) as ok')
                ->selectRaw('AVG(CASE WHEN success = 1 OR success = true THEN latency_ms END) as avg_latency')
                ->first();

            $requests = (int) ($today->requests ?? 0);

            return [
                'requests_today' => $requests,
                'requests_week' => (int) (clone $base)->where('created_at', '>=', now()->subDays(7))->count(),
                'requests_month' => (int) (clone $base)->where('created_at', '>=', now()->subDays(30))->count(),
                'lifetime' => (int) (clone $base)->count(),
                'tokens_today' => (int) ($today->tokens ?? 0),
                'avg_latency' => (int) round((float) ($today->avg_latency ?? 0)),
                'error_rate' => $requests === 0
                    ? null
                    : round((($requests - (int) ($today->ok ?? 0)) / $requests) * 100, 1),
            ];
        });
    }

    /** Key-level history and the operational facts an admin asks for first. */
    private function keyHistory(string $fingerprint): array
    {
        $empty = [
            'requests_today' => 0, 'requests_week' => 0, 'requests_month' => 0, 'lifetime' => 0,
            'tokens_lifetime' => 0, 'last_used_at' => null, 'last_error' => null,
            'last_error_at' => null, 'last_success_at' => null,
        ];

        if (!$this->hasHistoryTable()) {
            return $empty;
        }

        return Cache::remember("gemini_kh_{$fingerprint}_" . date('Y-m-d-H-i'), 60, function () use ($fingerprint, $empty) {
            $base = ApiKeyUsageLog::where('key_fingerprint', $fingerprint);

            $lastError = (clone $base)->where('success', false)->latest('id')->first();
            $lastSuccess = (clone $base)->where('success', true)->latest('id')->first();
            $last = (clone $base)->latest('id')->first();

            return array_merge($empty, [
                'requests_today' => (int) (clone $base)->whereDate('created_at', today())->count(),
                'requests_week' => (int) (clone $base)->where('created_at', '>=', now()->subDays(7))->count(),
                'requests_month' => (int) (clone $base)->where('created_at', '>=', now()->subDays(30))->count(),
                'lifetime' => (int) (clone $base)->count(),
                'tokens_lifetime' => (int) (clone $base)->sum('total_tokens'),
                'last_used_at' => $last?->created_at?->toISOString(),
                'last_success_at' => $lastSuccess?->created_at?->toISOString(),
                'last_error' => $lastError === null ? null : [
                    'message' => $lastError->error_message,
                    'type' => $lastError->error_type,
                    'model' => $lastError->model,
                ],
                'last_error_at' => $lastError?->created_at?->toISOString(),
            ]);
        });
    }

    private function keyStatus(int $cooldown, string $reason, int $legacyRpm): array
    {
        if ($cooldown > 0) {
            if (str_contains($reason, 'invalid_key')) {
                return ['status' => 'invalid', 'message' => 'مفتاح غير صالح أو موقوف'];
            }
            if (str_contains($reason, 'rate_limited')) {
                return ['status' => 'cooldown', 'message' => "تجاوز الحد — يعود بعد {$cooldown} ثانية"];
            }
            if (str_contains($reason, 'overloaded')) {
                return ['status' => 'cooldown', 'message' => "ضغط على سيرفرات جوجل — يعود بعد {$cooldown} ثانية"];
            }

            return ['status' => 'cooldown', 'message' => "في استراحة — {$cooldown} ثانية"];
        }

        if ($legacyRpm >= 14) {
            return ['status' => 'rpm_full', 'message' => 'وصل حد الدقيقة — يتجدد تلقائياً'];
        }

        return ['status' => 'active', 'message' => 'يعمل بشكل طبيعي'];
    }

    private function modelHealthLabel(array $quotas, array $history): string
    {
        $peak = max($quotas['rpm']['percent'], $quotas['tpm']['percent'], $quotas['rpd']['percent']);
        $critical = (float) config('gemini.thresholds.critical', 95);
        $high = (float) config('gemini.thresholds.high', 85);

        if ($peak >= $critical) {
            return 'exhausted';
        }
        if ($peak >= $high || (($history['error_rate'] ?? 0) > 20)) {
            return 'strained';
        }

        return 'healthy';
    }

    /* ── charts ─────────────────────────────────────────────────────────── */

    private function charts(int $days, array $filters): array
    {
        if (!$this->hasHistoryTable()) {
            return ['hourly' => [], 'daily' => [], 'tokens_daily' => [], 'latency_daily' => [], 'errors_daily' => [], 'by_model' => [], 'by_key' => []];
        }

        $scoped = function () use ($filters) {
            $query = ApiKeyUsageLog::query();
            if (!empty($filters['model'])) {
                $query->where('model', $filters['model']);
            }
            if (!empty($filters['api_key_id'])) {
                $query->where('api_key_id', (int) $filters['api_key_id']);
            }

            return $query;
        };

        return [
            'hourly' => $this->hourlySeries($scoped()),
            'daily' => $this->dailySeries($scoped(), $days),
            'tokens_daily' => $this->dailyTokenSeries($scoped(), $days),
            'latency_daily' => $this->dailyLatencySeries($scoped(), $days),
            'errors_daily' => $this->dailyErrorSeries($scoped(), $days),
            'by_model' => $this->distribution($scoped(), 'model', $days),
            'by_key' => $this->distribution($scoped(), 'api_key_id', $days),
        ];
    }

    /** Requests per hour over the last 24 hours, gaps filled with zeros. */
    private function hourlySeries($query): array
    {
        $rows = $query->where('created_at', '>=', now()->subDay())
            ->get(['created_at', 'success'])
            ->groupBy(fn ($row) => $row->created_at->format('Y-m-d H'));

        $series = [];
        for ($hour = 23; $hour >= 0; $hour--) {
            $moment = now()->subHours($hour);
            $bucket = $rows->get($moment->format('Y-m-d H'), collect());

            $series[] = [
                'label' => $moment->format('H:00'),
                'requests' => $bucket->count(),
                'errors' => $bucket->where('success', false)->count(),
            ];
        }

        return $series;
    }

    private function dailySeries($query, int $days): array
    {
        return $this->dailyBuckets($query, $days, fn ($bucket) => [
            'requests' => $bucket->count(),
            'errors' => $bucket->where('success', false)->count(),
        ]);
    }

    private function dailyTokenSeries($query, int $days): array
    {
        return $this->dailyBuckets($query, $days, fn ($bucket) => [
            'input_tokens' => (int) $bucket->sum('input_tokens'),
            'output_tokens' => (int) $bucket->sum('output_tokens'),
            'total_tokens' => (int) $bucket->sum('total_tokens'),
        ]);
    }

    private function dailyLatencySeries($query, int $days): array
    {
        return $this->dailyBuckets($query, $days, function ($bucket) {
            $ok = $bucket->where('success', true);

            return [
                'avg_ms' => $ok->isEmpty() ? 0 : (int) round($ok->avg('latency_ms')),
                'max_ms' => (int) ($ok->max('latency_ms') ?? 0),
            ];
        });
    }

    private function dailyErrorSeries($query, int $days): array
    {
        return $this->dailyBuckets($query, $days, function ($bucket) {
            $total = $bucket->count();
            $errors = $bucket->where('success', false)->count();

            return [
                'errors' => $errors,
                'error_rate' => $total === 0 ? 0 : round(($errors / $total) * 100, 1),
            ];
        });
    }

    /**
     * Group rows into one bucket per day, including days with no traffic.
     *
     * The empty days matter: a gap read as "no data" looks the same as a gap read
     * as "the service was down", and only an explicit zero distinguishes them.
     */
    private function dailyBuckets($query, int $days, callable $summarise): array
    {
        $rows = $query->where('created_at', '>=', now()->subDays($days)->startOfDay())
            ->get(['created_at', 'success', 'latency_ms', 'input_tokens', 'output_tokens', 'total_tokens'])
            ->groupBy(fn ($row) => $row->created_at->format('Y-m-d'));

        $series = [];
        for ($day = $days - 1; $day >= 0; $day--) {
            $date = now()->subDays($day);
            $bucket = $rows->get($date->format('Y-m-d'), collect());

            $series[] = array_merge(
                ['label' => $date->format('m-d'), 'date' => $date->format('Y-m-d')],
                $summarise($bucket)
            );
        }

        return $series;
    }

    private function distribution($query, string $column, int $days): array
    {
        $rows = $query->where('created_at', '>=', now()->subDays($days)->startOfDay())
            ->select($column, DB::raw('COUNT(*) as requests'), DB::raw('SUM(total_tokens) as tokens'))
            ->groupBy($column)
            ->orderByDesc('requests')
            ->get();

        return $rows->map(fn ($row) => [
            'key' => (string) $row->{$column},
            'label' => $column === 'model' ? $this->modelLabel((string) $row->model) : 'Key #' . $row->api_key_id,
            'requests' => (int) $row->requests,
            'tokens' => (int) $row->tokens,
        ])->all();
    }

    /* ── health ─────────────────────────────────────────────────────────── */

    /**
     * A single score, and the four components it came from.
     *
     * Deliberately explainable: a bare "87%" tells an admin nothing about what to
     * fix, so every component is returned with its own score.
     */
    private function health(array $keyRows, array $modelRows, int $days): array
    {
        $weights = config('gemini.health_weights');
        $totals = $this->historyTotals($days);

        // Errors: the share of today's requests that failed.
        $errorRate = $totals['today'] > 0 ? ($totals['failed_today'] / $totals['today']) * 100 : 0.0;
        $errorScore = max(0, 100 - ($errorRate * 5));

        // Quota: how close the most-pressed model is to its ceiling.
        $peakQuota = 0.0;
        foreach ($modelRows as $model) {
            foreach ($model['quotas'] as $quota) {
                $peakQuota = max($peakQuota, (float) $quota['percent']);
            }
        }
        $quotaScore = max(0, 100 - $peakQuota);

        // Latency: measured against the configured budget.
        $budget = max(1, (int) config('gemini.latency_budget_ms', 6000));
        $latencyScore = $totals['avg_latency'] === 0
            ? 100
            : max(0, min(100, 100 - ((($totals['avg_latency'] - $budget) / $budget) * 100)));

        // Availability: the share of keys that can serve a request right now.
        $usableKeys = count(array_filter($keyRows, fn ($key) => in_array($key['status'], ['active', 'rpm_full'], true)));
        $availabilityScore = $keyRows === [] ? 0 : ($usableKeys / count($keyRows)) * 100;

        $score = (int) round(
            ($errorScore * $weights['errors']
            + $quotaScore * $weights['quota']
            + $latencyScore * $weights['latency']
            + $availabilityScore * $weights['availability']) / 100
        );

        return [
            'score' => $score,
            'label' => match (true) {
                $keyRows === [] => 'offline',
                $score >= 90 => 'healthy',
                $score >= 70 => 'degraded',
                $score >= 40 => 'at_risk',
                default => 'critical',
            },
            'components' => [
                ['key' => 'errors', 'score' => (int) round($errorScore), 'weight' => $weights['errors'], 'detail' => round($errorRate, 1) . '% من الطلبات فشلت اليوم'],
                ['key' => 'quota', 'score' => (int) round($quotaScore), 'weight' => $weights['quota'], 'detail' => 'أعلى استهلاك حصة: ' . round($peakQuota, 1) . '%'],
                ['key' => 'latency', 'score' => (int) round($latencyScore), 'weight' => $weights['latency'], 'detail' => 'متوسط الاستجابة ' . $totals['avg_latency'] . 'ms'],
                ['key' => 'availability', 'score' => (int) round($availabilityScore), 'weight' => $weights['availability'], 'detail' => "{$usableKeys} من " . count($keyRows) . ' مفتاح جاهز'],
            ],
        ];
    }

    /* ── helpers ────────────────────────────────────────────────────────── */

    /**
     * One quota reading: used, limit, percent, colour band and what is left.
     */
    private function quota(int $used, int $limit): array
    {
        $limit = max(0, $limit);
        $percent = $limit > 0 ? min(100, round(($used / $limit) * 100, 1)) : 0.0;
        $thresholds = config('gemini.thresholds');

        return [
            'used' => $used,
            'limit' => $limit,
            'percent' => $percent,
            'remaining' => max(0, $limit - $used),
            'band' => match (true) {
                $percent >= $thresholds['critical'] => 'critical',
                $percent >= $thresholds['high'] => 'high',
                $percent >= $thresholds['warning'] => 'warning',
                default => 'ok',
            },
        ];
    }

    /**
     * Every model worth showing: the configured ones plus anything that appears in
     * the logs, so a model switch shows up immediately instead of silently.
     *
     * @return list<string>
     */
    private function modelsInPlay(): array
    {
        $models = array_keys((array) config('gemini.models', []));

        // The models actually wired up right now lead the list.
        $active = array_values(array_filter([
            trim((string) config('services.gemini.model')),
            trim((string) config('services.gemini.embedding_model')),
        ]));

        $logged = $this->hasHistoryTable()
            ? ApiKeyUsageLog::where('created_at', '>=', now()->subDays(30))->distinct()->pluck('model')->all()
            : [];

        return array_values(array_unique(array_merge($active, $logged, $models)));
    }

    /**
     * Model configuration, looked up in PHP rather than through config() paths.
     *
     * Model ids contain dots ("gemini-3.5-flash-lite"), and config() reads a dot as
     * a nesting separator — `config('gemini.models.gemini-3.5-flash-lite')` looks
     * for a `gemini-3` key and finds nothing, so every dotted model silently fell
     * back to the defaults and displayed its raw id instead of its label.
     */
    private function limitsFor(string $model): array
    {
        $models = (array) config('gemini.models', []);

        return array_merge((array) config('gemini.defaults'), (array) ($models[$model] ?? []));
    }

    private function modelLabel(string $model): string
    {
        $models = (array) config('gemini.models', []);

        return (string) ($models[$model]['label'] ?? $model);
    }

    private function passesFilters(array $row, array $filters): bool
    {
        if (!empty($filters['api_key_id']) && $row['index'] !== (int) $filters['api_key_id']) {
            return false;
        }
        if (!empty($filters['status']) && $row['status'] !== $filters['status']) {
            return false;
        }
        if (!empty($filters['only_active']) && $row['status'] !== 'active') {
            return false;
        }
        if (!empty($filters['near_limit']) && !$row['near_limit']) {
            return false;
        }

        return true;
    }

    private function hasHistoryTable(): bool
    {
        static $exists = null;

        return $exists ??= Schema::hasTable('api_key_usage_logs');
    }
}
