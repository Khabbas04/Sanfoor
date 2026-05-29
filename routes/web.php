<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Admin\AdminManagerController;
use App\Http\Controllers\Admin\AdminStudentController;
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
use App\Http\Controllers\Admin\AdminIssueReportController;
use App\Http\Controllers\Admin\AdminContactMessageController;
use App\Http\Controllers\Admin\AdminChapterController;
use App\Http\Controllers\Admin\AdminQuestionController;
use App\Http\Controllers\AdminCollegeController;
use App\Http\Controllers\ChapterController;
use App\Http\Controllers\QuizController;
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
});

Route::middleware('guest')->group(function () {
    Route::get('/auth/microsoft', [MicrosoftAuthController::class, 'redirectToMicrosoft'])->name('auth.microsoft.redirect');
    Route::get('/auth/microsoft/callback', [MicrosoftAuthController::class, 'handleMicrosoftCallback'])->name('auth.microsoft.callback');
});

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

// Authenticated student dashboard.
Route::get('/dashboard', function () {
    $user = Auth::user();

    // Load the academic relations needed by the dashboard cards and widgets.
    $user->load('major', 'cartCourses', 'passedCourses');

    $passedHours = $user->passedCourses->sum('credit_hours');
    $gpaData = $user->calculateGPA();

    $courseStatsSubquery = DB::table('course_user')
        ->selectRaw('course_id')
        ->selectRaw('AVG(grade) as avg_grade')
        ->selectRaw('COUNT(*) as graded_attempts')
        ->selectRaw('SUM(CASE WHEN grade < 60 THEN 1 ELSE 0 END) as failed_attempts')
        ->whereNotNull('grade')
        ->groupBy('course_id');

    $plannerCoursesQuery = Course::query()
        ->leftJoinSub($courseStatsSubquery, 'course_stats', function ($join) {
            $join->on('courses.id', '=', 'course_stats.course_id');
        })
        ->select([
            'courses.id',
            'courses.name',
            'courses.code',
            'courses.credit_hours',
            'courses.type',
            'courses.semester',
            'courses.major_id',
        ])
        ->selectRaw('COALESCE(course_stats.avg_grade, 72) as avg_grade')
        ->selectRaw('COALESCE(course_stats.graded_attempts, 0) as graded_attempts')
        ->selectRaw('COALESCE(course_stats.failed_attempts, 0) as failed_attempts')
        ->selectRaw('CASE WHEN COALESCE(course_stats.graded_attempts, 0) > 0 THEN (course_stats.failed_attempts / course_stats.graded_attempts) * 100 ELSE 18 END as fail_rate')
        ->withCount('prerequisites')
        ->with(['prerequisites:id']);

    if ($user->major_id) {
        $plannerCoursesQuery->where(function ($query) use ($user) {
            $query->where(function ($majorScope) use ($user) {
                $majorScope->where('major_id', $user->major_id)
                    ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
            })->orWhere(function ($universityScope) use ($user) {
                $universityScope->whereNull('major_id')
                    ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
            });
        });
    } else {
        $plannerCoursesQuery->whereNull('major_id')
            ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
    }

    $plannerCourses = $plannerCoursesQuery->get();

    // Keep the payload focused on the fields rendered in the dashboard UI.
    $passedCourses = $user->passedCourses()
        ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
        ->withPivot('grade', 'studied_semester', 'studied_year', 'studied_term')
        ->get();

    // Fetch the approved graduation plan (if any) with course details.
    $approvedPlan = \App\Models\GraduationPlan::query()
        ->where('user_id', $user->id)
        ->first();

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
        'passed_courses' => $passedCourses,
        'cart_courses' => $user->cartCourses,
        'ai_skills' => $user->getSkillsFromPassedCourses(),
        'planner_courses' => $plannerCourses,
        'graduation_plan' => $graduationPlanData,
        'pinned_chapters' => $user->pinnedChapters()->with('course')->get()->map(function($ch) {
            return [
                'id' => $ch->id,
                'title' => $ch->title,
                'course_id' => $ch->course_id,
                'course_name' => $ch->course?->name ?? null,
                'google_drive_link' => $ch->google_drive_link,
            ];
        })->toArray(),
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

// Student-only application features.
Route::middleware('auth')->group(function () {
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
    Route::post('/graduation-plan', [GraduationPlanController::class, 'store'])->name('graduation-plan.store');
    Route::delete('/graduation-plan', [GraduationPlanController::class, 'destroy'])->name('graduation-plan.destroy');

    // Synchronize the simulation cart with the backend.
        // 🔥 Global heartbeat for all authenticated users (keep session alive)
        Route::post('/api/heartbeat', [AdminController::class, 'updateLastActivity'])->name('heartbeat');
        Route::post('/api/browser-close', [AdminController::class, 'handleBrowserClose'])->name('browser_close');
    Route::post('/cart/sync', [CartController::class, 'sync'])->name('cart.sync');

    // Toggle a single course from either the tree view or AI advisor flows.
    Route::post('/cart/toggle-single', [TreeController::class, 'toggleSingleCart'])->name('cart.toggle.single');

    // GPA calculator and grade persistence endpoints.
    Route::get('/calculator', [GradeController::class, 'index'])->name('calculator.index');
    Route::post('/grades/update', [GradeController::class, 'update'])->name('grades.update');

    // Public-style utility page that is still available only for logged-in users.
    Route::get('/campus-directory', function () {
        $colleges = \App\Models\College::with('university')
            ->orderBy('name')
            ->get();

        $landmarks = \App\Models\Landmark::query()
            ->where('is_active', true)
            ->orderBy('type')
            ->orderBy('name')
            ->get();

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
    Route::post('/ai-advisor/chat', [AiAdvisorController::class, 'chat'])->name('ai.advisor.chat');
    Route::get('/ai-advisor/chat/{chat_id}', [AiAdvisorController::class, 'getMessages'])->name('ai.advisor.messages');
    Route::post('/ai-advisor/regenerate', [AiAdvisorController::class, 'regenerate'])->name('ai.advisor.regenerate');
    Route::post('/ai-advisor/feedback', [AiAdvisorController::class, 'feedback'])->name('ai.advisor.feedback');

    // Keep the bulk-delete route before the single chat route to avoid parameter collisions.
    Route::delete('/ai-advisor/chats/all', [AiAdvisorController::class, 'destroyAll'])->name('ai.advisor.delete.all');
    Route::delete('/ai-advisor/chat/{chat_id}', [AiAdvisorController::class, 'destroy'])->name('ai.advisor.delete');

    // Standard account management routes for logged-in users.
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Admin-only routes for dashboards, academic data, and staff operations.
    Route::middleware(['admin'])->prefix('admin')->name('admin.')->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');
        Route::post('/notes', [AdminController::class, 'storeAdminNote'])->name('notes.store');
        Route::get('/settings', [AdminController::class, 'settings'])->name('settings');
        Route::put('/settings/academic-period', [AdminController::class, 'updateAcademicPeriod'])->name('settings.academic_period');
        Route::put('/settings/maintenance', [AdminController::class, 'updateMaintenanceMode'])->name('settings.maintenance');
        Route::get('/reports/demand', [AdminController::class, 'demandReport'])->name('reports.demand');
        Route::get('/reports/ai-insights', [AiAdvisorController::class, 'getAdminReports'])->name('reports.ai_insights');
        Route::get('/api/ai-key-status', [AiAdvisorController::class, 'getApiKeyStatus'])->name('api.ai_key_status');

            // 🔥 Live online users polling and session management
            Route::get('/api/online-users', [AdminController::class, 'getOnlineUsers'])->name('api.online_users');
            Route::post('/api/heartbeat', [AdminController::class, 'updateLastActivity'])->name('api.heartbeat');
            Route::post('/api/browser-close', [AdminController::class, 'handleBrowserClose'])->name('api.browser_close');

        // Student management endpoints.
        Route::get('/students', [AdminStudentController::class, 'index'])->name('students.index');
        Route::put('/students/{student}', [AdminStudentController::class, 'update'])->name('students.update');
        Route::delete('/students/{student}', [AdminStudentController::class, 'destroy'])->name('students.destroy');
        Route::delete('/students/{student}/cart/{courseId}', [AdminStudentController::class, 'removeCartCourse'])
            ->whereNumber('courseId')
            ->name('students.cart.remove');

        // Course CRUD and import/export workflows.
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
            // Owner-only audit logs UI + polling API
            Route::get('/owner-logs', [AdminController::class, 'ownerLogsPage'])->name('owner.logs');
            Route::get('/api/owner-logs', [AdminController::class, 'apiOwnerLogs'])->name('api.owner_logs');
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
        Route::put('/questions/{question}', [AdminQuestionController::class, 'update'])->name('questions.update');
        Route::delete('/questions/{question}', [AdminQuestionController::class, 'destroy'])->name('questions.destroy');
    });
});

require __DIR__ . '/auth.php';