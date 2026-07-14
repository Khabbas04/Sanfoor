<?php

namespace App\Http\Controllers;

use App\Models\AcademicPeriod;
use App\Models\Chat;
use App\Models\Course;
use App\Models\Message;
use App\Models\Major;
use App\Models\College;
use App\Models\User;
use App\Models\AdminLog;
use App\Models\AdminNote;
use App\Models\IssueReport;
use App\Models\Chapter;
use App\Models\ContactMessage;
use App\Models\Landmark;
use App\Models\Question;
use App\Models\QuizAttempt;
use App\Models\SiteMaintenance;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    /**
     * تسجيل حركات الأدمن في قاعدة البيانات
     */
    private function logAction($action, $details) {
        AdminLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'details' => $details,
            'ip_address' => request()->ip(),
            'meta' => [
                'user_agent' => request()->header('User-Agent')
            ]
        ]);
    }

    /**
     * لوحة المعلومات الإحصائية + تقارير المواد الأكثر طلباً
     */
    public function dashboard()
    {
        $today = now()->toDateString();
        $notesEnabled = true;

        $currentPeriod = AcademicPeriod::current();
        $hasPeriodColumns = true;

        $demandReport = \Illuminate\Support\Facades\Cache::remember('admin_dashboard_demand_report', 300, function () use ($currentPeriod, $hasPeriodColumns) {
            return Course::whereHas('cartUsers', function ($query) use ($currentPeriod, $hasPeriodColumns) {
                    if ($currentPeriod && $hasPeriodColumns) {
                        $query->where('user_carts.academic_year', $currentPeriod->academic_year)
                              ->where('user_carts.academic_term', $currentPeriod->academic_term);
                    }
                })
                ->withCount(['cartUsers' => function ($query) use ($currentPeriod, $hasPeriodColumns) {
                    if ($currentPeriod && $hasPeriodColumns) {
                        $query->where('user_carts.academic_year', $currentPeriod->academic_year)
                              ->where('user_carts.academic_term', $currentPeriod->academic_term);
                    }
                }])
                ->get()
                ->groupBy(function($course) {
                    $name = mb_strtolower(trim($course->name));
                    $name = preg_replace('/\s+/u', '', $name);
                    $name = str_replace(['أ', 'إ', 'آ'], 'ا', $name);
                    $name = str_replace('ة', 'ه', $name);
                    $name = str_replace('ى', 'ي', $name);
                    return $name;
                })
                ->map(function($group) {
                    $first = $group->first();
                    $first->cart_users_count = $group->sum('cart_users_count');
                    $bestNameCourse = $group->sortByDesc(fn($c) => strlen($c->name))->first();
                    $first->name = $bestNameCourse->name;
                    return $first;
                })
                ->sortByDesc('cart_users_count')
                ->take(10)
                ->values();
        });

        $issueSummary = \Illuminate\Support\Facades\Cache::remember('admin_dashboard_issue_summary', 180, function () {
            return [
                'open' => IssueReport::where('status', 'open')->count(),
                'in_progress' => IssueReport::where('status', 'in_progress')->count(),
                'resolved' => IssueReport::where('status', 'resolved')->count(),
                'total' => IssueReport::count(),
            ];
        });

        // 🔥 حساب النشطين حالياً (آخر 30 دقيقة)
        $thirtyMinutesAgoStr = now()->subMinutes(30)->toDateTimeString();
        
        $activeStudentIds = User::where('role', 'student')
            ->whereNotNull('last_seen_at')
            ->where('last_seen_at', '>=', $thirtyMinutesAgoStr)
            ->pluck('id');
        
        $activeAdminIds = User::whereRaw('LOWER(role) = ?', ['admin'])
            ->whereNotNull('last_seen_at')
            ->where('last_seen_at', '>=', $thirtyMinutesAgoStr)
            ->pluck('id');

        // 🔥 الحصول على قائمة المستخدمين النشطين مع تفاصيلهم (مكاش لـ 30 ثانية لتخفيف الضغط)
        $onlineUsers = \Illuminate\Support\Facades\Cache::remember('admin_dashboard_online_users', 30, function () use ($thirtyMinutesAgoStr) {
            return User::whereNotNull('last_seen_at')
                ->where('last_seen_at', '>=', $thirtyMinutesAgoStr)
                ->orderByDesc('last_seen_at')
                ->get(['id', 'name', 'email', 'role', 'last_seen_at'])
                ->map(function ($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'role' => $user->role,
                        'last_activity_ago' => \Carbon\Carbon::parse($user->last_seen_at)->diffForHumans(),
                    ];
                });
        });

        $adminNotes = $notesEnabled
            ? AdminNote::with('user:id,name,email')
                ->orderByDesc('note_date')
                ->orderByDesc('updated_at')
                ->take(25)
                ->get()
            : collect();

        $myAdminNote = $notesEnabled
            ? AdminNote::where('user_id', Auth::id())
                ->where('note_date', $today)
                ->first()
            : null;

        $stats = \Illuminate\Support\Facades\Cache::remember('admin_dashboard_stats', 300, function () use ($activeStudentIds, $activeAdminIds) {
            return [
                'students_count' => User::where('role', 'student')->count(),
                'active_students_now' => $activeStudentIds->count(),
                'admins_count' => User::whereRaw('LOWER(role) = ?', ['admin'])->count(),
                'active_admins_now' => $activeAdminIds->count(),
                'owners_count' => User::whereRaw('LOWER(role) = ?', ['owner'])->count(),
                'instructors_count' => User::whereRaw('LOWER(role) = ?', ['instructor'])->count(),
                'courses_count' => Course::where('is_quiz_only', false)->count(),
                'compulsory_count' => Course::where('is_quiz_only', false)->where('type', 'compulsory')->count(),
                'elective_count' => Course::where('is_quiz_only', false)->where('type', 'elective')->count(),
                // Quizzes & Chapters System Stats
                'quiz_courses_count' => Course::where('is_quiz_only', true)->count(),
                'chapters_count' => Chapter::count(),
                'questions_count' => Question::count(),
                'quiz_attempts_count' => QuizAttempt::count(),
                'quiz_avg_score' => round(QuizAttempt::avg('score_percentage') ?? 0),
                'ai_chats_count' => Chat::count(),
                'contact_messages_count' => ContactMessage::count(),
                'unread_contact_messages_count' => ContactMessage::where('status', 'new')->count(),
                'landmarks_count' => Landmark::count(),
            ];
        });

        $platform = \Illuminate\Support\Facades\Cache::remember('admin_dashboard_platform', 300, function () {
            return [
                'colleges_count' => College::count(),
                'majors_count' => Major::count(),
            ];
        });

        return Inertia::render('Admin/Dashboard', [
            'stats' => $stats,
            'onlineUsers' => $onlineUsers,
            'platform' => $platform,
            'colleges' => \Illuminate\Support\Facades\Cache::remember('admin_colleges', 1800, fn() => College::select('id', 'name')->orderBy('name')->get()),
            'majors' => \Illuminate\Support\Facades\Cache::remember('admin_majors', 1800, fn() => Major::select('id', 'name', 'code', 'college_id')->orderBy('name')->get()),
            'demandReport' => $demandReport,
            'issueSummary' => $issueSummary,
            'recentIssues' => IssueReport::with('user:id,name,email')->latest()->take(6)->get(),
            'logs' => AdminLog::with('user:id,name,email')->where('owner_only', false)->latest()->take(25)->get(),

            'adminNotes' => $adminNotes,
            'myAdminNote' => $myAdminNote,
            'notesEnabled' => $notesEnabled,
            'demoGuests' => \App\Models\User::with(['major.college'])->where('role', 'guest')->latest()->take(50)->get(),
        ]);
    }

    /**
     * حفظ ملاحظة الأدمن اليومية.
     */
    public function storeAdminNote(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isAdminOrOwner(), 403);


        $data = $request->validate([
            'note' => ['required', 'string', 'max:1500'],
        ]);

        $note = trim($data['note']);
        $today = now()->toDateString();

        if ($note === '') {
            return redirect()->back()->with([
                'message' => 'الرجاء كتابة ملاحظة واضحة قبل الحفظ.',
                'type' => 'error',
            ]);
        }

        AdminNote::updateOrCreate(
            [
                'user_id' => $user->id,
                'note_date' => $today,
            ],
            [
                'note' => $note,
            ]
        );

        return redirect()->route('admin.dashboard')->with([
            'message' => 'تم حفظ الملاحظة بنجاح.',
            'type' => 'success',
        ]);
    }

    /**
     * صفحة إعدادات الإدارة: الأونلاين + روابط إدارة الأدمن
     */
    public function settings()
    {
        $currentAcademicPeriod = AcademicPeriod::current();
        $thirtyMinutesAgoStr = now()->subMinutes(30)->toDateTimeString();
        
        $onlineUsers = \Illuminate\Support\Facades\Cache::remember('admin_dashboard_online_users', 30, function () use ($thirtyMinutesAgoStr) {
            return User::whereNotNull('last_seen_at')
                ->where('last_seen_at', '>=', $thirtyMinutesAgoStr)
                ->orderByDesc('last_seen_at')
                ->get(['id', 'name', 'email', 'role', 'last_seen_at'])
                ->map(function ($user) {
                    return [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'role' => $user->role,
                        'last_activity' => $user->last_seen_at ? strtotime($user->last_seen_at) : null,
                        'last_activity_ago' => $user->last_seen_at ? \Carbon\Carbon::parse($user->last_seen_at)->diffForHumans() : null,
                    ];
                });
        });

        $activeStudentsNow = $onlineUsers->where('role', 'student')->count();
        $activeAdminsNow = $onlineUsers->filter(function ($u) {
            return strtolower((string) $u['role']) === 'admin';
        })->count();

        $stats = \Illuminate\Support\Facades\Cache::remember('admin_settings_stats', 300, function () use ($activeStudentsNow, $activeAdminsNow) {
            return [
                'students_count' => User::where('role', 'student')->count(),
                'admins_count' => User::whereRaw('LOWER(role) = ?', ['admin'])->count(),
                'instructors_count' => User::whereRaw('LOWER(role) = ?', ['instructor'])->count(),
                'active_students_now' => $activeStudentsNow,
                'active_admins_now' => $activeAdminsNow,
            ];
        });

        return Inertia::render('Admin/Settings', [
            'currentAcademicPeriod' => $currentAcademicPeriod ? [
                'id' => $currentAcademicPeriod->id,
                'academic_year' => $currentAcademicPeriod->academic_year,
                'academic_term' => (int) $currentAcademicPeriod->academic_term,
                'label' => $currentAcademicPeriod->label,
                'display_label' => $currentAcademicPeriod->displayLabel(),
                'is_current' => (bool) $currentAcademicPeriod->is_current,
            ] : null,
            'siteMaintenance' => $this->formatMaintenancePayload(SiteMaintenance::current()),
            'stats' => $stats,
            'onlineUsers' => $onlineUsers,
        ]);
    }

    /**
     * عرض محادثات AI الخاصة بالطلاب داخل الأدمن.
     */
    public function aiChats(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isAdminOrOwner(), 403);

        $search = trim((string) $request->input('q', ''));
        $selectedChatId = $request->integer('chat_id');

        $chatsQuery = Chat::query()
            ->with(['user:id,name,email', 'latestMessage'])
            ->withCount('messages')
            ->orderByDesc('updated_at')
            ->orderByDesc('id');

        if ($search !== '') {
            $chatsQuery->where(function ($query) use ($search) {
                $query->where('title', 'like', '%' . $search . '%')
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', '%' . $search . '%')
                            ->orWhere('email', 'like', '%' . $search . '%');
                    });

                if (ctype_digit($search)) {
                    $query->orWhere('id', (int) $search);
                }
            });
        }

        $chats = $chatsQuery
            ->take(60)
            ->get()
            ->map(function (Chat $chat) {
                $lastMessage = $chat->latestMessage;

                return [
                    'id' => $chat->id,
                    'title' => $chat->title,
                    'user' => [
                        'id' => $chat->user?->id,
                        'name' => $chat->user?->name ?? 'غير معروف',
                        'email' => $chat->user?->email,
                    ],
                    'messages_count' => (int) $chat->messages_count,
                    'last_message_excerpt' => $lastMessage ? $this->chatMessageExcerpt($lastMessage) : 'لا توجد رسائل بعد',
                    'last_message_at' => optional($lastMessage?->created_at)->toISOString(),
                    'updated_at' => optional($chat->updated_at)->toISOString(),
                    'created_at' => optional($chat->created_at)->toISOString(),
                ];
            })
            ->values();

        $selectedChat = null;
        if ($selectedChatId) {
            $selectedChat = Chat::with('user:id,name,email')->find($selectedChatId);
        }

        if (!$selectedChat && $chats->isNotEmpty()) {
            $selectedChat = Chat::with('user:id,name,email')->find($chats->first()['id']);
        }

        $selectedMessages = collect();
        if ($selectedChat) {
            $selectedMessages = $selectedChat->messages()
                ->orderBy('created_at')
                ->get()
                ->map(function (Message $message) {
                    $displayContent = $this->chatMessageContent($message);

                    return [
                        'id' => $message->id,
                        'role' => $message->role,
                        'content' => $displayContent,
                        'display_content' => $displayContent,
                        'raw_content' => (string) $message->content,
                        'created_at' => optional($message->created_at)->toISOString(),
                        'created_human' => optional($message->created_at)?->diffForHumans(),
                    ];
                });
        }

        $summary = [
            'total_chats' => Chat::count(),
            'total_messages' => Message::count(),
            'today_chats' => Chat::whereDate('created_at', today())->count(),
            'today_messages' => Message::whereDate('created_at', today())->count(),
        ];

        return Inertia::render('Admin/AiChats/Index', [
            'summary' => $summary,
            'chats' => $chats,
            'selectedChat' => $selectedChat ? [
                'id' => $selectedChat->id,
                'title' => $selectedChat->title,
                'user' => [
                    'id' => $selectedChat->user?->id,
                    'name' => $selectedChat->user?->name ?? 'غير معروف',
                    'email' => $selectedChat->user?->email,
                ],
                'created_at' => optional($selectedChat->created_at)->toISOString(),
                'updated_at' => optional($selectedChat->updated_at)->toISOString(),
                'messages_count' => $selectedChat->messages()->count(),
            ] : null,
            'messages' => $selectedMessages,
            'filters' => [
                'q' => $search,
                'chat_id' => $selectedChat?->id,
            ],
        ]);
    }

    /**
     * Update the globally visible academic period.
     */
    public function updateAcademicPeriod(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isAdminOrOwner(), 403);


        $validated = $request->validate([
            'academic_year' => ['required', 'string', 'max:20'],
            'academic_term' => ['required', 'integer', 'in:1,2,3'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

        $previousPeriod = AcademicPeriod::current();

        DB::transaction(function () use ($validated) {
            $currentPeriod = AcademicPeriod::current();

            AcademicPeriod::query()->where('id', '!=', $currentPeriod?->id)->update([
                'is_current' => false,
                'updated_at' => now(),
            ]);

            if ($currentPeriod) {
                $currentPeriod->update([
                    'academic_year' => trim($validated['academic_year']),
                    'academic_term' => (int) $validated['academic_term'],
                    'label' => filled($validated['label']) ? trim($validated['label']) : null,
                    'is_current' => true,
                ]);
            } else {
                AcademicPeriod::create([
                    'academic_year' => trim($validated['academic_year']),
                    'academic_term' => (int) $validated['academic_term'],
                    'label' => filled($validated['label']) ? trim($validated['label']) : null,
                    'is_current' => true,
                ]);
            }
        });

        $updatedPeriod = AcademicPeriod::current();

        // If the academic year or term changed to a different logical period, clear all user carts
        $changed = false;
        if (!$previousPeriod && $updatedPeriod) {
            $changed = true;
        } elseif ($previousPeriod && $updatedPeriod) {
            if ((string) $previousPeriod->academic_year !== (string) $updatedPeriod->academic_year
                || (int) $previousPeriod->academic_term !== (int) $updatedPeriod->academic_term) {
                $changed = true;
            }
        }

        if ($changed) {
            // Clear pivot table entries for all users' carts
            \DB::table('user_carts')->delete();
            $this->logAction('RESET_ALL_CARTS', 'تم تفريغ تسجيلات التجريبية لجميع المستخدمين بسبب تغيير الفصل الأكاديمي.');
        }

        $updatedPeriod = AcademicPeriod::current();
        $this->logAction('UPDATE_ACADEMIC_PERIOD', 'تم تحديث الفصل الأكاديمي الحالي إلى: ' . ($updatedPeriod?->displayLabel() ?? 'غير محدد'));

        return redirect()->back()->with([
            'message' => 'تم حفظ الفصل الأكاديمي الحالي بنجاح.',
            'type' => 'success',
        ]);
    }

    /**
     * Update the shared maintenance mode state.
     */
    public function updateMaintenanceMode(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isAdminOrOwner(), 403);


        $validated = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:2000'],
            'expected_minutes' => ['nullable', 'integer', 'min:5', 'max:1440'],
        ]);

        $maintenance = SiteMaintenance::current();
        $payload = [
            'is_enabled' => (bool) $validated['is_enabled'],
            'title' => trim($validated['title']),
            'message' => filled($validated['message']) ? trim($validated['message']) : null,
            'expected_minutes' => filled($validated['expected_minutes']) ? (int) $validated['expected_minutes'] : null,
            'updated_at' => now(),
        ];

        if ((bool) $validated['is_enabled']) {
            $payload['activated_at'] = $maintenance?->activated_at ?? now();
            $payload['ended_at'] = null;
        } else {
            $payload['ended_at'] = now();
        }

        if ($maintenance) {
            $maintenance->update($payload);
        } else {
            SiteMaintenance::create($payload + [
                'activated_at' => $payload['activated_at'] ?? null,
                'ended_at' => $payload['ended_at'] ?? null,
            ]);
        }

        $current = SiteMaintenance::current();
        $this->logAction(
            (bool) $validated['is_enabled'] ? 'ENABLE_SITE_MAINTENANCE' : 'DISABLE_SITE_MAINTENANCE',
            'تم ' . ((bool) $validated['is_enabled'] ? 'تفعيل' : 'إيقاف') . ' وضع الصيانة' . ($current?->title ? ' - ' . $current->title : '')
        );

        return redirect()->back()->with([
            'message' => (bool) $validated['is_enabled'] ? 'تم تفعيل وضع الصيانة بنجاح.' : 'تم إيقاف وضع الصيانة بنجاح.',
            'type' => 'success',
        ]);
    }

    private function formatMaintenancePayload(?SiteMaintenance $maintenance): ?array
    {
        if (!$maintenance) {
            return null;
        }

        return [
            'id' => $maintenance->id,
            'is_enabled' => (bool) $maintenance->is_enabled,
            'title' => $maintenance->title,
            'message' => $maintenance->message,
            'expected_minutes' => $maintenance->expected_minutes !== null ? (int) $maintenance->expected_minutes : null,
            'activated_at' => optional($maintenance->activated_at)->toISOString(),
            'ended_at' => optional($maintenance->ended_at)->toISOString(),
        ];
    }

    private function chatMessageContent(Message $message): string
    {
        $content = trim((string) $message->content);

        if ($content === '') {
            return '';
        }

        $decoded = json_decode($content, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            foreach (['reply', 'content', 'message', 'text', 'answer'] as $key) {
                if (isset($decoded[$key])) {
                    $value = trim((string) $decoded[$key]);
                    if ($value !== '') {
                        return $value;
                    }
                }
            }

            $flattened = trim(collect($decoded)->flatten()->implode(' '));
            if ($flattened !== '') {
                return $flattened;
            }
        }

        if (strtolower((string) $message->role) !== 'ai') {
            return $content;
        }

        if ($content !== '') {
            return $content;
        }

        return '';
    }

    private function chatMessageExcerpt(Message $message, int $limit = 120): string
    {
        return Str::of($this->chatMessageContent($message))
            ->replaceMatches('/\s+/u', ' ')
            ->trim()
            ->limit($limit)
            ->toString();
    }

    /**
     * API: جلب المستخدمين النشطين (للـ polling في لوحة الإدارة)
     */
    public function getOnlineUsers(Request $request)
    {
        $request->session()->save(); // Release session lock
        $minutes = max(1, (int) ($request->input('minutes', 30)));
        $threshold = now()->subMinutes($minutes)->timestamp;

        $userIds = User::whereNotNull('last_seen_at')
            ->where('last_seen_at', '>=', now()->subMinutes($minutes)->toDateTimeString())
            ->pluck('id')
            ->all();

        if (empty($userIds)) {
            return response()->json([
                'online_users' => [],
                'active_students_now' => 0,
                'active_admins_now' => 0,
                'total_online' => 0,
            ]);
        }

        $users = User::whereIn('id', $userIds)
            ->select('id', 'name', 'email', 'role', 'major_id', 'study_plan_version', 'last_seen_at')
            ->with(['major:id,name,college_id'])
            ->get();

        // eager load course relations to compute hours without N+1 queries
        $users->loadMissing(['cartCourses:id,credit_hours', 'passedCourses:id,credit_hours']);

        // Fix N+1: fetch approved plans for these users in bulk
        $approvedPlansUserIds = DB::table('graduation_plans')
            ->whereIn('user_id', $userIds)
            ->pluck('user_id')
            ->toArray();

        $payload = $users->map(function (User $u) use ($approvedPlansUserIds) {
            $lastActivityStr = $u->last_seen_at;

            $cartHours = (int) $u->cartCourses->sum('credit_hours');
            $cartCount = (int) $u->cartCourses->count();
            $passedHours = (int) $u->passedCourses->sum('credit_hours');
            $approvedPlan = in_array($u->id, $approvedPlansUserIds, true);

            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'major' => $u->major ? ['id' => $u->major->id, 'name' => $u->major->name, 'college_id' => $u->major->college_id] : null,
                'study_plan_version' => (int) ($u->study_plan_version ?? 0),
                'cart_count' => $cartCount,
                'cart_hours' => $cartHours,
                'passed_hours' => $passedHours,
                'has_approved_plan' => $approvedPlan,
                'last_activity' => $lastActivityStr ? strtotime($lastActivityStr) : null,
                'last_activity_ago' => $lastActivityStr ? \Carbon\Carbon::parse($lastActivityStr)->diffForHumans() : null,
            ];
        })->sortByDesc('last_activity')->values();

        $activeStudentsNow = $payload->where('role', 'student')->count();
        $activeAdminsNow = $payload->where('role', 'admin')->count();

        return response()->json([
            'online_users' => $payload,
            'active_students_now' => $activeStudentsNow,
            'active_admins_now' => $activeAdminsNow,
            'total_online' => $payload->count(),
        ]);
    }

    /**
     * API: تحديث last_activity للمستخدم الحالي
     */
    public function updateLastActivity()
    {
        if (Auth::check()) {
            User::where('id', Auth::id())->update(['last_seen_at' => now()]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * API: تسجيل إغلاق التبويب/النافذة
     */
    public function handleBrowserClose()
    {
        if (Auth::check()) {
            DB::table('sessions')
                ->where('user_id', Auth::id())
                ->delete();
        }

        return response()->json(['ok' => true]);
    }

    /**
     * API: جلب التسجيلات الجديدة لنظام الإشعارات الذكي في لوحة الأدمن.
     * يستقبل since_id ويرجع فقط التسجيلات الأحدث.
     */
    public function getNewRegistrations(Request $request)
    {
        $request->session()->save(); // Release session lock
        $sinceId = (int) $request->query('since_id', 0);

        $query = AdminLog::with('user:id,name,email,role')
            ->where('action', 'NEW_USER_REGISTERED')
            ->latest();

        if ($sinceId > 0) {
            $query = AdminLog::with('user:id,name,email,role')
                ->where('action', 'NEW_USER_REGISTERED')
                ->where('id', '>', $sinceId)
                ->orderBy('id', 'asc');
        }

        $registrations = $query->take(10)->get();

        return response()->json([
            'registrations' => $registrations,
            'count' => $registrations->count(),
        ]);
    }

    /**
     * عرض قائمة المواد - مع إرسال الهيكلة الأكاديمية كاملة للفلترة
     */
    public function index()
    {
        return Inertia::render('Admin/Index', [
            'courses' => Course::where('is_quiz_only', false)->with(['major', 'prerequisites'])->latest()->get(),
            // 🔥 تم إزالة universities بناءً على طلبك 🔥
            'colleges' => College::select('id', 'name')->orderBy('name')->get(),
            'majors' => Major::select('id', 'name', 'code', 'college_id')->orderBy('name')->get(),
            'logs' => AdminLog::with('user')->latest()->take(50)->get()
        ]);
    }

    /**
     * صفحة مستقلة لإدارة الكليات والتخصصات
     */
    public function structure()
    {
        return Inertia::render('Admin/Structure', [
            'platform' => [
                'colleges_count' => College::count(),
                'majors_count' => Major::count(),
            ],
            'colleges' => College::select('id', 'name')->orderBy('name')->get(),
            'majors' => Major::select('id', 'name', 'code', 'college_id')->orderBy('name')->get(),
        ]);
    }

    /**
     * صفحة مستقلة لسجل عمليات الإدارة
     */
    public function logs()
    {
        return Inertia::render('Admin/Logs', [
            'logs' => AdminLog::with('user:id,name,email')->select('*')->latest()->take(200)->get(),
            'loginLogs' => AdminLog::with('user:id,name,email,role')
                ->whereIn('action', ['USER_LOGIN', 'تسجيل دخول'])
                ->latest()
                ->take(120)
                ->get(),
        ]);
    }

    /**
     * API endpoint for polling owner-only logs (JSON).
     */

    /**
     * تنفيذ تفريغ كاش النظام بأوامر Artisan بشكل آمن.
     */
    public function clearCache(Request $request)
    {
        $actor = Auth::user();

        try {
            Artisan::call('optimize:clear');
            Artisan::call('config:cache');

            $warning = null;
            try {
                Artisan::call('route:cache');
            } catch (\Throwable $routeCacheError) {
                // Route cache can fail when any route uses a Closure; keep the system operational.
                Artisan::call('route:clear');
                $warning = 'Route cache was skipped because closure-based routes are present.';

                Log::warning('Route cache skipped during clear-cache operation', [
                    'user_id' => Auth::id(),
                    'error' => $routeCacheError->getMessage(),
                ]);
            }

            $details = "تم تنفيذ تفريغ كاش النظام بواسطة {$actor?->name} ({$actor?->email})";
            if ($warning) {
                $details .= ' - تم تجاوز route:cache بسبب وجود Closure routes.';
            }

            $this->logAction('CLEAR_SYSTEM_CACHE', $details);

            return response()->json([
                'success' => true,
                'message' => $warning
                    ? 'System cache cleared successfully (route cache skipped).'
                    : 'System cache cleared successfully',
                'warning' => $warning,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to clear system cache', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to clear system cache. Please try again.',
            ], 500);
        }
    }

    // =========================================================
    // 🔥 الدوال الجديدة لإضافة الكليات والتخصصات من لوحة التحكم 🔥
    // =========================================================

    public function storeCollege(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:colleges,name',
        ]);

        $college = College::create($validated);
        $this->logAction('ADD_COLLEGE', "تم إضافة كلية جديدة: {$college->name}");

        return redirect()->back()->with('success', 'تم إضافة الكلية بنجاح! 🏛️');
    }

    public function updateCollege(Request $request, College $college)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:colleges,name,' . $college->id,
        ]);

        $college->update($validated);
        $this->logAction('UPDATE_COLLEGE', "تم تحديث الكلية: {$college->name}");

        return redirect()->back()->with('success', 'تم تحديث الكلية بنجاح!');
    }

    public function destroyCollege(College $college)
    {
        $name = $college->name;
        $college->delete();
        $this->logAction('DELETE_COLLEGE', "تم حذف الكلية: {$name}");

        return redirect()->back()->with('success', 'تم حذف الكلية بنجاح!');
    }

    public function storeMajor(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|unique:majors,code',
            'college_id' => 'required|exists:colleges,id',
        ]);

        $major = Major::create($validated);
        $this->logAction('ADD_MAJOR', "تم إضافة تخصص جديد: {$major->name} ({$major->code})");

        return redirect()->back()->with('success', 'تم إضافة التخصص بنجاح! 🎓');
    }

    public function updateMajor(Request $request, Major $major)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|unique:majors,code,' . $major->id,
            'college_id' => 'required|exists:colleges,id',
        ]);

        $major->update($validated);
        $this->logAction('UPDATE_MAJOR', "تم تحديث التخصص: {$major->name}");

        return redirect()->back()->with('success', 'تم تحديث التخصص بنجاح!');
    }

    public function destroyMajor(Major $major)
    {
        $name = $major->name;
        $major->delete();
        $this->logAction('DELETE_MAJOR', "تم حذف التخصص: {$name}");

        return redirect()->back()->with('success', 'تم حذف التخصص بنجاح!');
    }

    // =========================================================
    // الدوال الخاصة بالمواد الدراسية
    // =========================================================

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'code'            => [
                'required',
                'string',
                Rule::unique('courses')->where(function ($query) use ($request) {
                    $majorId = $request->input('major_id');

                    $query->where('study_plan_version', (int) $request->input('study_plan_version'));

                    if (empty($majorId)) {
                        $query->whereNull('major_id');
                    } else {
                        $query->where('major_id', $majorId);
                    }
                }),
            ],
            'credit_hours'    => 'required|integer',
            'difficulty_level' => 'nullable|integer|min:1|max:5',
            'minimum_passed_hours' => 'nullable|integer|min:1|max:200',
            'type'            => 'required|in:compulsory,elective,supporting,university_req',
            'major_id'        => 'nullable|exists:majors,id',
            'study_plan_version' => 'required|integer|in:11,12',
            'semester'        => 'required|integer|min:1|max:12',
            'prerequisite_id' => 'nullable|integer|exists:courses,id',
            'prerequisite_ids' => 'nullable|array',
            'prerequisite_ids.*' => 'integer|exists:courses,id',
            'description'     => 'nullable|string',
        ]);

        $prerequisiteIds = $validated['prerequisite_ids'] ?? [];
        if (!empty($validated['prerequisite_id'])) {
            $prerequisiteIds[] = $validated['prerequisite_id'];
        }
        $prerequisiteIds = collect($prerequisiteIds)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($prerequisiteIds->isNotEmpty()) {
            $prerequisites = Course::whereIn('id', $prerequisiteIds)->get(['id', 'major_id', 'study_plan_version']);

            foreach ($prerequisites as $prerequisite) {
                if ($prerequisite->major_id != $validated['major_id'] || (int) $prerequisite->study_plan_version !== (int) $validated['study_plan_version']) {
                    return redirect()->back()->withErrors([
                        'prerequisite_ids' => 'المتطلبات السابقة يجب أن تكون من نفس التخصص ونفس رقم الخطة.',
                    ])->withInput();
                }
            }
        }

        $course = Course::create([
            'name'         => $validated['name'],
            'code'         => $validated['code'],
            'credit_hours' => $validated['credit_hours'],
            'difficulty_level' => $validated['difficulty_level'] ?? 3,
            'minimum_passed_hours' => $validated['minimum_passed_hours'] ?? null,
            'type'         => $validated['type'],
            'major_id'     => $validated['major_id'],
            'study_plan_version' => $validated['study_plan_version'],
            'semester'     => $validated['semester'],
            'description'  => $validated['description'],
        ]);

        if ($prerequisiteIds->isNotEmpty()) {
            $course->prerequisites()->attach($prerequisiteIds->all());
        }

        $this->logAction('ADD_COURSE', "تم إضافة المادة وربط المتطلب: {$course->name} ({$course->code})");
        TreeController::flushCourseTreeCache();
        return redirect()->back()->with('success', 'تم حفظ المادة بنجاح وتفعيل نظام المتطلبات! 🎉');
    }

    public function update(Request $request, Course $course)
    {
        $validated = $request->validate([
            'name'            => 'required|string',
            'code'            => [
                'required',
                'string',
                Rule::unique('courses')->ignore($course->id)->where(function ($query) use ($request) {
                    $majorId = $request->input('major_id');

                    $query->where('study_plan_version', (int) $request->input('study_plan_version'));

                    if (empty($majorId)) {
                        $query->whereNull('major_id');
                    } else {
                        $query->where('major_id', $majorId);
                    }
                }),
            ],
            'credit_hours'    => 'required|integer',
            'difficulty_level' => 'nullable|integer|min:1|max:5',
            'minimum_passed_hours' => 'nullable|integer|min:1|max:200',
            'type'            => 'required|in:compulsory,elective,supporting,university_req',
            'major_id'        => 'nullable|exists:majors,id',
            'study_plan_version' => 'required|integer|in:11,12',
            'semester'        => 'required|integer|min:1|max:12',
            'prerequisite_id' => 'nullable|integer|exists:courses,id',
            'prerequisite_ids' => 'nullable|array',
            'prerequisite_ids.*' => 'integer|exists:courses,id',
            'description'     => 'nullable|string',
        ]);

        $prerequisiteIds = $validated['prerequisite_ids'] ?? [];
        if (!empty($validated['prerequisite_id'])) {
            $prerequisiteIds[] = $validated['prerequisite_id'];
        }
        $prerequisiteIds = collect($prerequisiteIds)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($prerequisiteIds->contains((int) $course->id)) {
            return redirect()->back()->withErrors([
                'prerequisite_ids' => 'لا يمكن ربط المادة بنفسها كمتطلب.',
            ])->withInput();
        }

        if ($prerequisiteIds->isNotEmpty()) {
            $prerequisites = Course::whereIn('id', $prerequisiteIds)->get(['id', 'major_id', 'study_plan_version']);

            foreach ($prerequisites as $prerequisite) {
                if ($prerequisite->major_id != $validated['major_id'] || (int) $prerequisite->study_plan_version !== (int) $validated['study_plan_version']) {
                    return redirect()->back()->withErrors([
                        'prerequisite_ids' => 'المتطلبات السابقة يجب أن تكون من نفس التخصص ونفس رقم الخطة.',
                    ])->withInput();
                }
            }
        }

        $course->update([
            'name'         => $validated['name'],
            'code'         => $validated['code'],
            'credit_hours' => $validated['credit_hours'],
            'difficulty_level' => $validated['difficulty_level'] ?? 3,
            'minimum_passed_hours' => $validated['minimum_passed_hours'] ?? null,
            'type'         => $validated['type'],
            'major_id'     => $validated['major_id'],
            'study_plan_version' => $validated['study_plan_version'],
            'semester'     => $validated['semester'],
            'description'  => $validated['description'],
        ]);

        if ($prerequisiteIds->isNotEmpty()) {
            $course->prerequisites()->sync($prerequisiteIds->all());
        } else {
            $course->prerequisites()->detach(); 
        }

        $this->logAction('UPDATE_COURSE', "تم تعديل المادة: {$course->name}");
        TreeController::flushCourseTreeCache();
        return redirect()->back()->with('success', 'تم تعديل المادة بنجاح!');
    }

    public function destroy(Course $course)
    {
        $courseName = $course->name;
        DB::table('course_prerequisites')->where('course_id', $course->id)->orWhere('prerequisite_id', $course->id)->delete();
        $course->delete();

        $this->logAction('DELETE_COURSE', "تم حذف المادة: {$courseName}");
        TreeController::flushCourseTreeCache();
        return redirect()->back()->with('success', 'تم الحذف بنجاح');
    }

    public function bulkDelete(Request $request)
    {
        $ids = $request->input('ids');
        if (!empty($ids)) {
            $count = Course::whereIn('id', $ids)->delete();
            DB::table('course_prerequisites')->whereIn('course_id', $ids)->orWhereIn('prerequisite_id', $ids)->delete();
            $this->logAction('BULK_DELETE', "تم حذف $count مادة مع كافة علاقاتها الشجرية.");
            TreeController::flushCourseTreeCache();
            return redirect()->back()->with('success', "تم حذف المواد بنجاح.");
        }
        return redirect()->back()->with('error', 'لم يتم تحديد أي مادة.');
    }

    public function export()
    {
        $fileName = 'Academic_Tree_Plan_' . date('Y-m-d') . '.csv';
        return response()->streamDownload(function () {
            $handle = fopen('php://output', 'w');
            fputs($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Code', 'Name', 'Credits', 'Type', 'Major', 'Plan Version', 'Semester', 'Prerequisites', 'Description']);

            $courses = Course::with(['major', 'prerequisites'])->get();
            foreach ($courses as $course) {
                fputcsv($handle, [
                    $course->code, $course->name, $course->credit_hours, $course->type,
                    $course->major ? $course->major->name : 'متطلب جامعة عام',
                    $course->study_plan_version,
                    $course->semester,
                    $course->prerequisites->pluck('code')->implode(', '),
                    $course->description
                ]);
            }
            fclose($handle);
        }, $fileName);
    }

    private function normalizeCsvHeader(?string $header): string
    {
        $header = (string) $header;
        $header = preg_replace('/^\xEF\xBB\xBF/', '', $header);
        $header = trim($header);

        // Normalize to UTF-8 defensively to avoid regex failures on legacy CSV encodings.
        if (function_exists('mb_detect_encoding') && function_exists('mb_convert_encoding')) {
            $detected = mb_detect_encoding($header, ['UTF-8', 'Windows-1256', 'ISO-8859-1', 'Windows-1252'], true);
            if ($detected && $detected !== 'UTF-8') {
                $header = mb_convert_encoding($header, 'UTF-8', $detected);
            }
        }

        if (function_exists('mb_strtolower')) {
            try {
                $header = mb_strtolower($header, 'UTF-8');
            } catch (\Throwable $e) {
                $header = strtolower($header);
            }
        } else {
            $header = strtolower($header);
        }

        $header = preg_replace('/[\s\-\.\/\\]+/u', '_', $header) ?? $header;
        $header = preg_replace('/[^\p{L}\p{N}_]+/u', '', $header) ?? $header;
        $header = preg_replace('/_+/u', '_', $header) ?? $header;

        return trim((string) $header, '_');
    }

    private function normalizeCsvText(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (function_exists('mb_detect_encoding') && function_exists('mb_convert_encoding')) {
            $detected = mb_detect_encoding($value, ['UTF-8', 'Windows-1256', 'ISO-8859-1', 'Windows-1252'], true);
            if ($detected && $detected !== 'UTF-8') {
                $value = mb_convert_encoding($value, 'UTF-8', $detected);
            }
        }

        if (function_exists('mb_check_encoding') && !mb_check_encoding($value, 'UTF-8')) {
            if (function_exists('iconv')) {
                $converted = @iconv('Windows-1256', 'UTF-8//IGNORE', $value);
                if ($converted !== false) {
                    $value = $converted;
                }
            }
        }

        return trim($value);
    }

    private function findCsvHeaderIndex(array $normalizedHeaders, array $aliases): int
    {
        $aliases = array_map(fn ($alias) => $this->normalizeCsvHeader($alias), $aliases);

        foreach ($normalizedHeaders as $idx => $header) {
            foreach ($aliases as $alias) {
                if ($alias === '') {
                    continue;
                }

                if ($header === $alias || str_contains($header, $alias)) {
                    return $idx;
                }
            }
        }

        return -1;
    }

    private function detectCsvColumns(array $headers): array
    {
        $normalizedHeaders = array_map(fn ($h) => $this->normalizeCsvHeader((string) $h), $headers);

        return [
            'code' => $this->findCsvHeaderIndex($normalizedHeaders, ['course_code', 'course_id', 'code', 'رمز_المادة', 'رمز']),
            'name' => $this->findCsvHeaderIndex($normalizedHeaders, ['course_name', 'course_na', 'name', 'اسم_المادة', 'اسم']),
            'credit_hours' => $this->findCsvHeaderIndex($normalizedHeaders, ['credit_hours', 'credits', 'credit', 'hours', 'عدد_الساعات', 'الساعات']),
            'type' => $this->findCsvHeaderIndex($normalizedHeaders, ['type', 'group_title', 'group_ti', 'course_type', 'نوع']),
            'category' => $this->findCsvHeaderIndex($normalizedHeaders, ['category', 'classification', 'class', 'track', 'الفئة', 'التصنيف', 'مسار']),
            'delivery_mode' => $this->findCsvHeaderIndex($normalizedHeaders, ['delivery_mode', 'delivery', 'mode', 'teaching_mode', 'study_mode', 'طريقة_التدريس', 'نمط_التدريس']),
            'prerequisites' => $this->findCsvHeaderIndex($normalizedHeaders, ['prerequisites', 'prerequisite', 'prereq', 'pre_req', 'prerequisite_codes', 'المتطلبات_السابقة', 'المتطلبات', 'متطلب_سابق']),
            'semester' => $this->findCsvHeaderIndex($normalizedHeaders, ['semester', 'level', 'term', 'study_level', 'الفصل', 'المستوى']),
            'description' => $this->findCsvHeaderIndex($normalizedHeaders, ['description', 'desc', 'notes', 'note', 'وصف', 'ملاحظات']),
            'minimum_passed_hours' => $this->findCsvHeaderIndex($normalizedHeaders, ['minimum_passed_hours', 'min_passed_hours', 'minimum_hours', 'hours_required', 'شرط_الساعات', 'الساعات_المجتازة_المطلوبة']),
        ];
    }

    private function getCsvCell(array $row, int $index): string
    {
        if ($index < 0 || !array_key_exists($index, $row)) {
            return '';
        }

        return $this->normalizeCsvText((string) $row[$index]);
    }

    private function parseCsvInteger(string $value, ?int $default = null, ?int $min = null, ?int $max = null): ?int
    {
        $value = trim($value);
        if ($value === '') {
            return $default;
        }

        if (preg_match('/-?\d+/', $value, $matches) !== 1) {
            return $default;
        }

        $parsed = (int) $matches[0];

        if ($min !== null && $parsed < $min) {
            return $default;
        }

        if ($max !== null && $parsed > $max) {
            return $default;
        }

        return $parsed;
    }

    private function mapImportedCourseType(string $rawType, string $rawCategory, string $rawDeliveryMode): string
    {
        $normalize = function (string $value): string {
            $value = trim($value);

            if (function_exists('mb_strtolower')) {
                try {
                    return mb_strtolower($value, 'UTF-8');
                } catch (\Throwable $e) {
                    return strtolower($value);
                }
            }

            return strtolower($value);
        };

        $type = $normalize($rawType);
        $category = $normalize($rawCategory);
        $deliveryMode = $normalize($rawDeliveryMode);
        $combined = trim($type . ' ' . $category);

        $containsAny = function (string $haystack, array $needles): bool {
            foreach ($needles as $needle) {
                if ($needle !== '' && str_contains($haystack, $needle)) {
                    return true;
                }
            }

            return false;
        };

        if ($containsAny($combined, ['اختياري', 'elective', 'optional'])) {
            return 'elective';
        }

        if ($containsAny($combined, ['مساند', 'supporting'])) {
            return 'supporting';
        }

        if ($containsAny($combined, ['جامعة', 'جامعي', 'university', 'general_requirement', 'gen_ed'])) {
            return 'university_req';
        }

        if (
            $containsAny($deliveryMode, ['الكترون', 'إلكترون', 'online', 'e-learning', 'distance']) &&
            $containsAny($combined, ['متطلب', 'requirement', 'req', 'اجباري', 'إجباري', 'mandatory', 'required'])
        ) {
            return 'university_req';
        }

        return 'compulsory';
    }

    private function cleanCourseCode(string $rawCode): string
    {
        return trim($rawCode, " \t\n\r\0\x0B\"'");
    }

    public function import(Request $request)
    {
        try {
            $request->validate([
                'csv_file' => 'nullable|file|mimes:csv,txt|max:10240',
                'rows_payload' => 'nullable|array',
                'major_id' => 'required|exists:majors,id',
                'study_plan_version' => 'required|integer|in:11,12',
            ]);

            $file = $request->file('csv_file');
            $rowsPayload = $request->input('rows_payload', []);
            $selectedMajorId = $request->input('major_id');
            $selectedPlanVersion = (int) $request->input('study_plan_version');

            $hasRowsPayload = is_array($rowsPayload) && count($rowsPayload) > 0;
            if (!$file && !$hasRowsPayload) {
                return redirect()->back()->with([
                    'type' => 'error',
                    'message' => 'لم يتم إرسال ملف CSV أو بيانات معاينة للحفظ.',
                ]);
            }

            $filePath = null;
            if ($file) {
                $filePath = $file->store('imports');
            }

            \App\Jobs\ProcessCourseImport::dispatch(
                $filePath,
                $hasRowsPayload ? $rowsPayload : null,
                $selectedMajorId,
                $selectedPlanVersion,
                auth()->id()
            );

            $this->logAction('IMPORT_COURSES_QUEUED', "Queued course import for major ID {$selectedMajorId}, plan {$selectedPlanVersion}");

            return redirect()->back()->with([
                'type' => 'success',
                'message' => 'تم وضع عملية استيراد الكورسات في طابور المعالجة (Background Job). سيتم تنفيذها قريباً لتجنب استهلاك موارد الخادم. يمكنك التحقق من سجل النظام لاحقاً.',
            ]);

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Course import completely failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->with([
                'type' => 'error',
                'message' => 'حدث خطأ قاتل أثناء محاولة إرسال الاستيراد للطابور: ' . $e->getMessage(),
            ]);
        }
    }

    /**
     * 🔥 دالة تقرير المواد الأكثر طلباً 🔥
     */
    public function demandReport(Request $request)
    {
        $currentPeriod = AcademicPeriod::current();
        $periodYear = $currentPeriod?->academic_year;
        $periodTerm = $currentPeriod?->academic_term;
        $hasPeriodColumns = true;

        $courseDemand = Course::whereHas('cartUsers', function ($query) use ($periodYear, $periodTerm, $hasPeriodColumns) {
            if ($periodYear && $periodTerm && $hasPeriodColumns) {
                $query->where('user_carts.academic_year', $periodYear)
                    ->where('user_carts.academic_term', $periodTerm);
            }
        })
            ->when($request->college_id, function ($query, $collegeId) {
                $query->whereHas('major', function ($q) use ($collegeId) {
                    $q->where('college_id', $collegeId);
                });
            })
            ->when($request->major_id, function ($query, $majorId) {
                $query->where('major_id', $majorId);
            })
            ->withCount(['cartUsers as cart_users_count' => function ($query) use ($periodYear, $periodTerm, $hasPeriodColumns) {
                if ($periodYear && $periodTerm && $hasPeriodColumns) {
                    $query->where('user_carts.academic_year', $periodYear)
                        ->where('user_carts.academic_term', $periodTerm);
                }
            }])
            ->get()
            ->groupBy(function($course) {
                $name = mb_strtolower(trim($course->name));
                $name = preg_replace('/\s+/u', '', $name);
                $name = str_replace(['أ', 'إ', 'آ'], 'ا', $name);
                $name = str_replace('ة', 'ه', $name);
                $name = str_replace('ى', 'ي', $name);
                return $name;
            })
            ->map(function($group) {
                $first = $group->first();
                $first->cart_users_count = $group->sum('cart_users_count');
                // Optional: set a preferred name format (the one with spaces if exists)
                $bestNameCourse = $group->sortByDesc(fn($c) => strlen($c->name))->first();
                $first->name = $bestNameCourse->name;
                return $first;
            })
            ->sortByDesc('cart_users_count')
            ->take(15) 
            ->values();

        $colleges = College::select('id', 'name')->get();
        $majors = Major::select('id', 'name', 'college_id')->get();

        // 🔥 تعديل جوهري: حساب إجمالي الطلاب "النشطين" (الذين لديهم مواد في التسجيل التجريبي) فقط
        // هذا يمنع ظهور نسبة 0% إذا كان هناك طلاب مسجلين ولكن لم يستخدموا التسجيل التجريبي بعد.
        $totalStudents = User::whereHas('cartCourses', function ($query) use ($periodYear, $periodTerm, $hasPeriodColumns) {
            if ($periodYear && $periodTerm && $hasPeriodColumns) {
                $query->where('user_carts.academic_year', $periodYear)
                    ->where('user_carts.academic_term', $periodTerm);
            }
        })->count();

        return Inertia::render('Admin/Reports/Demand', [
            'courseDemand' => $courseDemand,
            'colleges' => $colleges,
            'majors' => $majors,
            'filters' => $request->only(['college_id', 'major_id']),
            'totalStudents' => $totalStudents
        ]);
    }
}