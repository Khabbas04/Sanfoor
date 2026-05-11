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
            'colleges' => College::all(),
            'majors' => Major::all(),
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
            'email' => [
                'required',
                'string',
                'lowercase',
                'email',
                'max:255',
                'unique:'.User::class,
                function ($attribute, $value, $fail) {
                    if (!preg_match('/@([a-z0-9-]+\.)*zu\.edu\.jo$/i', $value)) {
                        $fail('يسمح فقط بالتسجيل باستخدام بريد جامعة الزرقاء (zu.edu.jo).');
                    }
                },
            ],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'major_id' => 'required|exists:majors,id', // 🔥 إجبار الطالب على اختيار تخصص صحيح
            'study_plan_version' => 'required|integer|in:11,12',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'major_id' => $request->major_id, // 🔥 ربط الطالب بتخصصه في قاعدة البيانات
            'study_plan_version' => $request->study_plan_version,
            'role' => 'student', // 🔥 إعطاء المستخدم صلاحية "طالب" كقيمة افتراضية
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}