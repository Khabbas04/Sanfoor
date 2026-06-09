<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\University; // 🔥 استدعاء مودل الجامعة
use App\Models\College;    // 🔥 استدعاء مودل الكلية
use App\Models\Major;      // 🔥 استدعاء مودل التخصص
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register', [
            // 🔥 إرسال الهيكلة الأكاديمية كاملة لصفحة التسجيل لتشغيل القوائم المترابطة
            'universities' => University::all(),
            'colleges' => College::withoutGlobalScopes()->get(),
            'majors' => Major::withoutGlobalScopes()->get(),
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'major_id' => 'required|exists:majors,id', // 🔥 إجبار الطالب على اختيار تخصص صحيح
            'study_plan_version' => 'required|integer|in:11,12',
        ]);

        $user = User::forceCreate([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'major_id' => $request->major_id, // 🔥 ربط الطالب بتخصصه في قاعدة البيانات
            'study_plan_version' => $request->study_plan_version,
            'role' => 'student', // 🔥 إعطاء المستخدم صلاحية "طالب" كقيمة افتراضية
        ]);

        event(new Registered($user));

        // Log a NEW_USER_REGISTERED event for the admin notification system.
        try {
            \App\Models\AdminLog::create([
                'user_id' => $user->id,
                'action' => 'NEW_USER_REGISTERED',
                'details' => sprintf(
                    'مستخدم جديد سجّل يدوياً: %s (%s) | role: %s | ip: %s',
                    $user->name,
                    $user->email,
                    $user->role ?? 'student',
                    $request->ip()
                ),
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to log NEW_USER_REGISTERED', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        Auth::login($user);

        return redirect()->route('home', ['tour' => 'start']);
    }
}