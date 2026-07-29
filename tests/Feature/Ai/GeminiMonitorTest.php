<?php

namespace Tests\Feature\Ai;

use App\Models\ApiKeyUsageLog;
use App\Services\GeminiUsageAnalytics;
use App\Services\GeminiUsageRecorder;

/**
 * The Gemini infrastructure monitor: usage recording, per-key-per-model quotas,
 * history, charts and the health score.
 */
class GeminiMonitorTest extends AdvisorTestCase
{
    private const KEY_A = 'AIzaTESTKEYAAAAAAAAAAAAAAAAAAAAAAAAAAAA1';
    private const KEY_B = 'AIzaTESTKEYBBBBBBBBBBBBBBBBBBBBBBBBBBBB2';

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.gemini.keys', self::KEY_A . ',' . self::KEY_B);
        config()->set('services.gemini.key', '');
        config()->set('services.gemini.model', 'gemini-3.5-flash-lite');
        config()->set('services.gemini.embedding_model', 'gemini-embedding-2');
        config()->set('gemini.usage_logging', true);
    }

    private function recorder(): GeminiUsageRecorder
    {
        return app(GeminiUsageRecorder::class);
    }

    private function analytics(): GeminiUsageAnalytics
    {
        return app(GeminiUsageAnalytics::class);
    }

    /**
     * A log row dated in the past.
     *
     * `created_at` is not fillable, so it has to be forced — passing it to create()
     * silently stamps "now" and any test about history windows would pass for the
     * wrong reason.
     */
    private function logAt(string $key, string $model, \Carbon\Carbon $when, array $overrides = []): ApiKeyUsageLog
    {
        $row = ApiKeyUsageLog::create(array_merge([
            'api_key_id' => $key === self::KEY_A ? 1 : 2,
            'key_fingerprint' => $this->recorder()->fingerprint($key),
            'model' => $model,
            'request_type' => 'chat',
            'total_tokens' => 500,
            'latency_ms' => 900,
            'success' => true,
        ], $overrides));

        $row->forceFill(['created_at' => $when, 'updated_at' => $when])->save();

        return $row;
    }

    /** @param array<string, mixed> $overrides */
    private function logCall(string $key, string $model, array $overrides = []): void
    {
        $this->recorder()->record($key, [self::KEY_A, self::KEY_B], array_merge([
            'model' => $model,
            'request_type' => 'chat',
            'input_tokens' => 400,
            'output_tokens' => 600,
            'total_tokens' => 1000,
            'latency_ms' => 1200,
            'success' => true,
        ], $overrides));
    }

    /* ── recording ──────────────────────────────────────────────────────── */

    public function test_a_call_is_recorded_per_key_and_per_model(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');
        $this->logCall(self::KEY_A, 'gemini-embedding-2', ['request_type' => 'embed', 'total_tokens' => 120]);
        $this->logCall(self::KEY_B, 'gemini-3.5-flash-lite');

        $this->assertSame(3, ApiKeyUsageLog::count());

        $row = ApiKeyUsageLog::where('api_key_id', 1)->where('model', 'gemini-3.5-flash-lite')->firstOrFail();
        $this->assertSame(400, $row->input_tokens);
        $this->assertSame(600, $row->output_tokens);
        $this->assertSame(1000, $row->total_tokens);
        $this->assertSame(1200, $row->latency_ms);
        $this->assertTrue($row->success);
        $this->assertSame(1, $row->rpm, 'The counter snapshot is stored with the row.');

        // Each key gets its own identity, and #2 really is the second key.
        $this->assertSame(2, ApiKeyUsageLog::where('key_fingerprint', $this->recorder()->fingerprint(self::KEY_B))->firstOrFail()->api_key_id);
    }

    /** The key itself must never reach storage — not the row, not the cache key. */
    public function test_the_api_key_is_never_stored(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', [
            'success' => false,
            // The worst case: an error built from the request URL.
            'error_message' => 'cURL error 28 for https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=' . self::KEY_A,
            'error_type' => 'ConnectionException',
        ]);

        $row = ApiKeyUsageLog::firstOrFail();
        $serialised = json_encode($row->toArray(), JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString(self::KEY_A, $serialised);
        $this->assertStringNotContainsString('AIzaTESTKEY', $serialised);
        $this->assertStringContainsString('[redacted]', $row->error_message);
        $this->assertSame(16, strlen($row->key_fingerprint));
    }

    public function test_live_counters_are_kept_per_key_and_per_model(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', ['total_tokens' => 500]);
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', ['total_tokens' => 300]);
        $this->logCall(self::KEY_A, 'gemini-embedding-2', ['total_tokens' => 100]);

        $this->assertSame(2, $this->recorder()->requestsPerMinute(self::KEY_A, 'gemini-3.5-flash-lite'));
        $this->assertSame(800, $this->recorder()->tokensPerMinute(self::KEY_A, 'gemini-3.5-flash-lite'));
        $this->assertSame(2, $this->recorder()->requestsPerDay(self::KEY_A, 'gemini-3.5-flash-lite'));

        // The other model on the same key is counted separately.
        $this->assertSame(1, $this->recorder()->requestsPerMinute(self::KEY_A, 'gemini-embedding-2'));
        $this->assertSame(100, $this->recorder()->tokensPerMinute(self::KEY_A, 'gemini-embedding-2'));
        // And the other key is untouched.
        $this->assertSame(0, $this->recorder()->requestsPerMinute(self::KEY_B, 'gemini-3.5-flash-lite'));
    }

    /** With logging off the live counters still work; only history stops. */
    public function test_disabling_logging_keeps_live_counters(): void
    {
        config()->set('gemini.usage_logging', false);

        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');

        $this->assertSame(0, ApiKeyUsageLog::count());
        $this->assertSame(1, $this->recorder()->requestsPerMinute(self::KEY_A, 'gemini-3.5-flash-lite'));
    }

    /* ── quotas ─────────────────────────────────────────────────────────── */

    /**
     * The account-wide ceiling is per-key × keys, so adding a key raises it
     * automatically instead of drifting from a hardcoded total.
     */
    public function test_model_quotas_scale_with_the_number_of_keys(): void
    {
        $dashboard = $this->analytics()->dashboard();
        $model = collect($dashboard['models'])->firstWhere('id', 'gemini-3.5-flash-lite');

        // Two keys × 15 RPM / 250K TPM / 500 RPD.
        $this->assertSame(30, $model['quotas']['rpm']['limit']);
        $this->assertSame(500_000, $model['quotas']['tpm']['limit']);
        $this->assertSame(1_000, $model['quotas']['rpd']['limit']);
        $this->assertSame(15, $model['per_key_limits']['rpm']);

        config()->set('services.gemini.keys', self::KEY_A . ',' . self::KEY_B . ',AIzaTESTKEYCCCCCCCCCCCCCCCCCCCCCCCCCCC3');
        $widened = collect($this->analytics()->dashboard()['models'])->firstWhere('id', 'gemini-3.5-flash-lite');
        $this->assertSame(45, $widened['quotas']['rpm']['limit']);
    }

    public function test_quota_bands_follow_the_configured_thresholds(): void
    {
        // 13 of 15 RPM on one key = 86.7%, which is the "high" band.
        for ($i = 0; $i < 13; $i++) {
            $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', ['total_tokens' => 0]);
        }

        $key = collect($this->analytics()->dashboard()['keys'])->firstWhere('index', 1);
        $model = collect($key['models'])->firstWhere('id', 'gemini-3.5-flash-lite');

        $this->assertSame(13, $model['quotas']['rpm']['used']);
        $this->assertSame(15, $model['quotas']['rpm']['limit']);
        $this->assertSame('high', $model['quotas']['rpm']['band']);
        $this->assertSame(2, $model['quotas']['rpm']['remaining']);
        $this->assertSame('strained', $model['status']);
        $this->assertTrue($key['near_limit']);
    }

    public function test_remaining_requests_are_reported_for_the_day(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');

        $key = collect($this->analytics()->dashboard()['keys'])->firstWhere('index', 1);
        $model = collect($key['models'])->firstWhere('id', 'gemini-3.5-flash-lite');

        $this->assertSame(1, $model['quotas']['rpd']['used']);
        $this->assertSame(499, $model['quotas']['rpd']['remaining']);
        $this->assertSame('ok', $model['quotas']['rpd']['band']);
    }

    /** "Never used" is a different fact from "zero today". */
    public function test_an_unused_model_is_reported_as_never_used(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');

        $key = collect($this->analytics()->dashboard()['keys'])->firstWhere('index', 1);

        $this->assertFalse(collect($key['models'])->firstWhere('id', 'gemini-3.5-flash-lite')['never_used']);
        $this->assertTrue(collect($key['models'])->firstWhere('id', 'gemini-embedding-2')['never_used']);
    }

    /* ── overview & history ─────────────────────────────────────────────── */

    public function test_the_overview_totals_come_from_the_log(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', ['latency_ms' => 1000]);
        $this->logCall(self::KEY_B, 'gemini-3.5-flash-lite', ['latency_ms' => 3000]);
        $this->logCall(self::KEY_B, 'gemini-embedding-2', ['success' => false, 'error_message' => 'HTTP 429', 'error_type' => 'rate_limited']);

        $overview = $this->analytics()->dashboard()['overview'];

        $this->assertSame(2, $overview['total_keys']);
        $this->assertSame(3, $overview['requests_today']);
        $this->assertSame(1, $overview['failed_requests_today']);
        $this->assertSame(3000, $overview['tokens_today']);
        // Latency averages successful calls only: a failed call's timing is noise.
        $this->assertSame(2000, $overview['avg_response_ms']);
        $this->assertGreaterThanOrEqual(2, $overview['models_in_use']);
    }

    public function test_a_key_reports_its_history_and_last_error(): void
    {
        $this->logAt(self::KEY_A, 'gemini-3.5-flash-lite', now()->subDays(10));
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', [
            'success' => false,
            'error_message' => 'HTTP 503',
            'error_type' => 'overloaded',
        ]);

        $key = collect($this->analytics()->dashboard()['keys'])->firstWhere('index', 1);

        $this->assertSame(2, $key['history']['requests_today']);
        $this->assertSame(2, $key['history']['requests_week']);
        $this->assertSame(3, $key['history']['requests_month'], 'The 10-day-old call is inside the month.');
        $this->assertSame(3, $key['history']['lifetime']);
        $this->assertSame('HTTP 503', $key['history']['last_error']['message']);
        $this->assertSame('overloaded', $key['history']['last_error']['type']);
        $this->assertNotNull($key['history']['last_used_at']);
        $this->assertNotNull($key['history']['last_success_at']);
    }

    /* ── charts ─────────────────────────────────────────────────────────── */

    public function test_charts_cover_every_bucket_including_empty_days(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');

        $charts = $this->analytics()->dashboard(['days' => 7])['charts'];

        $this->assertCount(24, $charts['hourly'], 'A full 24-hour window, gaps included.');
        $this->assertCount(7, $charts['daily']);
        $this->assertCount(7, $charts['tokens_daily']);
        $this->assertCount(7, $charts['latency_daily']);
        $this->assertCount(7, $charts['errors_daily']);

        // The last bucket is today and carries the call.
        $this->assertSame(1, end($charts['daily'])['requests']);
        $this->assertSame(1000, end($charts['tokens_daily'])['total_tokens']);
        // An empty day is an explicit zero, not a missing point.
        $this->assertSame(0, $charts['daily'][0]['requests']);
    }

    public function test_distribution_charts_break_usage_down_by_model_and_key(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');
        $this->logCall(self::KEY_B, 'gemini-embedding-2', ['request_type' => 'embed']);

        $charts = $this->analytics()->dashboard()['charts'];

        $byModel = collect($charts['by_model'])->keyBy('key');
        $this->assertSame(2, $byModel['gemini-3.5-flash-lite']['requests']);
        $this->assertSame('Gemini 3.5 Flash Lite', $byModel['gemini-3.5-flash-lite']['label']);
        $this->assertSame(1, $byModel['gemini-embedding-2']['requests']);

        $byKey = collect($charts['by_key'])->keyBy('key');
        $this->assertSame(2, $byKey['1']['requests']);
        $this->assertSame('Key #1', $byKey['1']['label']);
    }

    /* ── health ─────────────────────────────────────────────────────────── */

    public function test_a_quiet_healthy_system_scores_high(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', ['latency_ms' => 900]);

        $health = $this->analytics()->dashboard()['health'];

        $this->assertGreaterThanOrEqual(90, $health['score']);
        $this->assertSame('healthy', $health['label']);
        $this->assertSame(['errors', 'quota', 'latency', 'availability'], array_column($health['components'], 'key'));
    }

    public function test_errors_pull_the_health_score_down(): void
    {
        foreach (range(1, 5) as $i) {
            $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite', [
                'success' => false,
                'error_message' => 'HTTP 429',
                'error_type' => 'rate_limited',
            ]);
        }

        $health = $this->analytics()->dashboard()['health'];
        $errors = collect($health['components'])->firstWhere('key', 'errors');

        $this->assertLessThan(90, $health['score']);
        $this->assertSame(0, $errors['score'], '100% failures is the worst error score.');
        $this->assertStringContainsString('100%', $errors['detail']);
    }

    public function test_the_health_score_is_offline_without_keys(): void
    {
        config()->set('services.gemini.keys', '');
        config()->set('services.gemini.key', '');

        $dashboard = $this->analytics()->dashboard();

        $this->assertSame('offline', $dashboard['health']['label']);
        $this->assertSame(0, $dashboard['overview']['total_keys']);
        $this->assertSame([], $dashboard['keys']);
    }

    /* ── filters ────────────────────────────────────────────────────────── */

    public function test_filters_narrow_the_keys_and_the_charts(): void
    {
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');
        $this->logCall(self::KEY_B, 'gemini-embedding-2', ['request_type' => 'embed']);

        $byKey = $this->analytics()->dashboard(['api_key_id' => 1]);
        $this->assertSame([1], array_column($byKey['keys'], 'index'));
        $this->assertSame(['1'], array_column($byKey['charts']['by_key'], 'key'));

        $byModel = $this->analytics()->dashboard(['model' => 'gemini-embedding-2']);
        $this->assertSame(['gemini-embedding-2'], array_column($byModel['models'], 'id'));
        $this->assertSame(['gemini-embedding-2'], array_column($byModel['charts']['by_model'], 'key'));

        $nearLimit = $this->analytics()->dashboard(['near_limit' => true]);
        $this->assertSame([], $nearLimit['keys'], 'Nothing is near its limit yet.');

        $onlyActive = $this->analytics()->dashboard(['only_active' => true]);
        $this->assertCount(2, $onlyActive['keys']);
    }

    /* ── endpoint ───────────────────────────────────────────────────────── */

    public function test_the_dashboard_endpoint_is_admin_only(): void
    {
        [$student] = $this->student();

        $this->actingAs($student)->getJson(route('admin.ai_monitor.metrics'))->assertRedirect();
        $this->getJson(route('admin.ai_monitor.metrics'))->assertRedirect();
    }

    public function test_the_endpoint_returns_the_whole_payload(): void
    {
        [$admin] = $this->student('admin@example.com', ['role' => 'admin']);
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');

        $this->actingAs($admin)
            ->getJson(route('admin.ai_monitor.metrics'))
            ->assertOk()
            ->assertJsonStructure([
                'logging_enabled', 'has_history', 'generated_at', 'thresholds', 'filters',
                'available_models',
                'overview' => ['total_keys', 'active_keys', 'resting_keys', 'keys_near_limit', 'models_in_use', 'requests_today', 'requests_week', 'tokens_today', 'avg_response_ms', 'failed_requests_today', 'total_conversations'],
                'health' => ['score', 'label', 'components'],
                'models' => [['id', 'label', 'quotas' => ['rpm', 'tpm', 'rpd'], 'requests_today', 'success_rate', 'error_rate', 'avg_response_ms', 'never_used']],
                'keys' => [['index', 'fingerprint', 'masked_key', 'status', 'models', 'history', 'near_limit']],
                'charts' => ['hourly', 'daily', 'tokens_daily', 'latency_daily', 'errors_daily', 'by_model', 'by_key'],
            ]);
    }

    public function test_the_endpoint_never_exposes_a_key(): void
    {
        [$admin] = $this->student('admin@example.com', ['role' => 'admin']);
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');

        $response = $this->actingAs($admin)->getJson(route('admin.ai_monitor.metrics'))->assertOk();

        $this->assertStringNotContainsString(self::KEY_A, $response->content());
        $this->assertStringNotContainsString(self::KEY_B, $response->content());

        // Only a short masked form is shown, and it cannot reconstruct the key.
        $masked = $response->json('keys.0.masked_key');
        $this->assertStringContainsString('…', $masked);
        $this->assertLessThan(20, mb_strlen($masked, 'UTF-8'));
    }

    public function test_the_endpoint_validates_its_filters(): void
    {
        [$admin] = $this->student('admin@example.com', ['role' => 'admin']);

        $this->actingAs($admin)
            ->getJson(route('admin.ai_monitor.metrics', ['days' => 900]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('days');

        $this->actingAs($admin)
            ->getJson(route('admin.ai_monitor.metrics', ['status' => 'melted']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_the_page_renders_with_its_first_payload(): void
    {
        [$admin] = $this->student('admin@example.com', ['role' => 'admin']);
        $this->logCall(self::KEY_A, 'gemini-3.5-flash-lite');

        $this->actingAs($admin)
            ->get(route('admin.ai_monitor'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/AiMonitor/Index')
                ->has('initialMetrics.overview')
                ->has('initialMetrics.models')
                ->has('initialMetrics.keys')
                ->has('initialMetrics.charts'));
    }

    /* ── retention ──────────────────────────────────────────────────────── */

    public function test_pruning_removes_only_rows_past_the_retention_window(): void
    {
        foreach ([200, 5] as $daysAgo) {
            $this->logAt(self::KEY_A, 'gemini-3.5-flash-lite', now()->subDays($daysAgo));
        }

        $this->artisan('gemini:prune-usage', ['--days' => 120])->assertSuccessful();

        $this->assertSame(1, ApiKeyUsageLog::count());
        $this->assertTrue(ApiKeyUsageLog::firstOrFail()->created_at->gt(now()->subDays(30)));
    }

    /**
     * The aggregates must run on Postgres too.
     *
     * Production is pgsql while the suite runs on sqlite, and `success = 1` — legal
     * in MySQL and SQLite — makes Postgres abort with "operator does not exist:
     * boolean = integer", which took the whole page down with a 500. A bare boolean
     * column is a valid condition on all three, so the comparison must not come back.
     */
    public function test_boolean_aggregates_stay_portable_across_drivers(): void
    {
        $source = file_get_contents(app_path('Services/GeminiUsageAnalytics.php'));

        $this->assertDoesNotMatchRegularExpression(
            '/success\s*=\s*(0|1|true|false)/i',
            $source,
            'Compare the boolean column directly (CASE WHEN success …) instead of against a literal.'
        );
    }

    /** A monitoring page must report a failure, not become one. */
    public function test_a_metrics_failure_degrades_into_a_message(): void
    {
        [$admin] = $this->student('admin@example.com', ['role' => 'admin']);

        $this->app->bind(GeminiUsageAnalytics::class, fn () => new class extends GeminiUsageAnalytics {
            public function __construct() {}

            public function dashboard(array $filters = []): array
            {
                throw new \RuntimeException('boolean = integer');
            }
        });

        $response = $this->actingAs($admin)
            ->getJson(route('admin.ai_monitor.metrics'))
            ->assertOk();

        $this->assertTrue($response->json('unavailable'));
        $this->assertStringContainsString('boolean = integer', $response->json('error'));
        $this->assertNull($response->json('overview'));

        // And the page itself still renders.
        $this->actingAs($admin)
            ->get(route('admin.ai_monitor'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('initialMetrics.unavailable', true));
    }

    /** The legacy endpoint the settings tab uses must keep working. */
    public function test_the_legacy_key_status_endpoint_still_works(): void
    {
        [$admin] = $this->student('admin@example.com', ['role' => 'admin']);

        $this->actingAs($admin)
            ->getJson(route('admin.api.ai_key_status'))
            ->assertOk()
            ->assertJsonStructure(['keys', 'summary' => ['total_keys', 'active_keys', 'health_level']]);
    }
}
