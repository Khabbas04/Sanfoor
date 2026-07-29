<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\GeminiUsageAnalytics;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * The Gemini infrastructure monitor.
 *
 * A page of its own rather than another settings tab: the questions it answers
 * (which key is throttled, which model is burning quota, why latency moved) are
 * operational, and they need charts and a refresh loop, not a form.
 *
 * The old `admin.api.ai_key_status` endpoint is untouched and still serves the
 * existing settings tab, so nothing that already works depends on this.
 */
class GeminiMonitorController extends Controller
{
    public function index(Request $request)
    {
        $this->authorizeAdmin();

        return Inertia::render('Admin/AiMonitor/Index', [
            // The first paint ships with data so the page is useful before the
            // polling loop has had a chance to run.
            'initialMetrics' => $this->safeDashboard($request),
        ]);
    }

    /** Polled by the dashboard; also what the filter controls call. */
    public function metrics(Request $request)
    {
        $this->authorizeAdmin();

        return response()->json($this->safeDashboard($request));
    }

    /**
     * Build the payload, or report why it could not be built.
     *
     * A monitoring page that returns 500 is the one page you cannot afford to
     * lose: it is where an admin looks when something else is already broken. So a
     * failure here becomes a message inside the dashboard, with the reason, rather
     * than an error page with none.
     */
    private function safeDashboard(Request $request): array
    {
        $filters = $this->filters($request);

        try {
            return app(GeminiUsageAnalytics::class)->dashboard($filters);
        } catch (\Throwable $e) {
            Log::error('Gemini monitor metrics failed: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'line' => $e->getLine(),
                'file' => $e->getFile(),
            ]);

            return [
                'unavailable' => true,
                'error' => class_basename($e) . ': ' . mb_substr($e->getMessage(), 0, 300),
                'logging_enabled' => (bool) config('gemini.usage_logging', true),
                'has_history' => false,
                'generated_at' => now()->toISOString(),
                'thresholds' => config('gemini.thresholds'),
                'filters' => $filters,
                'available_models' => [],
                'overview' => null,
                'health' => null,
                'models' => [],
                'keys' => [],
                'charts' => null,
            ];
        }
    }

    /**
     * @return array{model: ?string, api_key_id: ?int, status: ?string, days: int, only_active: bool, near_limit: bool}
     */
    private function filters(Request $request): array
    {
        $validated = $request->validate([
            'model' => ['nullable', 'string', 'max:60'],
            'api_key_id' => ['nullable', 'integer', 'min:1', 'max:255'],
            'status' => ['nullable', 'string', 'in:active,cooldown,rpm_full,invalid'],
            'days' => ['nullable', 'integer', 'min:1', 'max:90'],
            'only_active' => ['nullable', 'boolean'],
            'near_limit' => ['nullable', 'boolean'],
        ]);

        return [
            'model' => $validated['model'] ?? null,
            'api_key_id' => $validated['api_key_id'] ?? null,
            'status' => $validated['status'] ?? null,
            'days' => (int) ($validated['days'] ?? 7),
            'only_active' => (bool) ($validated['only_active'] ?? false),
            'near_limit' => (bool) ($validated['near_limit'] ?? false),
        ];
    }

    private function authorizeAdmin(): void
    {
        $user = Auth::user();

        abort_unless($user && method_exists($user, 'isAdminOrOwner') && $user->isAdminOrOwner(), 403);
    }
}
