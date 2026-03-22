<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\AdminLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

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

        $user = $request->user();

        // 3. تسجيل بيانات آخر دخول
        $user->update([
            'ip_address' => $request->ip(),
            'last_login_at' => now(),
        ]);

        // 4. حفظ سجل دخول مستقل لمتابعة من يسجل الدخول ومتى.
        try {
            AdminLog::create([
                'user_id' => $user->id,
                'action' => 'USER_LOGIN',
                'details' => sprintf(
                    'User login: %s (%s) | role: %s | ip: %s',
                    $user->name,
                    $user->email,
                    $user->role,
                    $request->ip()
                ),
                'ip_address' => $request->ip(),
            ]);
        } catch (Throwable $e) {
            Log::warning('Failed to write USER_LOGIN admin log', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        // 5. توجيه حسب الدور
        // owner يأخذ نفس مسار admin بالكامل
        $role = strtolower((string) $user->role);
        $targetRoute = in_array($role, ['admin', 'owner'], true)
            ? 'admin.dashboard'
            : 'dashboard';

        return redirect()->route($targetRoute);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        try {
            Auth::guard('web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }
        } catch (Throwable $e) {
            report($e);
        }

        return redirect('/');
    }
}
