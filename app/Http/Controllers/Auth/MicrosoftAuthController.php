<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
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

    public function handleMicrosoftCallback()
    {
        try {
            $microsoftUser = Socialite::driver('azure')->stateless()->user();
        } catch (Throwable $exception) {
            Log::error('Microsoft login callback failed', [
                'message' => $exception->getMessage(),
                'exception' => $exception::class,
            ]);

            return redirect('/')->with('error', 'فشل تسجيل الدخول عبر مايكروسوفت. حاول مرة أخرى.');
        }

        $email = strtolower((string) (
            $microsoftUser->getEmail()
            ?? data_get($microsoftUser->user, 'mail')
            ?? data_get($microsoftUser->user, 'userPrincipalName')
        ));

        if ($email === '' || !Str::endsWith($email, 'zu.edu.jo')) {
            return redirect('/')->with('error', 'يسمح فقط ببريد جامعة الزيتونة: zu.edu.jo');
        }

        $name = $microsoftUser->getName()
            ?? data_get($microsoftUser->user, 'displayName')
            ?? Str::before($email, '@');

        $userData = [
            'name' => $name,
            'email_verified_at' => now(),
        ];

        if (Schema::hasColumn('users', 'microsoft_id')) {
            $userData['microsoft_id'] = (string) $microsoftUser->getId();
        }

        $user = User::updateOrCreate(
            ['email' => $email],
            $userData
        );

        Auth::login($user, true);

        return redirect()->intended(route('dashboard'));
    }
}
