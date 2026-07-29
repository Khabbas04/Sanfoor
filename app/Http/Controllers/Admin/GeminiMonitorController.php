<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\GeminiUsageAnalytics;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            'initialMetrics' => app(GeminiUsageAnalytics::class)->dashboard($this->filters($request)),
        ]);
    }

    /** Polled by the dashboard; also what the filter controls call. */
    public function metrics(Request $request)
    {
        $this->authorizeAdmin();

        return response()->json(app(GeminiUsageAnalytics::class)->dashboard($this->filters($request)));
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
