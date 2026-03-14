<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Admin\AdminManagerController;
use App\Http\Controllers\Admin\AdminStudentController;
use App\Http\Controllers\TreeController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\AiAdvisorController;
use App\Http\Controllers\CartController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/* |-------------------------------------------------------------------------- | Web Routes |-------------------------------------------------------------------------- */

// 1. الصفحة الرئيسية
Route::get('/', function () {
    return Inertia::render('Welcome', [
    'canLogin' => Route::has('login'),
    'canRegister' => Route::has('register'),
    'laravelVersion' => Application::VERSION,
    'phpVersion' => PHP_VERSION,
    ]);
});

// 2. لوحة تحكم الطالب (Dashboard)
Route::get('/dashboard', function () {
    $user = Auth::user();

    $user->load('major', 'cartCourses', 'passedCourses');

    $passedHours = $user->passedCourses->sum('credit_hours');
    $gpaData = $user->calculateGPA();

    $passedCourses = $user->passedCourses()
        ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
        ->withPivot('grade', 'studied_semester')
        ->get();

    return Inertia::render('Dashboard', [
    'passed_hours' => (int)$passedHours,
    'total_hours' => 132,
    'gpa' => $gpaData['gpa4'] ?? '0.00',
    'passed_courses' => $passedCourses,
    'cart_courses' => $user->cartCourses,
    'ai_skills' => $user->getSkillsFromPassedCourses(),
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

// 3. مجموعة الروابط المحمية (الطلاب)
Route::middleware('auth')->group(function () {

    // الخطة الشجرية والمحاكي
    Route::get('/tree', [TreeController::class , 'index'])->name('tree.index');
    Route::post('/tree/toggle', [TreeController::class , 'toggle'])->name('tree.toggle');

    // مزامنة المحاكي
    Route::post('/cart/sync', [CartController::class , 'sync'])->name('cart.sync');

    // إضافة/إزالة مادة واحدة للمحاكي (يستخدمه الـ AI Agent والشجرة)
    Route::post('/cart/toggle-single', [TreeController::class , 'toggleSingleCart'])->name('cart.toggle.single');

    // حاسبة التفوّق (GPA Simulator)
    Route::get('/calculator', [GradeController::class , 'index'])->name('calculator.index');
    Route::post('/grades/update', [GradeController::class , 'update'])->name('grades.update');

    // ==========================================
    // 🏢 دليل المباني (Campus Directory)
    // ==========================================
    Route::get('/campus-directory', function () {
            return Inertia::render('Campus/Directory');
        }
        )->name('campus.directory');

        // ==========================================
        // 🤖 المستشار الذكي "سنفور" (AI Agent)
        // ==========================================
        Route::get('/ai-advisor', [AiAdvisorController::class , 'index'])->name('ai.advisor');
        Route::post('/ai-advisor/chat', [AiAdvisorController::class , 'chat'])->name('ai.advisor.chat');
        Route::get('/ai-advisor/chat/{chat_id}', [AiAdvisorController::class , 'getMessages'])->name('ai.advisor.messages');

        // إعادة توليد آخر رد AI
        Route::post('/ai-advisor/regenerate', [AiAdvisorController::class , 'regenerate'])->name('ai.advisor.regenerate');

        // تقييم رد AI (👍/👎)
        Route::post('/ai-advisor/feedback', [AiAdvisorController::class , 'feedback'])->name('ai.advisor.feedback');

        // ⚠️ مهم: حذف الكل لازم ييجي قبل حذف واحدة عشان Laravel ما تعتبر "all" كـ {chat_id}
        Route::delete('/ai-advisor/chats/all', [AiAdvisorController::class , 'destroyAll'])->name('ai.advisor.delete.all');
        Route::delete('/ai-advisor/chat/{chat_id}', [AiAdvisorController::class , 'destroy'])->name('ai.advisor.delete');

        // الملف الشخصي
        Route::get('/profile', [ProfileController::class , 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class , 'update'])->name('profile.update');
        Route::delete('/profile', [ProfileController::class , 'destroy'])->name('profile.destroy');

        // ==========================================
        // 🔥 4. روابط الإدارة (محمية بميدلوير الأدمن)
        // ==========================================
        Route::middleware(['admin'])->prefix('admin')->name('admin.')->group(function () {

            Route::get('/dashboard', [AdminController::class , 'dashboard'])->name('dashboard');
            Route::get('/reports/demand', [AdminController::class , 'demandReport'])->name('reports.demand');
            Route::get('/reports/ai-insights', [AiAdvisorController::class , 'getAdminReports'])->name('reports.ai_insights');

            // إدارة الطلاب
            Route::get('/students', [AdminStudentController::class , 'index'])->name('students.index');
            Route::put('/students/{student}', [AdminStudentController::class , 'update'])->name('students.update');
            Route::delete('/students/{student}', [AdminStudentController::class , 'destroy'])->name('students.destroy');

            // إدارة المواد (CRUD)
            Route::get('/courses', [AdminController::class , 'index'])->name('courses');
            Route::post('/courses', [AdminController::class , 'store'])->name('courses.store');
            Route::put('/courses/{course}', [AdminController::class , 'update'])->name('courses.update');
            Route::delete('/courses/{course}', [AdminController::class , 'destroy'])->name('courses.destroy');

            // الأدوات المتقدمة
            Route::post('/courses/import', [AdminController::class , 'import'])->name('courses.import');
            Route::post('/courses/export', [AdminController::class , 'export'])->name('courses.export');
            Route::post('/courses/bulk-delete', [AdminController::class , 'bulkDelete'])->name('courses.bulk_delete');

            // الهيكلية الأكاديمية
            Route::post('/colleges', [AdminController::class , 'storeCollege'])->name('colleges.store');
            Route::post('/majors', [AdminController::class , 'storeMajor'])->name('majors.store');

            // إدارة الأدمنز (Owner فقط)
            Route::middleware(['owner'])->group(function () {
                Route::get('/admins', [AdminManagerController::class, 'index'])->name('admins.index');
                Route::post('/admins/promote', [AdminManagerController::class, 'promote'])->name('admins.promote');
                Route::put('/admins/{user}/role', [AdminManagerController::class, 'updateRole'])->name('admins.update_role');
                Route::delete('/admins/{user}', [AdminManagerController::class, 'destroy'])->name('admins.destroy');
            });
        }
        );    });

require __DIR__ . '/auth.php';