<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;

class AdminMiddleware
{
    /**
     * التحقق من صلاحيات المسؤول قبل تمرير الطلب.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 1. التحقق إذا كان المستخدم مسجل دخوله أصلاً
        if (!Auth::check()) {
            return redirect()->route('login');
        }

        // 2. التحقق من قيمة الـ role في جدول المستخدمين
        // تأكد أن الحقل في قاعدة البيانات اسمه role وقيمته للأدمن هي 'admin'
        if (Auth::user()->role === 'admin') {
            return $next($request);
        }

        // 3. إذا لم يكن أدمن، يتم طرده إلى الصفحة الرئيسية مع رسالة تنبيه
        return redirect('/')->with([
            'message' => 'عذراً، لا تمتلك صلاحيات الوصول للوحة التحكم.',
            'type'    => 'error'
        ]);
    }
}