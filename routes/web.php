<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Admin\AdminManagerController;
use App\Http\Controllers\Admin\AdminStudentController;
use App\Http\Controllers\TreeController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\AiAdvisorController;
use App\Http\Controllers\CartController;
use App\Http\Controllers\IssueReportController;
use App\Http\Controllers\SitemapController;
use App\Http\Controllers\Admin\AdminIssueReportController;
use App\Http\Controllers\AdminCollegeController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
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

// Public landing page.
Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
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

// Authenticated student dashboard.
Route::get('/dashboard', function () {
    $user = Auth::user();

    // Load the academic relations needed by the dashboard cards and widgets.
    $user->load('major', 'cartCourses', 'passedCourses');

    $passedHours = $user->passedCourses->sum('credit_hours');
    $gpaData = $user->calculateGPA();

    // Keep the payload focused on the fields rendered in the dashboard UI.
    $passedCourses = $user->passedCourses()
        ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
        ->withPivot('grade', 'studied_semester')
        ->get();

    return Inertia::render('Dashboard', [
        'passed_hours' => (int) $passedHours,
        'total_hours' => 132,
        'gpa' => $gpaData['gpa4'] ?? '0.00',
        'passed_courses' => $passedCourses,
        'cart_courses' => $user->cartCourses,
        'ai_skills' => $user->getSkillsFromPassedCourses(),
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

// Student-only application features.
Route::middleware('auth')->group(function () {
    // Student support and issue reporting.
    Route::get('/support/report-issue', [IssueReportController::class, 'create'])->name('support.issue.create');
    Route::post('/support/report-issue', [IssueReportController::class, 'store'])->name('support.issue.store');

    // Tree planner and course simulation features.
    Route::get('/tree', [TreeController::class, 'index'])->name('tree.index');
    Route::post('/tree/toggle', [TreeController::class, 'toggle'])->name('tree.toggle');

    // Synchronize the simulation cart with the backend.
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
        Route::get('/reports/demand', [AdminController::class, 'demandReport'])->name('reports.demand');
        Route::get('/reports/ai-insights', [AiAdvisorController::class, 'getAdminReports'])->name('reports.ai_insights');

        // Student management endpoints.
        Route::get('/students', [AdminStudentController::class, 'index'])->name('students.index');
        Route::put('/students/{student}', [AdminStudentController::class, 'update'])->name('students.update');
        Route::delete('/students/{student}', [AdminStudentController::class, 'destroy'])->name('students.destroy');

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

        // Academic structure management.
        Route::post('/colleges', [AdminController::class, 'storeCollege'])->name('colleges.store');
        Route::post('/majors', [AdminController::class, 'storeMajor'])->name('majors.store');

        // Colleges and landmarks management - complete CRUD with UI forms.
        Route::get('/colleges/list', [AdminCollegeController::class, 'indexColleges'])->name('colleges.index');
        Route::get('/colleges/new', [AdminCollegeController::class, 'createCollege'])->name('colleges.create');
        Route::post('/colleges/new', [AdminCollegeController::class, 'storeCollege'])->name('colleges.store_new');
        Route::get('/colleges/{college}/edit', [AdminCollegeController::class, 'editCollege'])->name('colleges.edit');
        Route::put('/colleges/{college}', [AdminCollegeController::class, 'updateCollege'])->name('colleges.update');
        Route::delete('/colleges/{college}', [AdminCollegeController::class, 'destroyCollege'])->name('colleges.destroy');

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
    });
});

require __DIR__ . '/auth.php';