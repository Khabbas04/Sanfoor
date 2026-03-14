<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        // 1. التحقق من بيانات الدخول
        $request->authenticate();

        // 2. تجديد الجلسة
        $request->session()->regenerate();

        // 3. تسجيل بيانات آخر دخول
        $request->user()->update([
            'ip_address' => $request->ip(),
            'last_login_at' => now(),
        ]);

        // 4. توجيه حسب الدور
        // owner يفتح على MainLayout (dashboard) مع إبقاء إمكانية دخول لوحة الإدارة يدوياً
        $role = strtolower((string) $request->user()->role);
        $targetRoute = $role === 'admin'
            ? 'admin.dashboard'
            : 'dashboard';

        return redirect()->route($targetRoute);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
