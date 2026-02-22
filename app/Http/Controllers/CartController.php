<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CartController extends Controller
{
    /**
     * تحديث المحاكي بالكامل للمستخدم.
     * تم التعديل ليدعم الاستجابة الصامتة لمنع ظهور رسالة الـ JSON البيضاء.
     */
    public function sync(Request $request)
    {
        // 1. التحقق من صحة البيانات القادمة
        $request->validate([
            'course_ids' => 'present|array', 
            'course_ids.*' => 'integer|exists:courses,id'
        ]);

        $user = Auth::user();

        /**
         * 2. المزامنة (Sync)
         * تحديث جدول user_carts فوراً لضمان ظهور البيانات في لوحة الأدمن.
         */
        $user->cartCourses()->sync($request->course_ids);

        /**
         * 3. الإرجاع (Return)
         * نستخدم back() بدلاً من response()->json لكي تفهم Inertia الطلب ولا تظهر النافذة البيضاء.
         */
        return back()->with('success', 'تم تحديث المحاكي بنجاح');
    }
}