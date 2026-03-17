<?php

namespace App\Http\Middleware;

use App\Models\IssueReport;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
    * The root Blade view used for the first Inertia page load.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $adminNotifications = null;

        if ($user) {
            // Preload the major relation because it is used in shared frontend state.
            $user->load('major');

            // Normalize role-related flags once so every page receives the same shape.
            $normalizedRole = strtolower(trim((string) $user->role));
            $user->setAttribute('role', $normalizedRole);
            $user->setAttribute('is_owner', $normalizedRole === 'owner');
            $user->setAttribute('is_admin_or_owner', in_array($normalizedRole, ['admin', 'owner'], true));

            if (in_array($normalizedRole, ['admin', 'owner'], true)) {
                // Share lightweight admin notifications globally for the sidebar badge.
                $adminNotifications = [
                    'open_issues_count' => IssueReport::where('status', 'open')->count(),
                ];
            }
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user,
            ],
            // Inertia client expects flash to be an object-shaped payload on every page.
            'flash' => [
                'message' => fn () => $request->session()->get('message'),
                'type' => fn () => $request->session()->get('type'),
            ],
            // Keep admin notifications separate so non-admin pages can ignore them safely.
            'admin_notifications' => $adminNotifications,
        ];
    }
}