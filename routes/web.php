<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\CompleteProfileController;
use App\Http\Controllers\Admin\AdminManagerController;
use App\Http\Controllers\Admin\AdminStudentController;
use App\Http\Controllers\Admin\DemandReportController;
use App\Http\Controllers\TreeController;
use App\Http\Controllers\GraduationPlanController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\AiAdvisorController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\IssueReportController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\ContactMessageController;
use App\Http\Controllers\Auth\MicrosoftAuthController;
use App\Http\Controllers\InstructorController;
use App\Http\Controllers\Admin\AdminIssueReportController;
use App\Http\Controllers\Admin\AdminContactMessageController;
use App\Http\Controllers\Admin\AdminChapterController;
use App\Http\Controllers\Admin\AdminQuestionController;
use App\Http\Controllers\AdminCollegeController;
use App\Http\Controllers\ChapterController;
use App\Http\Controllers\QuizController;
use App\Http\Controllers\AcademicInsightController;
use App\Http\Controllers\AcademicPathPlannerController;
use App\Models\Course;
use App\Models\SiteMaintenance;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| This file contains the browser-facing routes for public pages, student
| features, admin tools, and sitemap generation.
|
*/

// Expose the XML sitemap for search engines and crawler discovery.
Route::get('/sitemap.xml', SitemapController::class)->name('sitemap');

// Dedicated maintenance page shown when the admin enables site maintenance.
Route::get('/maintenance', function () {
    $maintenance = SiteMaintenance::current();

    return Inertia::render('System/Maintenance', [
        'maintenance_mode' => $maintenance ? [
            'id' => $maintenance->id,
            'is_enabled' => (bool) $maintenance->is_enabled,
            'title' => $maintenance->title,
            'message' => $maintenance->message,
            'expected_minutes' => $maintenance->expected_minutes !== null ? (int) $maintenance->expected_minutes : null,
            'activated_at' => optional($maintenance->activated_at)->toISOString(),
            'ended_at' => optional($maintenance->ended_at)->toISOString(),
        ] : null,
    ]);
})->name('system.maintenance');

// Public landing page.
Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
})->name('home');

Route::middleware('guest')->group(function () {
    Route::get('/auth/microsoft', [MicrosoftAuthController::class, 'redirectToMicrosoft'])->name('auth.microsoft.redirect');
    Route::get('/auth/microsoft/callback', [MicrosoftAuthController::class, 'handleMicrosoftCallback'])->name('auth.microsoft.callback');
});

// Guest demo entry point for NTP competition visitors (QR code target).
Route::get('/guest-demo', [\App\Http\Controllers\Auth\GuestDemoController::class, 'enter'])->name('guest.demo');

// Public legal pages.
Route::get('/terms-of-use', function () {
    return Inertia::render('Legal/Terms');
})->name('legal.terms');

Route::get('/privacy-policy', function () {
    return Inertia::render('Legal/Privacy');
})->name('legal.privacy');

Route::get('/about-us', function () {
    return Inertia::render('Legal/About');
})->name('legal.about');

// Public information pages.
Route::get('/how-it-works', function () {
    return Inertia::render('Public/HowItWorks');
})->name('public.how_it_works');

Route::get('/faq', function () {
    return Inertia::render('Public/Faq');
})->name('public.faq');

Route::get('/contact-us', function () {
    return Inertia::render('Public/Contact');
})->name('public.contact');

Route::post('/contact-us', [ContactMessageController::class, 'store'])->name('public.contact.store');

// Public announcements page visible to everyone.
Route::get('/announcements', [InstructorController::class, 'publicAnnouncements'])->name('public.announcements');

// Site feedback submission.
Route::post('/site-feedbacks', [App\Http\Controllers\SiteFeedbackController::class, 'store'])->name('site_feedbacks.store');

