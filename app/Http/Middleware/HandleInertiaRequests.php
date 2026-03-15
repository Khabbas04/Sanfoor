<?php

namespace App\Http\Middleware;

use App\Models\IssueReport;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
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
            $user->load('major');

            $normalizedRole = strtolower(trim((string) $user->role));
            $user->setAttribute('role', $normalizedRole);
            $user->setAttribute('is_owner', $normalizedRole === 'owner');
            $user->setAttribute('is_admin_or_owner', in_array($normalizedRole, ['admin', 'owner'], true));

            if (in_array($normalizedRole, ['admin', 'owner'], true)) {
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
            'admin_notifications' => $adminNotifications,
        ];
    }
}