<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
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
        return Socialite::driver('azure')
            ->scopes(['openid', 'profile', 'email', 'User.Read'])
            ->redirect();
    }

    public function handleMicrosoftCallback(Request $request)
    {
        try {
            $microsoftUser = Socialite::driver('azure')->stateless()->user();
            $microsoftId = filled($microsoftUser->getId()) ? (string) $microsoftUser->getId() : null;

            $email = strtolower(trim((string) (
                $microsoftUser->getEmail()
                ?? data_get($microsoftUser->user, 'mail')
                ?? data_get($microsoftUser->user, 'userPrincipalName')
                ?? data_get($microsoftUser->user, 'preferred_username')
            )));

            $isZuDomain = (bool) preg_match('/@([a-z0-9-]+\.)*zu\.edu\.jo$/i', $email);

            if ($email === '' || !$isZuDomain) {
                return redirect()->route('login')->with([
                    'message' => 'يسمح فقط ببريد جامعة الزرقاء: zu.edu.jo',
                    'type' => 'error',
                    'status' => 'يسمح فقط ببريد جامعة الزرقاء: zu.edu.jo',
                ]);
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

            $columns = array_flip(Schema::getColumnListing('users'));

            $knownEmails = collect([
                $email,
                strtolower((string) data_get($microsoftUser->user, 'userPrincipalName')),
                strtolower((string) data_get($microsoftUser->user, 'preferred_username')),
            ])->filter()->unique()->values();

            $user = null;

            if (isset($columns['microsoft_id']) && filled($microsoftId)) {
                $user = User::query()->where('microsoft_id', $microsoftId)->first();
            }

            if (!$user) {
                foreach ($knownEmails as $knownEmail) {
                    $candidate = User::query()
                        ->whereRaw('LOWER(email) = ?', [strtolower($knownEmail)])
                        ->first();

                    if ($candidate) {
                        $user = $candidate;
                        break;
                    }
                }
            }

            if (!$user) {
                $username = strtolower(Str::before($email, '@'));

                if (filled($username)) {
                    $user = User::query()
                        ->whereRaw('LOWER(email) LIKE ?', [$username.'@%zu.edu.jo'])
                        ->orderByDesc('last_login_at')
                        ->first();
                }
            }

            if (!$user) {
                $user = new User();
                $user->email = $email;
            }

            if (isset($columns['name'])) {
                $user->name = $name;
            }

            if (isset($columns['email_verified_at'])) {
                $user->email_verified_at = now();
            }

            if (isset($columns['last_login_at'])) {
                $user->last_login_at = now();
            }

            if (isset($columns['ip_address'])) {
                $user->ip_address = $request->ip();
            }

            if (isset($columns['microsoft_id']) && filled($microsoftId)) {
                $user->microsoft_id = $microsoftId;
            }

            if (!$user->exists && isset($columns['password'])) {
                $user->password = Hash::make(Str::random(64));
            }

            if (!$user->exists && isset($columns['role']) && blank($user->role)) {
                $user->role = 'student';
            }

            if (!$user->exists && isset($columns['study_plan_version']) && blank($user->study_plan_version)) {
                $user->study_plan_version = 12;
            }

            $user->save();

            Auth::guard('web')->login($user, true);
            $request->session()->regenerate();

            // Keep Microsoft logins visible in the same admin login feed.
            try {
                AdminLog::create([
                    'user_id' => $user->id,
                    'action' => 'USER_LOGIN',
                    'details' => sprintf(
                        'User login via Microsoft: %s (%s) | role: %s | ip: %s',
                        $user->name,
                        $user->email,
                        $user->role,
                        $request->ip()
                    ),
                    'ip_address' => $request->ip(),
                ]);
            } catch (Throwable $logException) {
                Log::warning('Failed to write USER_LOGIN admin log for Microsoft login', [
                    'user_id' => $user->id,
                    'error' => $logException->getMessage(),
                ]);
            }

            if (blank($user->major_id)) {
                return redirect()->route('profile.edit')->with([
                    'status' => 'تم تسجيل الدخول بنجاح. يرجى إكمال الكلية والتخصص والخطة الدراسية من صفحة الملف الشخصي.',
                ]);
            }

            return redirect()->route('dashboard');
        } catch (Throwable $exception) {
            Log::error('Microsoft login callback failed', [
                'message' => $exception->getMessage(),
                'exception' => $exception::class,
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            return redirect()->route('login')->with([
                'message' => 'فشل تسجيل الدخول عبر مايكروسوفت. حاول مرة أخرى.',
                'type' => 'error',
                'status' => 'فشل تسجيل الدخول عبر مايكروسوفت. حاول مرة أخرى.',
            ]);
        }
    }
}