// Authenticated student dashboard.
Route::get('/dashboard', function () {
    $user = Auth::user();

    // Redirect instructors to their dedicated dashboard.
    if (strtolower((string) $user->role) === 'instructor') {
        return redirect()->route('instructor.dashboard');
    }

    $hasCourseUser = true;
    $hasUserCarts = true;
    $hasGraduationPlans = true;
    $hasUserChapters = true;
    $hasChapters = true;

    // Load the academic relations needed by the dashboard cards and widgets.
    $relations = ['major'];
    if ($hasUserCarts) {
        $relations[] = 'cartCourses';
    }
    if ($hasCourseUser) {
        $relations[] = 'passedCourses';
    }
    $user->load($relations);

    $passedHours = $hasCourseUser ? $user->passedCourses->sum('credit_hours') : 0;
    $gpaData = $hasCourseUser
        ? $user->calculateGPA()
        : ['percentage' => 0, 'gpa4' => '0.00', 'completed_hours' => 0, 'has_records' => false];
    $cartHours = $hasUserCarts ? (int) $user->cartCourses->sum('credit_hours') : 0;
    $registrationRules = app(\App\Engines\AcademicRulesEngine::class)->evaluate(
        $user,
        ['total_passed_hours' => (int) $passedHours],
        $cartHours
    );

    $layoutMajorId = (int) ($user->major_id ?? 0);
    $planVersion = (int) ($user->study_plan_version ?? 12);
    $globalVersion = \Illuminate\Support\Facades\Cache::get('dashboard_courses_version', 1);
    $cacheKey = "dashboard:planner_courses:major:{$layoutMajorId}:plan:{$planVersion}:v:{$globalVersion}";

    $plannerCourses = \Illuminate\Support\Facades\Cache::remember($cacheKey, now()->addMinutes(15), function() use ($hasCourseUser, $layoutMajorId, $planVersion) {
        $plannerCoursesQuery = Course::query()
            ->select([
                'courses.id',
                'courses.name',
                'courses.code',
                'courses.credit_hours',
                'courses.type',
                'courses.semester',
                'courses.major_id',
            ])
            ->withCount('prerequisites')
            ->with(['prerequisites:id']);

        if ($hasCourseUser) {
            $courseStatsSubquery = DB::table('course_user')
                ->selectRaw('course_id')
                ->selectRaw('AVG(grade) as avg_grade')
                ->selectRaw('COUNT(*) as graded_attempts')
                ->selectRaw('SUM(CASE WHEN grade < 60 THEN 1 ELSE 0 END) as failed_attempts')
                ->whereNotNull('grade')
                ->groupBy('course_id');

            $plannerCoursesQuery
                ->leftJoinSub($courseStatsSubquery, 'course_stats', function ($join) {
                    $join->on('courses.id', '=', 'course_stats.course_id');
                })
                ->selectRaw('COALESCE(course_stats.avg_grade, 72) as avg_grade')
                ->selectRaw('COALESCE(course_stats.graded_attempts, 0) as graded_attempts')
                ->selectRaw('COALESCE(course_stats.failed_attempts, 0) as failed_attempts')
                ->selectRaw('CASE WHEN COALESCE(course_stats.graded_attempts, 0) > 0 THEN (course_stats.failed_attempts / course_stats.graded_attempts) * 100 ELSE 18 END as fail_rate');
        } else {
            $plannerCoursesQuery
                ->selectRaw('72 as avg_grade')
                ->selectRaw('0 as graded_attempts')
                ->selectRaw('0 as failed_attempts')
                ->selectRaw('18 as fail_rate');
        }

        if ($layoutMajorId) {
            $plannerCoursesQuery->where(function ($query) use ($layoutMajorId, $planVersion) {
                $query->where(function ($majorScope) use ($layoutMajorId, $planVersion) {
                    $majorScope->where('major_id', $layoutMajorId)
                        ->where('study_plan_version', $planVersion);
                })->orWhere(function ($universityScope) use ($planVersion) {
                    $universityScope->whereNull('major_id')
                        ->where('study_plan_version', $planVersion);
                });
            });
        } else {
            $plannerCoursesQuery->whereNull('major_id')
                ->where('study_plan_version', $planVersion);
        }

        return $plannerCoursesQuery->get();
    });

    // Keep the payload focused on the fields rendered in the dashboard UI.
    $passedCourses = $hasCourseUser
        ? $user->passedCourses()
            ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
            ->withPivot('grade', 'studied_semester', 'studied_year', 'studied_term')
            ->get()
        : collect();

    // Fetch the approved graduation plan (if any) with course details.
    $approvedPlan = $hasGraduationPlans
        ? \App\Models\GraduationPlan::query()
            ->where('user_id', $user->id)
            ->first()
        : null;

    $graduationPlanData = null;
    if ($approvedPlan && is_array($approvedPlan->payload)) {
        $allCourseIds = collect($approvedPlan->payload['semesters'] ?? [])
            ->pluck('course_ids')
            ->flatten()
            ->unique()
            ->values()
            ->toArray();

        $planCourseMap = Course::whereIn('id', $allCourseIds)
            ->select('id', 'name', 'code', 'credit_hours', 'type')
            ->get()
            ->keyBy('id');

        $graduationPlanData = [
            'id' => $approvedPlan->id,
            'approved_at' => optional($approvedPlan->approved_at)->toISOString(),
            'notes' => $approvedPlan->payload['notes'] ?? null,
            'semesters' => collect($approvedPlan->payload['semesters'] ?? [])->map(function ($sem) use ($planCourseMap) {
                return [
                    'semester' => $sem['semester'] ?? 1,
                    'is_summer' => $sem['is_summer'] ?? false,
                    'courses' => collect($sem['course_ids'] ?? [])->map(function ($id) use ($planCourseMap) {
                        $c = $planCourseMap->get($id);
                        return $c ? [
                            'id' => $c->id,
                            'name' => $c->name,
                            'code' => $c->code,
                            'credit_hours' => $c->credit_hours,
                            'type' => $c->type,
                        ] : null;
                    })->filter()->values()->toArray(),
                ];
            })->toArray(),
        ];
    }

    return Inertia::render('Dashboard', [
        'passed_hours' => (int) $passedHours,
        'total_hours' => 132,
        'gpa' => isset($gpaData['percentage']) ? number_format((float) $gpaData['percentage'], 2) : '0.00',
        'has_academic_records' => !empty($gpaData['has_records']),
        'registration_rules' => [
            'period_label' => $registrationRules['period_label'],
            'is_summer' => (bool) $registrationRules['is_summer'],
            'term_limit' => (int) $registrationRules['term_limit'],
            'effective_limit' => (int) $registrationRules['effective_limit'],
            'is_probation' => (bool) $registrationRules['is_probation'],
            'is_graduating' => (bool) $registrationRules['is_graduating'],
        ],
        'passed_courses' => $passedCourses,
        'cart_courses' => $hasUserCarts ? $user->cartCourses : collect(),
        'ai_skills' => $hasCourseUser ? $user->getSkillsFromPassedCourses() : collect(),
        'planner_courses' => $plannerCourses,
        'graduation_plan' => $graduationPlanData,
        'pinned_chapters' => ($hasUserChapters && $hasChapters)
            ? $user->pinnedChapters()->with('course')->get()->map(function ($ch) {
                return [
                    'id' => $ch->id,
                    'title' => $ch->title,
                    'course_id' => $ch->course_id,
                    'course_name' => $ch->course?->name ?? null,
                    'google_drive_link' => $ch->google_drive_link,
                ];
            })->toArray()
            : [],
        'academic_insight' => rescue(
            fn () => app(\App\Services\StudentDashboardInsightService::class)->for($user),
            [
                'state' => 'error',
                'title' => 'أهم قرار لك الآن',
                'message' => 'تعذر تحديث اقتراحك الآن',
            ],
            report: true
        ),
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

// Lightweight browser heartbeat endpoints used by the global loader.
// They intentionally avoid the heavier student/admin page middleware stack.
Route::post('/api/heartbeat', [AdminController::class, 'updateLastActivity'])
    ->name('heartbeat')
    ->withoutMiddleware([
        \App\Http\Middleware\EnsureSiteMaintenance::class,
        \App\Http\Middleware\HandleInertiaRequests::class,
        \App\Http\Middleware\UpdateLastSeenAt::class,
    ]);

Route::post('/api/browser-close', [AdminController::class, 'handleBrowserClose'])
    ->name('browser_close')
    ->withoutMiddleware([
        \App\Http\Middleware\EnsureSiteMaintenance::class,
        \App\Http\Middleware\HandleInertiaRequests::class,
        \App\Http\Middleware\UpdateLastSeenAt::class,
    ]);

// Student-only application features.
Route::middleware('auth')->group(function () {
    // Mandatory profile completion for students without a selected major.
    Route::get('/complete-profile', [CompleteProfileController::class, 'show'])->name('profile.complete');
    Route::post('/complete-profile', [CompleteProfileController::class, 'update'])->name('profile.complete.update');
    // Portal scraping sync is intentionally disabled for now.
    // Route::post('/portal/sync', [PortalSyncController::class, 'sync'])->name('portal.sync');

    // Student support and issue reporting.
    Route::get('/support/report-issue', [IssueReportController::class, 'create'])->name('support.issue.create');
    Route::post('/support/report-issue', [IssueReportController::class, 'store'])->name('support.issue.store');

    // Tree planner and course simulation features.
    Route::get('/tree', [TreeController::class, 'index'])->name('tree.index');
    Route::post('/tree/toggle', [TreeController::class, 'toggle'])->name('tree.toggle');
    Route::post('/tree/retake', [TreeController::class, 'retakeCourse'])->name('tree.retake');
    Route::post('/tree/update-grade', [TreeController::class, 'updateGrade'])->name('tree.update_grade');
    Route::post('/tree/reset', [TreeController::class, 'resetPlan'])->name('tree.reset');
    Route::post('/tree/submit-review', [TreeController::class, 'submitReview'])->name('tree.submit_review');
    
    // Schedule Reviews (Accessible by Admin and Instructor, protected in controller)
    Route::get('/schedule-reviews', [\App\Http\Controllers\ScheduleReviewController::class, 'index'])->name('schedule_reviews.index');
    Route::get('/schedule-reviews/{scheduleReview}', [\App\Http\Controllers\ScheduleReviewController::class, 'show'])->name('schedule_reviews.show');
    Route::post('/schedule-reviews/{scheduleReview}/feedback', [\App\Http\Controllers\ScheduleReviewController::class, 'submitFeedback'])->name('schedule_reviews.feedback');
    Route::delete('/schedule-reviews/{scheduleReview}', [\App\Http\Controllers\ScheduleReviewController::class, 'destroy'])->name('schedule_reviews.destroy');

    Route::post('/graduation-plan', [GraduationPlanController::class, 'store'])->name('graduation-plan.store');
    Route::delete('/graduation-plan', [GraduationPlanController::class, 'destroy'])->name('graduation-plan.destroy');

    Route::post('/cart/sync', [CartController::class, 'sync'])->name('cart.sync');

    Route::post('/dashboard/academic-insight/refresh', [AcademicInsightController::class, 'refresh'])
        ->middleware('throttle:20,1')
        ->name('dashboard.academic-insight.refresh');
    Route::post('/dashboard/academic-insight/track', [AcademicInsightController::class, 'track'])
        ->middleware('throttle:60,1')
        ->name('dashboard.academic-insight.track');
    Route::post('/dashboard/academic-insight/dismiss', [AcademicInsightController::class, 'dismiss'])
        ->middleware('throttle:20,1')
        ->name('dashboard.academic-insight.dismiss');

    // Toggle a single course from either the tree view or AI advisor flows.
    Route::post('/cart/toggle-single', [TreeController::class, 'toggleSingleCart'])->name('cart.toggle.single');

    // GPA calculator and grade persistence endpoints.
    Route::get('/calculator', [GradeController::class, 'index'])->name('calculator.index');
    Route::post('/grades/update', [GradeController::class, 'update'])->name('grades.update');

    // Public-style utility page that is still available only for logged-in users.
    Route::get('/campus-directory', function () {
        $colleges = \Illuminate\Support\Facades\Cache::remember('campus_directory_colleges', 1800, function () {
            return \App\Models\College::with('university')
                ->orderBy('name')
                ->get();
        });

        $landmarks = \Illuminate\Support\Facades\Cache::remember('campus_directory_landmarks', 1800, function () {
            return \App\Models\Landmark::query()
                ->where('is_active', true)
                ->orderBy('type')
                ->orderBy('name')
                ->get();
        });

        return Inertia::render('Campus/Directory', [
            'colleges' => $colleges,
            'landmarks' => $landmarks,
        ]);
    })->name('campus.directory');

    // Course chapters browsing for students.
    Route::get('/chapters', [ChapterController::class, 'index'])->name('chapters.index');
    Route::post('/chapters/pin', [ChapterController::class, 'togglePin'])->name('chapters.pin');

    // Quiz and practice system.
    Route::get('/quiz', [QuizController::class, 'index'])->name('quiz.index');
    Route::get('/quiz/start', [QuizController::class, 'start'])->name('quiz.start');
    Route::post('/quiz/submit', [QuizController::class, 'submit'])->name('quiz.submit');

    // AI advisor routes, including chat lifecycle operations.
    Route::get('/ai-advisor', [AiAdvisorController::class, 'index'])->name('ai.advisor');
    Route::post('/ai-advisor/chat', [AiAdvisorController::class, 'chat'])
        ->middleware('throttle:15,1')
        ->name('ai.advisor.chat');

    // Same generation pipeline as /chat, but streamed over SSE. Falls back to /chat
    // when streaming is unavailable, so it shares the same throttle budget.
    Route::post('/ai-advisor/stream', [AiAdvisorController::class, 'stream'])
        ->middleware('throttle:15,1')
        ->name('ai.advisor.stream');

    Route::get('/ai-advisor/chat/{chat_id}', [AiAdvisorController::class, 'getMessages'])->name('ai.advisor.messages');
    Route::post('/ai-advisor/regenerate', [AiAdvisorController::class, 'regenerate'])
        ->middleware('throttle:15,1')
        ->name('ai.advisor.regenerate');
    Route::post('/ai-advisor/feedback', [AiAdvisorController::class, 'feedback'])->name('ai.advisor.feedback');

    // Clears the advisor's saved academic preferences for the current student.
    Route::delete('/ai-advisor/memory', [AiAdvisorController::class, 'forgetMemory'])->name('ai.advisor.memory.forget');

    // Executes an action the student confirmed in the chat (add/remove cart courses,
    // apply a proposed plan, open a page). Gated by ai.features.actions; nothing is
    // written without this explicit second request.
    Route::post('/ai-advisor/action', [AiAdvisorController::class, 'action'])
        ->middleware('throttle:30,1')
        ->name('ai.advisor.action');

    // New AI generation routes for the Tree planner
    Route::post('/ai/tree/analyze-course', [AiAdvisorController::class, 'analyzeCourseInTree'])->name('ai.tree.analyze_course')->middleware('throttle:15,1');
    Route::post('/ai/full-plan', [AiAdvisorController::class, 'generateFullPlan'])->name('ai.full_plan')->middleware('throttle:15,1');
    Route::post('/academic-path-planner/generate', [AcademicPathPlannerController::class, 'generate'])
        ->middleware('throttle:12,1')
        ->name('academic-path-planner.generate');

    // Keep the bulk-delete route before the single chat route to avoid parameter collisions.
    Route::delete('/ai-advisor/chats/all', [AiAdvisorController::class, 'destroyAll'])->name('ai.advisor.delete.all');
    Route::delete('/ai-advisor/chat/{chat_id}', [AiAdvisorController::class, 'destroy'])->name('ai.advisor.delete');

    // Standard account management routes for logged-in users.
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Admin-only routes for dashboards, academic data, and staff operations.

    // Instructor routes for teaching staff features.
    Route::middleware(['instructor'])->prefix('instructor')->name('instructor.')->group(function () {
        Route::get('/dashboard', [InstructorController::class, 'dashboard'])->name('dashboard');
        Route::get('/students', [InstructorController::class, 'students'])->name('students');
        Route::get('/announcements', [InstructorController::class, 'announcements'])->name('announcements');
        Route::post('/announcements', [InstructorController::class, 'storeAnnouncement'])->name('announcements.store');
        Route::put('/announcements/{announcement}', [InstructorController::class, 'updateAnnouncement'])->name('announcements.update');
        Route::delete('/announcements/{announcement}', [InstructorController::class, 'destroyAnnouncement'])->name('announcements.destroy');
        Route::put('/courses', [InstructorController::class, 'updateCourses'])->name('courses.update');
        Route::get('/reports/demand', [InstructorController::class, 'demandReport'])->name('reports.demand');
        
        // Instructor AI Scheduler
        Route::get('/ai-scheduler', [\App\Http\Controllers\InstructorAiAdvisorController::class, 'index'])->name('ai.scheduler');
        Route::post('/ai-scheduler/preferences', [\App\Http\Controllers\InstructorAiAdvisorController::class, 'savePreferences'])->name('ai.scheduler.preferences');
        Route::post('/ai-scheduler/chat', [\App\Http\Controllers\InstructorAiAdvisorController::class, 'chat'])
            ->middleware('throttle:15,1')
            ->name('ai.scheduler.chat');
        Route::get('/ai-scheduler/chat/{chat_id}', [\App\Http\Controllers\InstructorAiAdvisorController::class, 'getMessages'])->name('ai.scheduler.messages');
        Route::delete('/ai-scheduler/chat/{chat_id}', [\App\Http\Controllers\InstructorAiAdvisorController::class, 'destroy'])->name('ai.scheduler.destroy');
        Route::post('/ai-scheduler/commit', [\App\Http\Controllers\InstructorAiAdvisorController::class, 'commitSchedule'])->name('ai.scheduler.commit');
    });
    Route::middleware(['admin'])->prefix('admin')->name('admin.')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');
        Route::delete('/guests/{guest}', [AdminController::class, 'destroyGuest'])->name('guests.destroy');
        Route::post('/notes', [AdminController::class, 'storeAdminNote'])->name('notes.store');
        Route::get('/settings', [AdminController::class, 'settings'])->name('settings');
        Route::get('/ai-chats', [AdminController::class, 'aiChats'])->name('ai_chats');
        Route::put('/settings/academic-period', [AdminController::class, 'updateAcademicPeriod'])->name('settings.academic_period');
        Route::put('/settings/maintenance', [AdminController::class, 'updateMaintenanceMode'])->name('settings.maintenance');
        Route::get('/reports/demand', [DemandReportController::class, 'index'])->name('reports.demand');
        Route::get('/reports/demand/{course}/students', [DemandReportController::class, 'students'])
            ->name('reports.demand.students');
        Route::delete('/reports/demand/{course}/students/{student}', [DemandReportController::class, 'removeStudent'])
            ->name('reports.demand.students.destroy');
        // Gemini infrastructure monitor: per key AND per model quotas, tokens,
        // latency and errors. The legacy api.ai_key_status endpoint below is left
        // in place for the existing settings tab.
        Route::get('/ai-monitor', [\App\Http\Controllers\Admin\GeminiMonitorController::class, 'index'])->name('ai_monitor');
        Route::get('/ai-monitor/metrics', [\App\Http\Controllers\Admin\GeminiMonitorController::class, 'metrics'])->name('ai_monitor.metrics');

        Route::get('/reports/ai-insights', [AiAdvisorController::class, 'getAdminReports'])->name('reports.ai_insights');

        // Advisor quality metrics, read from the separate ai_request_logs table.
        Route::get('/reports/ai-quality', [AiAdvisorController::class, 'getQualityMetrics'])->name('reports.ai_quality');
        Route::get('/api/ai-key-status', [AiAdvisorController::class, 'getApiKeyStatus'])->name('api.ai_key_status');

            // 🔥 Live online users polling and session management
            Route::get('/api/online-users', [AdminController::class, 'getOnlineUsers'])->name('api.online_users');
            Route::get('/api/new-registrations', [AdminController::class, 'getNewRegistrations'])->name('api.new_registrations');
            Route::post('/api/heartbeat', [AdminController::class, 'updateLastActivity'])->name('api.heartbeat');
            Route::post('/api/browser-close', [AdminController::class, 'handleBrowserClose'])->name('api.browser_close');

        // Instructor management endpoints.
        Route::get('/instructors', [App\Http\Controllers\Admin\AdminInstructorController::class, 'index'])->name('instructors.index');
        Route::put('/instructors/{instructor}', [App\Http\Controllers\Admin\AdminInstructorController::class, 'update'])->name('instructors.update');
        Route::delete('/instructors/{instructor}', [App\Http\Controllers\Admin\AdminInstructorController::class, 'destroy'])->name('instructors.destroy');

        // Student management endpoints.
        Route::get('/students', [AdminStudentController::class, 'index'])->name('students.index');
        Route::put('/students/{student}', [AdminStudentController::class, 'update'])->name('students.update');
        Route::delete('/students/{student}', [AdminStudentController::class, 'destroy'])->name('students.destroy');
        Route::delete('/students/{student}/ban', [AdminStudentController::class, 'banAndDestroy'])->name('students.ban');
        Route::delete('/students/{student}/cart/{courseId}', [AdminStudentController::class, 'removeCartCourse'])
            ->whereNumber('courseId')
            ->name('students.cart.remove');

        // Site feedbacks management endpoints.
        Route::get('/site-feedbacks', [App\Http\Controllers\SiteFeedbackController::class, 'index'])->name('site_feedbacks.index');

        // Course CRUD and import/export workflows.
        Route::get('/student-logs', [\App\Http\Controllers\Admin\AdminStudentActivityLogController::class, 'index'])->name('student-logs');
        Route::get('/courses', [AdminController::class, 'index'])->name('courses');
        Route::get('/structure', [AdminController::class, 'structure'])->name('structure');
        Route::get('/logs', [AdminController::class, 'logs'])->name('logs');
        Route::post('/clear-cache', [AdminController::class, 'clearCache'])->name('clear-cache');
        Route::post('/courses', [AdminController::class, 'store'])->name('courses.store');
        Route::put('/courses/{course}', [AdminController::class, 'update'])->name('courses.update');
        Route::delete('/courses/{course}', [AdminController::class, 'destroy'])->name('courses.destroy');
        Route::post('/courses/import', [AdminController::class, 'import'])->name('courses.import');
        Route::post('/courses/export', [AdminController::class, 'export'])->name('courses.export');
        Route::post('/courses/bulk-delete', [AdminController::class, 'bulkDelete'])->name('courses.bulk_delete');

        // Course Sections
        Route::get('/sections', [\App\Http\Controllers\Admin\CourseSectionController::class, 'index'])->name('sections.index');
        Route::post('/sections/import', [\App\Http\Controllers\Admin\CourseSectionController::class, 'import'])->name('sections.import');
        Route::put('/sections/{section}', [\App\Http\Controllers\Admin\CourseSectionController::class, 'update'])->name('sections.update');
        Route::delete('/sections/{section}', [\App\Http\Controllers\Admin\CourseSectionController::class, 'destroy'])->name('sections.destroy');


        // Academic structure management (Structure page).
        Route::post('/colleges', [AdminController::class, 'storeCollege'])->name('colleges.store');
        Route::put('/colleges/{college}/quick-update', [AdminController::class, 'updateCollege'])->name('colleges.quick_update');
        Route::delete('/colleges/{college}/quick-destroy', [AdminController::class, 'destroyCollege'])->name('colleges.quick_destroy');

        Route::post('/majors', [AdminController::class, 'storeMajor'])->name('majors.store');
        Route::put('/majors/{major}/quick-update', [AdminController::class, 'updateMajor'])->name('majors.quick_update');
        Route::delete('/majors/{major}/quick-destroy', [AdminController::class, 'destroyMajor'])->name('majors.quick_destroy');

        // Colleges and landmarks management - complete CRUD with UI forms.
        Route::get('/colleges/list', [AdminCollegeController::class, 'indexColleges'])->name('colleges.index');
        Route::get('/colleges/new', [AdminCollegeController::class, 'createCollege'])->name('colleges.create');
        Route::post('/colleges/new', [AdminCollegeController::class, 'storeCollege'])->name('colleges.store_new');
        Route::get('/colleges/{college}/edit', [AdminCollegeController::class, 'editCollege'])->name('colleges.edit');
        Route::put('/colleges/{college}', [AdminCollegeController::class, 'updateCollege'])->name('colleges.update');
        Route::delete('/colleges/{college}', [AdminCollegeController::class, 'destroyCollege'])->name('colleges.destroy');

        // Majors management - complete CRUD with UI forms.
        Route::get('/majors/list', [AdminCollegeController::class, 'indexMajors'])->name('majors.index');
        Route::get('/majors/new', [AdminCollegeController::class, 'createMajor'])->name('majors.create');
        Route::post('/majors/new', [AdminCollegeController::class, 'storeMajor'])->name('majors.store_new');
        Route::get('/majors/{major}/edit', [AdminCollegeController::class, 'editMajor'])->name('majors.edit');
        Route::put('/majors/{major}', [AdminCollegeController::class, 'updateMajor'])->name('majors.update');
        Route::delete('/majors/{major}', [AdminCollegeController::class, 'destroyMajor'])->name('majors.destroy');

        Route::get('/landmarks', [AdminCollegeController::class, 'indexLandmarks'])->name('landmarks.index');
        Route::get('/landmarks/new', [AdminCollegeController::class, 'createLandmark'])->name('landmarks.create');
        Route::post('/landmarks/new', [AdminCollegeController::class, 'storeLandmark'])->name('landmarks.store_new');
        Route::get('/landmarks/{landmark}/edit', [AdminCollegeController::class, 'editLandmark'])->name('landmarks.edit');
        Route::put('/landmarks/{landmark}', [AdminCollegeController::class, 'updateLandmark'])->name('landmarks.update');
        Route::delete('/landmarks/{landmark}', [AdminCollegeController::class, 'destroyLandmark'])->name('landmarks.destroy');

        // Owner-only staff management routes.
        Route::middleware(['owner'])->group(function () {
            Route::get('/admins', [AdminManagerController::class, 'index'])->name('admins.index');
            Route::post('/admins/promote', [AdminManagerController::class, 'promote'])->name('admins.promote');
            Route::put('/admins/{user}/role', [AdminManagerController::class, 'updateRole'])->name('admins.update_role');
            Route::delete('/admins/{user}', [AdminManagerController::class, 'destroy'])->name('admins.destroy');
        });

        // Student issue management in the admin panel.
        Route::get('/issues', [AdminIssueReportController::class, 'index'])->name('issues.index');
        Route::put('/issues/{issueReport}/status', [AdminIssueReportController::class, 'updateStatus'])->name('issues.update_status');
        Route::delete('/issues/{issueReport}', [AdminIssueReportController::class, 'destroy'])->name('issues.destroy');

        // Tree layout management for admin drag-and-drop positioning.
        Route::post('/tree/positions', [TreeController::class, 'updatePosition'])->name('tree.positions');

        // Public contact form submissions management in the admin panel.
        Route::get('/contact-messages', [AdminContactMessageController::class, 'index'])->name('contact_messages.index');
        Route::put('/contact-messages/{contactMessage}/status', [AdminContactMessageController::class, 'updateStatus'])->name('contact_messages.update_status');
        Route::delete('/contact-messages/{contactMessage}', [AdminContactMessageController::class, 'destroy'])->name('contact_messages.destroy');

        // Chapter management for admin.
        Route::get('/chapters', [AdminChapterController::class, 'index'])->name('chapters.index');
        Route::post('/chapters', [AdminChapterController::class, 'store'])->name('chapters.store');
        Route::put('/chapters/{chapter}', [AdminChapterController::class, 'update'])->name('chapters.update');
        Route::delete('/chapters/{chapter}', [AdminChapterController::class, 'destroy'])->name('chapters.destroy');
        Route::put('/courses/{course}/quick-update', [AdminChapterController::class, 'quickUpdateCourse'])->name('courses.quick_update');

        // Question management for admin.
        Route::get('/questions', [AdminQuestionController::class, 'index'])->name('questions.index');
        Route::post('/questions', [AdminQuestionController::class, 'store'])->name('questions.store');
        Route::post('/questions/bulk/analyze', [AdminQuestionController::class, 'analyzeBulk'])
            ->middleware('throttle:10,1')
            ->name('questions.bulk.analyze');
        Route::post('/questions/bulk', [AdminQuestionController::class, 'storeBulk'])->name('questions.bulk.store');
        Route::put('/questions/{question}', [AdminQuestionController::class, 'update'])->name('questions.update');
        Route::delete('/questions/{question}', [AdminQuestionController::class, 'destroy'])->name('questions.destroy');
    });
});

require __DIR__ . '/auth.php';
