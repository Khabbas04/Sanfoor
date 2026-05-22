<?php

namespace App\Http\Controllers;

use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\Major;
use App\Models\College;
use App\Models\User;
use App\Models\AdminLog;
use App\Models\AdminNote;
use App\Models\IssueReport;
use App\Models\Chapter;
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
            'ip_address' => request()->ip()
        ]);
    }

    /**
     * لوحة المعلومات الإحصائية + تقارير المواد الأكثر طلباً
     */
    public function dashboard()
    {
        $today = now()->toDateString();
        $notesEnabled = Schema::hasTable('admin_notes');

        $demandReport = Course::whereHas('cartUsers') 
            ->withCount('cartUsers')
            ->orderBy('cart_users_count', 'desc')
            ->take(10)
            ->get();

        $issueSummary = [
            'open' => IssueReport::where('status', 'open')->count(),
            'in_progress' => IssueReport::where('status', 'in_progress')->count(),
            'resolved' => IssueReport::where('status', 'resolved')->count(),
            'total' => IssueReport::count(),
        ];

        // 🔥 حساب النشطين حالياً (آخر 30 دقيقة)
        $thirtyMinutesAgo = now()->subMinutes(30)->timestamp;
        
        $activeStudentIds = DB::table('sessions')
            ->whereIn('user_id', User::where('role', 'student')->pluck('id'))
            ->where('last_activity', '>=', $thirtyMinutesAgo)
            ->distinct('user_id')
            ->pluck('user_id');
        
        $activeAdminIds = DB::table('sessions')
            ->whereIn('user_id', User::whereRaw('LOWER(role) = ?', ['admin'])->pluck('id'))
            ->where('last_activity', '>=', $thirtyMinutesAgo)
            ->distinct('user_id')
            ->pluck('user_id');

        // 🔥 الحصول على قائمة المستخدمين النشطين مع تفاصيلهم
        $onlineUsers = DB::table('sessions as s')
            ->join('users as u', 's.user_id', '=', 'u.id')
            ->select('u.id', 'u.name', 'u.email', 'u.role', 's.last_activity')
            ->where('s.last_activity', '>=', $thirtyMinutesAgo)
            ->orderByDesc('s.last_activity')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'last_activity_ago' => \Carbon\Carbon::createFromTimestamp($user->last_activity)->diffForHumans(),
                ];
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

        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'students_count' => User::where('role', 'student')->count(),
                'active_students_now' => $activeStudentIds->count(),
                'admins_count' => User::whereRaw('LOWER(role) = ?', ['admin'])->count(),
                'active_admins_now' => $activeAdminIds->count(),
                'owners_count' => User::whereRaw('LOWER(role) = ?', ['owner'])->count(),
                'courses_count' => Course::where('is_quiz_only', false)->count(),
                'compulsory_count' => Course::where('is_quiz_only', false)->where('type', 'compulsory')->count(),
                'elective_count' => Course::where('is_quiz_only', false)->where('type', 'elective')->count(),
                // Quizzes & Chapters System Stats
                'quiz_courses_count' => Course::where('is_quiz_only', true)->count(),
                'chapters_count' => Chapter::count(),
                'questions_count' => Question::count(),
                'quiz_attempts_count' => QuizAttempt::count(),
                'quiz_avg_score' => round(QuizAttempt::avg('score_percentage') ?? 0),
            ],
            'onlineUsers' => $onlineUsers,
            'platform' => [
                'colleges_count' => College::count(),
                'majors_count' => Major::count(),
            ],
            'colleges' => College::select('id', 'name')->orderBy('name')->get(),
            'majors' => Major::select('id', 'name', 'code', 'college_id')->orderBy('name')->get(),
            'demandReport' => $demandReport,
            'issueSummary' => $issueSummary,
            'recentIssues' => IssueReport::with('user:id,name,email')->latest()->take(6)->get(),
            'logs' => AdminLog::with('user:id,name,email')->where('owner_only', false)->latest()->take(25)->get(),
            'ownerLogs' => Auth::user() && Auth::user()->isOwner() ? AdminLog::with('user:id,name,email')->where('owner_only', true)->latest()->take(200)->get() : collect(),
            'adminNotes' => $adminNotes,
            'myAdminNote' => $myAdminNote,
            'notesEnabled' => $notesEnabled,
        ]);
    }

    /**
     * حفظ ملاحظة الأدمن اليومية.
     */
    public function storeAdminNote(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isAdminOrOwner(), 403);

        if (!Schema::hasTable('admin_notes')) {
            return redirect()->back()->with([
                'message' => 'جدول الملاحظات غير موجود. شغّل migrate لتفعيل الملاحظات.',
                'type' => 'error',
            ]);
        }

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
        $thirtyMinutesAgo = now()->subMinutes(30)->timestamp;

        $onlineUsers = DB::table('sessions as s')
            ->join('users as u', 's.user_id', '=', 'u.id')
            ->select('u.id', 'u.name', 'u.email', 'u.role', 's.last_activity')
            ->whereNotNull('s.user_id')
            ->where('s.last_activity', '>=', $thirtyMinutesAgo)
            ->orderByDesc('s.last_activity')
            ->get()
            ->unique('id')
            ->values()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'last_activity_ago' => \Carbon\Carbon::createFromTimestamp((int) $user->last_activity)->diffForHumans(),
                ];
            });

        $activeStudentsNow = $onlineUsers->where('role', 'student')->count();
        $activeAdminsNow = $onlineUsers->filter(function ($u) {
            return strtolower((string) $u['role']) === 'admin';
        })->count();

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
            'stats' => [
                'students_count' => User::where('role', 'student')->count(),
                'admins_count' => User::whereRaw('LOWER(role) = ?', ['admin'])->count(),
                'active_students_now' => $activeStudentsNow,
                'active_admins_now' => $activeAdminsNow,
            ],
            'onlineUsers' => $onlineUsers,
        ]);
    }

    /**
     * Update the globally visible academic period.
     */
    public function updateAcademicPeriod(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isAdminOrOwner(), 403);

        if (!Schema::hasTable('academic_periods')) {
            return redirect()->back()->with([
                'message' => 'جدول الفصول الأكاديمية غير موجود. شغّل migrate أولاً.',
                'type' => 'error',
            ]);
        }

        $validated = $request->validate([
            'academic_year' => ['required', 'string', 'max:20'],
            'academic_term' => ['required', 'integer', 'in:1,2,3'],
            'label' => ['nullable', 'string', 'max:255'],
        ]);

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

        if (!Schema::hasTable('site_maintenance')) {
            return redirect()->back()->with([
                'message' => 'جدول الصيانة غير موجود. شغّل migrate أولاً.',
                'type' => 'error',
            ]);
        }

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

    /**
     * API: جلب المستخدمين النشطين (للـ polling في لوحة الإدارة)
     */
    public function getOnlineUsers()
    {
        $thirtyMinutesAgo = now()->subMinutes(30)->timestamp;

        $onlineUsers = DB::table('sessions as s')
            ->join('users as u', 's.user_id', '=', 'u.id')
            ->select('u.id', 'u.name', 'u.email', 'u.role', 's.last_activity')
            ->whereNotNull('s.user_id')
            ->where('s.last_activity', '>=', $thirtyMinutesAgo)
            ->orderByDesc('s.last_activity')
            ->get()
            ->unique('id')
            ->values()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'last_activity_ago' => \Carbon\Carbon::createFromTimestamp((int) $user->last_activity)->diffForHumans(),
                ];
            });

        $activeStudentsNow = $onlineUsers->where('role', 'student')->count();
        $activeAdminsNow = $onlineUsers->filter(function ($u) {
            return strtolower((string) $u['role']) === 'admin';
        })->count();

        return response()->json([
            'online_users' => $onlineUsers,
            'active_students_now' => $activeStudentsNow,
            'active_admins_now' => $activeAdminsNow,
            'total_online' => $onlineUsers->count(),
        ]);
    }

    /**
     * API: تحديث last_activity للمستخدم الحالي
     */
    public function updateLastActivity()
    {
        if (Auth::check()) {
            DB::table('sessions')
                ->where('user_id', Auth::id())
                ->update(['last_activity' => now()->timestamp]);
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
     * عرض قائمة المواد - مع إرسال الهيكلة الأكاديمية كاملة للفلترة
     */
    public function index()
    {
        return Inertia::render('Admin/Index', [
            'courses' => Course::where('is_quiz_only', false)->with(['major', 'prerequisites'])->latest()->get(),
            // 🔥 تم إزالة universities بناءً على طلبك 🔥
            'colleges' => College::all(),
            'majors' => Major::all(),
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
                ->where('action', 'USER_LOGIN')
                ->latest()
                ->take(120)
                ->get(),
        ]);
    }

    /**
     * Owner-only page that shows owner logs.
     */
    public function ownerLogsPage()
    {
        $user = Auth::user();
        abort_unless($user && $user->isOwner(), 403);

        return Inertia::render('Admin/OwnerLogs', [
            'ownerLogs' => AdminLog::with('user:id,name,email')->where('owner_only', true)->latest()->take(200)->get(),
            'logs' => AdminLog::with('user:id,name,email')->where('owner_only', false)->latest()->take(200)->get(),
        ]);
    }

    /**
     * API endpoint for polling owner-only logs (JSON).
     */
    public function apiOwnerLogs(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isOwner(), 403);

        $sinceId = (int) $request->query('since_id', 0);

        $query = AdminLog::with('user:id,name,email')->where('owner_only', true)->latest();
        if ($sinceId > 0) {
            // return logs newer than since_id (by id)
            $query = AdminLog::with('user:id,name,email')->where('owner_only', true)->where('id', '>', $sinceId)->orderBy('id', 'asc');
        }

        $logs = $query->take(200)->get();

        return response()->json(['logs' => $logs]);
    }

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
            $count = 0;
            $importedCourseIds = [];
            $prerequisitesMap = [];
            $skippedRows = [];

            $hasRowsPayload = is_array($rowsPayload) && count($rowsPayload) > 0;
            if (!$file && !$hasRowsPayload) {
                return redirect()->back()->with([
                    'type' => 'error',
                    'message' => 'لم يتم إرسال ملف CSV أو بيانات معاينة للحفظ.',
                ]);
            }

            $normalizedRows = [];

            if ($hasRowsPayload) {
                foreach ($rowsPayload as $idx => $row) {
                    if (!is_array($row)) {
                        continue;
                    }

                    $normalizedRows[] = [
                        'line' => (int) ($idx + 1),
                        'code' => $this->cleanCourseCode($this->normalizeCsvText((string) ($row['code'] ?? ''))),
                        'name' => $this->normalizeCsvText((string) ($row['name'] ?? '')),
                        'credit_hours' => $this->parseCsvInteger((string) ($row['credit_hours'] ?? ''), 3, 0, 12) ?? 3,
                        'raw_type' => $this->normalizeCsvText((string) ($row['type'] ?? '')),
                        'raw_category' => $this->normalizeCsvText((string) ($row['category'] ?? '')),
                        'raw_delivery_mode' => $this->normalizeCsvText((string) ($row['delivery_mode'] ?? '')),
                        'mapped_type' => $this->normalizeCsvText((string) ($row['mappedType'] ?? '')),
                        'prerequisites' => $this->normalizeCsvText((string) ($row['prerequisites'] ?? '')),
                        'semester' => $this->parseCsvInteger((string) ($row['semester'] ?? ''), 1, 1, 12) ?? 1,
                        'description' => $this->normalizeCsvText((string) ($row['description'] ?? '')),
                        'minimum_passed_hours' => $this->parseCsvInteger((string) ($row['minimum_passed_hours'] ?? ''), null, 1, 200),
                    ];
                }
            } else {
                if (($handle = fopen($file->getPathname(), 'r')) === false) {
                    return redirect()->back()->with([
                        'type' => 'error',
                        'message' => 'تعذر قراءة ملف CSV. تأكد من إعادة التصدير بصيغة CSV UTF-8.',
                    ]);
                }

                $headers = fgetcsv($handle);
                if ($headers === false || count($headers) === 0) {
                    fclose($handle);
                    return redirect()->back()->with([
                        'type' => 'error',
                        'message' => 'الملف لا يحتوي على ترويسة أعمدة صالحة.',
                    ]);
                }

                $columnIndexes = $this->detectCsvColumns($headers);
                if ($columnIndexes['code'] === -1 || $columnIndexes['name'] === -1) {
                    fclose($handle);
                    return redirect()->back()->with([
                        'type' => 'error',
                        'message' => 'خطأ: لم يتم العثور على أعمدة رمز المادة واسمها في الترويسة!',
                    ]);
                }

                while (($row = fgetcsv($handle)) !== false) {
                    $normalizedRows[] = [
                        'line' => (int) ($count + 2),
                        'code' => $this->cleanCourseCode($this->getCsvCell($row, $columnIndexes['code'])),
                        'name' => $this->getCsvCell($row, $columnIndexes['name']),
                        'credit_hours' => $this->parseCsvInteger($this->getCsvCell($row, $columnIndexes['credit_hours']), 3, 0, 12) ?? 3,
                        'raw_type' => $this->getCsvCell($row, $columnIndexes['type']),
                        'raw_category' => $this->getCsvCell($row, $columnIndexes['category']),
                        'raw_delivery_mode' => $this->getCsvCell($row, $columnIndexes['delivery_mode']),
                        'mapped_type' => '',
                        'prerequisites' => $this->getCsvCell($row, $columnIndexes['prerequisites']),
                        'semester' => $this->parseCsvInteger($this->getCsvCell($row, $columnIndexes['semester']), 1, 1, 12) ?? 1,
                        'description' => $this->getCsvCell($row, $columnIndexes['description']),
                        'minimum_passed_hours' => $this->parseCsvInteger($this->getCsvCell($row, $columnIndexes['minimum_passed_hours']), null, 1, 200),
                    ];
                    $count++;
                }
                fclose($handle);
                $count = 0;
            }

            foreach ($normalizedRows as $rowData) {
                try {
                    $code = $rowData['code'];
                    $name = $rowData['name'];

                    if ($code === '' && $name === '') {
                        continue;
                    }

                    if ($code === '' || $name === '') {
                        $skippedRows[] = [
                            'line' => $rowData['line'] ?? null,
                            'reason' => 'رمز المادة أو اسم المادة مفقود.',
                        ];
                        continue;
                    }

                    $credits = $rowData['credit_hours'];
                    $rawType = $rowData['raw_type'];
                    $rawCategory = $rowData['raw_category'];
                    $rawDeliveryMode = $rowData['raw_delivery_mode'];

                    $mappedType = $rowData['mapped_type'];
                    $type = in_array($mappedType, ['compulsory', 'elective', 'supporting', 'university_req'], true)
                        ? $mappedType
                        : $this->mapImportedCourseType($rawType, $rawCategory, $rawDeliveryMode);

                    $semester = $rowData['semester'];
                    $description = $rowData['description'];
                    $minimumPassedHours = $rowData['minimum_passed_hours'];

                    $updatePayload = [
                        'name' => $name,
                        'credit_hours' => $credits,
                        'semester' => $semester,
                        'type' => $type,
                        'major_id' => $selectedMajorId,
                        'study_plan_version' => $selectedPlanVersion,
                    ];

                    $updatePayload['description'] = $description !== '' ? $description : null;
                    $updatePayload['minimum_passed_hours'] = $minimumPassedHours;

                    $course = Course::updateOrCreate(
                        [
                            'code' => $code,
                            'major_id' => $selectedMajorId,
                            'study_plan_version' => $selectedPlanVersion,
                        ],
                        $updatePayload
                    );

                    $importedCourseIds[] = $course->id;

                    $prereqRaw = $rowData['prerequisites'];
                    if ($prereqRaw !== '') {
                        $prereqUpper = strtoupper($prereqRaw);
                        if ($prereqUpper !== 'NULL' && $prereqRaw !== '0' && $prereqRaw !== '-' && $prereqRaw !== '—') {
                            $prerequisitesMap[$course->id] = $prereqRaw;
                        }
                    }

                    $count++;
                } catch (\Throwable $rowError) {
                    $skippedRows[] = [
                        'line' => $rowData['line'] ?? null,
                        'reason' => $rowError->getMessage(),
                    ];

                    Log::warning('CSV row skipped during import', [
                        'line' => $rowData['line'] ?? null,
                        'code' => $rowData['code'] ?? null,
                        'reason' => $rowError->getMessage(),
                    ]);
                }
            }

            foreach ($prerequisitesMap as $courseId => $prereqString) {
                $course = Course::find($courseId);
                if (!$course) {
                    continue;
                }

                $pIds = [];
                $cleanPrereq = str_replace(['"', "'", '[', ']', '(', ')', '،', ';', '|', '/'], ',', $prereqString);
                $pCodes = preg_split('/[\s,]+/', $cleanPrereq, -1, PREG_SPLIT_NO_EMPTY);

                foreach ($pCodes as $pCode) {
                    $cleanCode = $this->cleanCourseCode(trim($pCode));
                    if ($cleanCode === '') {
                        continue;
                    }

                    $pCourse = Course::where('code', $cleanCode)
                        ->where('major_id', $selectedMajorId)
                        ->where('study_plan_version', $selectedPlanVersion)
                        ->first();

                    if ($pCourse) {
                        $pIds[] = $pCourse->id;
                    }
                }

                if (!empty($pIds)) {
                    $course->prerequisites()->sync($pIds);
                }
            }

            if (!empty($importedCourseIds)) {
                $allCourses = Course::whereIn('id', $importedCourseIds)->with('prerequisites')->get();
                $changed = true;

                while ($changed) {
                    $changed = false;
                    foreach ($allCourses as $c) {
                        $maxPrereqLvl = 0;
                        foreach ($c->prerequisites as $p) {
                            if ($p->semester > $maxPrereqLvl) {
                                $maxPrereqLvl = $p->semester;
                            }
                        }

                        if ($maxPrereqLvl > 0 && $maxPrereqLvl + 1 > $c->semester) {
                            $c->semester = $maxPrereqLvl + 1;
                            $c->save();
                            $changed = true;
                        }
                    }
                }
            }

            if ($count === 0) {
                $firstErrors = array_slice($skippedRows, 0, 3);
                $details = collect($firstErrors)
                    ->map(fn ($e) => 'سطر ' . ($e['line'] ?? '?') . ': ' . ($e['reason'] ?? 'خطأ غير معروف'))
                    ->implode(' | ');

                return redirect()->back()->with([
                    'type' => 'error',
                    'message' => $details !== ''
                        ? 'تعذر استيراد أي صف. ' . $details
                        : 'لم يتم العثور على صفوف قابلة للاستيراد (تأكد من وجود code و name بكل صف).',
                ]);
            }

            $this->logAction('IMPORT_PLAN', "تم استيراد $count مادة للتخصص {$selectedMajorId} بالخطة {$selectedPlanVersion} مع إعادة بناء العلاقات والمستويات الشجرية تلقائياً.");

            $skippedCount = count($skippedRows);
            $successMessage = "تم الاستيراد بنجاح! 🚀 تم حفظ/تحديث {$count} مادة.";
            if ($skippedCount > 0) {
                $successMessage .= " وتم تخطي {$skippedCount} صف بسبب بيانات غير صالحة.";
            }

            return redirect()->back()->with([
                'type' => 'success',
                'message' => $successMessage,
            ]);
        } catch (\Throwable $e) {
            $errorRef = 'IMP-' . now()->format('YmdHis') . '-' . substr(md5((string) microtime(true)), 0, 6);

            Log::error('CSV import failed in AdminController@import', [
                'error_ref' => $errorRef,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id(),
                'major_id' => $request->input('major_id'),
                'study_plan_version' => $request->input('study_plan_version'),
            ]);

            $baseMessage = 'فشل استيراد الملف بسبب تنسيق أو ترميز غير متوافق. حاول حفظ الملف بصيغة CSV UTF-8 ثم أعد المحاولة.';
            if (config('app.debug')) {
                $baseMessage = 'فشل الاستيراد: ' . $e->getMessage() . ' (ref: ' . $errorRef . ')';
            }

            return redirect()->back()->with([
                'type' => 'error',
                'message' => $baseMessage,
            ]);
        }
    }

    /**
     * 🔥 دالة تقرير المواد الأكثر طلباً 🔥
     */
    public function demandReport(Request $request)
    {
        $courseDemand = Course::whereHas('cartUsers')
            ->when($request->college_id, function ($query, $collegeId) {
                $query->whereHas('major', function ($q) use ($collegeId) {
                    $q->where('college_id', $collegeId);
                });
            })
            ->when($request->major_id, function ($query, $majorId) {
                $query->where('major_id', $majorId);
            })
            ->withCount('cartUsers')
            ->orderBy('cart_users_count', 'desc')
            ->take(15) 
            ->get();

        $colleges = College::select('id', 'name')->get();
        $majors = Major::select('id', 'name', 'college_id')->get();

        // 🔥 تعديل جوهري: حساب إجمالي الطلاب "النشطين" (الذين لديهم مواد في التسجيل التجريبي) فقط
        // هذا يمنع ظهور نسبة 0% إذا كان هناك طلاب مسجلين ولكن لم يستخدموا التسجيل التجريبي بعد.
        $totalStudents = User::whereHas('cartCourses')->count();

        return Inertia::render('Admin/Reports/Demand', [
            'courseDemand' => $courseDemand,
            'colleges' => $colleges,
            'majors' => $majors,
            'filters' => $request->only(['college_id', 'major_id']),
            'totalStudents' => $totalStudents
        ]);
    }
}