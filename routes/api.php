<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AiAdvisorController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// رابط جلب بيانات المستخدم الحالي (افتراضي)
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// 🔥 رابط الشات مع سنفور (API)
// هذا هو الرابط الذي سيستخدمه تطبيق الفلاتر: http://127.0.0.1:8000/api/ai/chat
Route::post('/ai/chat', [AiAdvisorController::class, 'chat']);

// رابط لجلب محادثات الطالب السابقة (إذا أردت عرضها في التطبيق)
Route::middleware('auth:sanctum')->get('/ai/history', [AiAdvisorController::class, 'index']);