<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Throwable;

class MicrosoftAuthController extends Controller
{
    public function redirectToMicrosoft()
    {
        return Socialite::driver('azure')->redirect();
    }

    public function handleMicrosoftCallback(Request $request)
    {
        try {
            $microsoftUser = Socialite::driver('azure')->stateless()->user();

            $email = strtolower((string) (
                $microsoftUser->getEmail()
                ?? data_get($microsoftUser->user, 'mail')
                ?? data_get($microsoftUser->user, 'userPrincipalName')
                ?? data_get($microsoftUser->user, 'preferred_username')
            ));

            if ($email === '' || !Str::endsWith($email, 'zu.edu.jo')) {
                return redirect('/')->with('error', 'يسمح فقط ببريد جامعة الزيتونة: zu.edu.jo');
            }

            $profileName = trim(implode(' ', array_filter([
                data_get($microsoftUser->user, 'givenName'),
                data_get($microsoftUser->user, 'surname'),
            ])));

            $name = collect([
                $microsoftUser->getName(),
                data_get($microsoftUser->user, 'displayName'),
                $profileName,
                data_get($microsoftUser->user, 'name'),
                Str::before($email, '@'),
            ])->first(fn ($value) => filled($value));

            $user = User::firstOrNew(['email' => $email]);

            $user->name = $name;
            $user->email_verified_at = now();
            $user->last_login_at = now();

            if (Schema::hasColumn('users', 'microsoft_id')) {
                $user->microsoft_id = (string) $microsoftUser->getId();
            }

            if (!$user->exists) {
                $user->password = Hash::make(Str::random(64));
                $user->role = $user->role ?: 'student';
            }

            $user->save();

            Auth::login($user, true);
            $request->session()->regenerate();

            return redirect()->route('dashboard');
        } catch (Throwable $exception) {
            Log::error('Microsoft login callback failed', [
                'message' => $exception->getMessage(),
                'exception' => $exception::class,
            ]);

            return redirect()->route('login')->with('error', 'فشل تسجيل الدخول عبر مايكروسوفت. حاول مرة أخرى.');
        }
    }
}
