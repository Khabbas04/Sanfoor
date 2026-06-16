<?php

namespace App\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Events\Created as EloquentCreated;
use Illuminate\Database\Eloquent\Events\Updated as EloquentUpdated;
use Illuminate\Database\Eloquent\Events\Deleted as EloquentDeleted;
use App\Models\AdminLog;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use SocialiteProviders\Manager\SocialiteWasCalled;
use SocialiteProviders\Azure\AzureExtendSocialite;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register application services in the container.
     */
    public function register(): void
    {
        // No custom bindings are required here yet.
    }

    /**
     * Bootstrap cross-application services and runtime helpers.
     */
    public function boot(): void
    {
        // Register Microsoft Azure as a Socialite provider driver.
        Event::listen(SocialiteWasCalled::class, AzureExtendSocialite::class.'@handle');

        // Prefetch Vite chunks to improve perceived frontend performance.
        Vite::prefetch(concurrency: 3);

        // Register a custom mail macro that sends messages through the Brevo API.
        Mail::macro('brevo', function ($to, $subject, $html) {
            return Http::withHeaders([
                'api-key' => config('services.brevo.key'),
                'Content-Type' => 'application/json',
            ])->post('https://api.brevo.com/v3/smtp/email', [
                // Define the sender shown in outgoing transactional emails.
                'sender' => [
                    'email' => config('mail.from.address'),
                    'name' => config('mail.from.name'),
                ],

                // Brevo expects the recipients as an array of destination objects.
                'to' => [
                    ['email' => $to],
                ],

                // Pass through the subject and rendered HTML body as-is.
                'subject' => $subject,
                'htmlContent' => $html,
            ]);
        });



        Event::listen(\Illuminate\Auth\Events\Registered::class, function (\Illuminate\Auth\Events\Registered $event) {
            $url = config('services.discord.webhook_url');
            if ($url) {
                try {
                    $user = $event->user;
                    
                    $embed = [
                        'title' => '🎉 تسجيل مستخدم جديد',
                        'color' => 5814783, // Discord Blurple
                        'thumbnail' => [
                            'url' => $user->avatar ?? 'https://sanfoor.me/logo.png', // Fallback to your site logo
                        ],
                        'fields' => [
                            [
                                'name' => '👤 الاسم',
                                'value' => $user->name ?? 'غير معروف',
                                'inline' => true,
                            ],
                            [
                                'name' => '📧 الإيميل',
                                'value' => $user->email ?? 'غير معروف',
                                'inline' => true,
                            ],
                            [
                                'name' => '🎓 نوع الحساب',
                                'value' => ucfirst($user->role ?? 'student'),
                                'inline' => true,
                            ],
                            [
                                'name' => '🌐 IP Address',
                                'value' => $user->ip_address ?? request()->ip() ?? 'غير معروف',
                                'inline' => true,
                            ],
                        ],
                        'timestamp' => now()->toIso8601String(),
                        'footer' => [
                            'text' => 'Sanfoor System',
                            'icon_url' => 'https://sanfoor.me/logo.png',
                        ],
                    ];

                    Http::post($url, [
                        'embeds' => [$embed],
                    ]);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error('Failed to send Discord webhook', ['error' => $e->getMessage()]);
                }
            }
        });
    }
}