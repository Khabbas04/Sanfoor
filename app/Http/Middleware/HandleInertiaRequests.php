<?php

namespace App\Http\Middleware;

use App\Models\IssueReport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
        $sharedUser = null;

        if ($user) {
            $normalizedRole = strtolower(trim((string) $user->role));
            $major = $user->relationLoaded('major')
                ? $user->getRelation('major')
                : $user->major()->select('id', 'name', 'college_id')->first();

            $sharedUser = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $normalizedRole,
                'major_id' => $user->major_id,
                'major' => $major ? [
                    'id' => $major->id,
                    'name' => $major->name,
                    'college_id' => $major->college_id,
                ] : null,
                'study_plan_version' => $user->study_plan_version,
                'is_owner' => $normalizedRole === 'owner',
                'is_admin_or_owner' => in_array($normalizedRole, ['admin', 'owner'], true),
            ];

            if (in_array($normalizedRole, ['admin', 'owner'], true)) {
                // Share lightweight admin notifications globally for the sidebar badge.
                $adminNotifications = [
                    'open_issues_count' => Cache::remember(
                        'admin:open_issues_count',
                        now()->addSeconds(60),
                        fn () => IssueReport::where('status', 'open')->count()
                    ),
                ];
            }
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $sharedUser,
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