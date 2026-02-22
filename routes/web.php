<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Admin\AdminStudentController;
use App\Http\Controllers\TreeController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\GradeController;
use App\Http\Controllers\AIAdvisorController;
use App\Http\Controllers\CartController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

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
    $passedHours = $user->passedCourses()->sum('credit_hours');
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
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

// 3. مجموعة الروابط المحمية (تتطلب تسجيل دخول الطالب)
Route::middleware('auth')->group(function () {

    // الخطة الشجرية والمحاكي
    Route::get('/tree', [TreeController::class , 'index'])->name('tree.index');
    Route::post('/tree/toggle', [TreeController::class , 'toggle'])->name('tree.toggle');
    Route::post('/tree/ai-advisor', [AIAdvisorController::class , 'chat'])->name('tree.ai_advisor');
    Route::post('/tree/ai-plan', [AIAdvisorController::class , 'generatePlan'])->name('tree.ai_plan');
    
    // ✅ راوت مزامنة المحاكي (يجب أن يرجع JSON ليتوافق مع axios في الشجرة)
    Route::post('/cart/sync', [CartController::class , 'sync'])->name('cart.sync');

    // حاسبة التفوّق
    Route::get('/calculator', [GradeController::class , 'index'])->name('calculator.index');
    Route::post('/grades/update', [GradeController::class , 'update'])->name('grades.update');

    // المستشار الذكي
    Route::get('/ai-advisor', [AIAdvisorController::class , 'index'])->name('ai.advisor');
    Route::post('/ai-advisor/chat', [AIAdvisorController::class , 'chat'])->name('ai.advisor.chat');

    // الملف الشخصي
    Route::get('/profile', [ProfileController::class , 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class , 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class , 'destroy'])->name('profile.destroy');

    // 🔥 4. روابط الإدارة (محمية بميدلوير الأدمن) 🔥
    Route::middleware(['admin'])->prefix('admin')->name('admin.')->group(function () {
        
        // لوحة تحكم الأدمن
        Route::get('/dashboard', [AdminController::class , 'dashboard'])->name('dashboard');

        // ✅ إدارة الطلاب (تمت إضافة Update و Destroy)
        Route::get('/students', [AdminStudentController::class, 'index'])->name('students.index');
        Route::put('/students/{student}', [AdminStudentController::class, 'update'])->name('students.update');
        Route::delete('/students/{student}', [AdminStudentController::class, 'destroy'])->name('students.destroy');

        // إدارة المواد (CRUD)
        Route::get('/courses', [AdminController::class , 'index'])->name('courses');
        Route::post('/courses', [AdminController::class , 'store'])->name('courses.store');
        Route::put('/courses/{course}', [AdminController::class , 'update'])->name('courses.update');
        Route::delete('/courses/{course}', [AdminController::class , 'destroy'])->name('courses.destroy');

        // استيراد/تصدير وبيانات ضخمة
        Route::post('/courses/import', [AdminController::class , 'import'])->name('courses.import');
        Route::post('/courses/export', [AdminController::class , 'export'])->name('courses.export');
        Route::post('/courses/bulk-delete', [AdminController::class , 'bulkDelete'])->name('courses.bulk_delete');

        // الهيكلية (كليات وتخصصات)
        Route::post('/colleges', [AdminController::class , 'storeCollege'])->name('colleges.store');
        Route::post('/majors', [AdminController::class , 'storeMajor'])->name('majors.store');
        Route::get('/reports/demand', [AdminController::class, 'demandReport'])->name('reports.demand');
    });
});

require __DIR__ . '/auth.php';