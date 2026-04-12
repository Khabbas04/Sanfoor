<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
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
            $microsoftUser = Socialite::driver('azure')->user();
        } catch (Throwable $exception) {
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

        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'microsoft_id' => (string) $microsoftUser->getId(),
                'email_verified_at' => now(),
            ]
        );

        Auth::login($user, true);

        return redirect()->intended(route('dashboard'));
    }
}
