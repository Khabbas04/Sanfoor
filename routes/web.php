<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\TreeController;
use App\Http\Controllers\AdminController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

// الصفحة الرئيسية
Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

// لوحة التحكم (الداشبورد) للمستخدم العادي
Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// --- مجموعة الروابط المحمية (تتطلب تسجيل دخول) ---
Route::middleware('auth')->group(function () {
    
    // 1. روابط الخطة الشجرية
    Route::get('/tree', [TreeController::class, 'index'])->name('tree.index');
    
    // 🔥 هذا هو الرابط الذي كان ناقصاً وهو المسؤول عن حفظ الإنجاز عند النقر 🔥
    Route::post('/tree/toggle', [TreeController::class, 'toggleCourse'])->name('tree.toggle');

    // 2. روابط الملف الشخصي
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // 3. روابط الأدمن (Admin Routes)
    // أ) لوحة تحكم الأدمن
    Route::get('/admin/dashboard', [AdminController::class, 'dashboard'])->name('admin.dashboard');

    // ب) إدارة المواد (عرض + إضافة يدوية)
    Route::get('/admin/courses', [AdminController::class, 'index'])->name('admin.courses');
    Route::post('/admin/courses', [AdminController::class, 'store'])->name('admin.courses.store');

    // ج) العمليات المتقدمة (استيراد، تصدير، حذف جماعي)
    Route::post('/admin/courses/import', [AdminController::class, 'import'])->name('admin.courses.import');
    Route::post('/admin/courses/export', [AdminController::class, 'export'])->name('admin.courses.export');
    Route::post('/admin/courses/bulk-delete', [AdminController::class, 'bulkDelete'])->name('admin.courses.bulk_delete');
});

require __DIR__.'/auth.php';