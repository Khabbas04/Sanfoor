<?php

namespace App\Http\Middleware;

use App\Models\AcademicPeriod;
use App\Models\IssueReport;
use App\Models\SiteMaintenance;
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
                'avatar' => $user->avatar,
                'role' => $normalizedRole,
                'major_id' => $user->major_id,
                'major' => $major ? [
                    'id' => $major->id,
                    'name' => $major->name,
                    'college_id' => $major->college_id,
                ] : null,
                'study_plan_version' => $user->study_plan_version,
                'is_instructor' => $normalizedRole === 'instructor',
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
                    'unread_messages_count' => Cache::remember(
                        'admin:unread_messages_count',
                        now()->addSeconds(60),
                        fn () => \App\Models\ContactMessage::where('status', 'new')->count()
                    ),
                    'active_ai_chats_count' => Cache::remember(
                        'admin:active_ai_chats_count',
                        now()->addSeconds(60),
                        fn () => \App\Models\Chat::whereDate('updated_at', today())->count()
                    ),
                ];
            }
        }

        $currentAcademicPeriod = AcademicPeriod::current();
        $currentMaintenance = SiteMaintenance::current();

        $maintenanceMode = $currentMaintenance ? [
            'id' => $currentMaintenance->id,
            'is_enabled' => (bool) $currentMaintenance->is_enabled,
            'title' => $currentMaintenance->title,
            'message' => $currentMaintenance->message,
            'expected_minutes' => $currentMaintenance->expected_minutes !== null ? (int) $currentMaintenance->expected_minutes : null,
            'activated_at' => optional($currentMaintenance->activated_at)->toISOString(),
            'ended_at' => optional($currentMaintenance->ended_at)->toISOString(),
        ] : null;

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $sharedUser,
            ],
            'flash' => [
                'message' => fn () => $request->session()->get('message') ?? '',
                'type' => fn () => $request->session()->get('type') ?? 'info',
            ],
            'academic_period' => $currentAcademicPeriod ? [
                'id' => $currentAcademicPeriod->id,
                'academic_year' => $currentAcademicPeriod->academic_year,
                'academic_term' => (int) $currentAcademicPeriod->academic_term,
                'label' => $currentAcademicPeriod->label,
                'display_label' => $currentAcademicPeriod->displayLabel(),
                'is_current' => (bool) $currentAcademicPeriod->is_current,
            ] : null,
            'maintenance_mode' => $maintenanceMode,
            'admin_notifications' => $adminNotifications ?? (object)[],
        ];
    }
}