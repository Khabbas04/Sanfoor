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

        // Global Eloquent event listeners to capture DB changes as owner-only logs.
        $modelNames = [
            'App\Models\User' => 'المستخدم',
            'App\Models\Course' => 'المادة الدراسية',
            'App\Models\Major' => 'التخصص',
            'App\Models\College' => 'الكلية',
            'App\Models\Message' => 'الرسالة',
            'App\Models\Chat' => 'المحادثة',
            'App\Models\SiteMaintenance' => 'وضع الصيانة',
            'App\Models\AcademicPeriod' => 'الفصل الأكاديمي',
            'App\Models\BannedUser' => 'حساب محظور',
        ];

        Event::listen(EloquentCreated::class, function ($event) use ($modelNames) {
            try {
                $model = $event->model ?? null;
                if (!$model) return;
                $class = get_class($model);
                if (Str::endsWith($class, 'AdminLog') || Str::endsWith($class, 'AdminNote')) return;

                $modelNameAr = $modelNames[$class] ?? class_basename($class);
                $meta = [
                    'event' => 'created',
                    'model' => $class,
                    'id' => $model->getKey(),
                    'route' => request()->path() ?? null,
                    'ip' => request()->ip() ?? null,
                    'user_agent' => request()->header('User-Agent') ?? null,
                ];

                AdminLog::create([
                    'user_id' => auth()->id() ?: null,
                    'action' => 'إضافة',
                    'details' => "تم إضافة ($modelNameAr) جديد برقم #{$model->getKey()}",
                    'ip_address' => request()->ip() ?? null,
                    'owner_only' => true,
                    'meta' => json_encode($meta),
                ]);
            } catch (\Throwable $e) {}
        });

        Event::listen(EloquentUpdated::class, function ($event) use ($modelNames) {
            try {
                $model = $event->model ?? null;
                if (!$model) return;
                $class = get_class($model);
                if (Str::endsWith($class, 'AdminLog') || Str::endsWith($class, 'AdminNote') || Str::endsWith($class, 'Session')) return;

                // Ignore minor updates like last_seen_at
                $changes = $model->getChanges();
                if (count($changes) === 1 && isset($changes['last_seen_at'])) return;
                if (count($changes) === 1 && isset($changes['updated_at'])) return;
                if (count($changes) === 2 && isset($changes['last_seen_at']) && isset($changes['updated_at'])) return;

                $modelNameAr = $modelNames[$class] ?? class_basename($class);
                $meta = [
                    'event' => 'updated',
                    'model' => $class,
                    'id' => $model->getKey(),
                    'route' => request()->path() ?? null,
                    'ip' => request()->ip() ?? null,
                    'user_agent' => request()->header('User-Agent') ?? null,
                ];

                AdminLog::create([
                    'user_id' => auth()->id() ?: null,
                    'action' => 'تعديل',
                    'details' => "تم تعديل بيانات ($modelNameAr) برقم #{$model->getKey()}",
                    'ip_address' => request()->ip() ?? null,
                    'owner_only' => true,
                    'meta' => json_encode($meta),
                ]);
            } catch (\Throwable $e) {}
        });

        Event::listen(EloquentDeleted::class, function ($event) use ($modelNames) {
            try {
                $model = $event->model ?? null;
                if (!$model) return;
                $class = get_class($model);
                if (Str::endsWith($class, 'AdminLog') || Str::endsWith($class, 'AdminNote') || Str::endsWith($class, 'Session')) return;

                $modelNameAr = $modelNames[$class] ?? class_basename($class);
                $meta = [
                    'event' => 'deleted',
                    'model' => $class,
                    'id' => $model->getKey(),
                    'route' => request()->path() ?? null,
                    'ip' => request()->ip() ?? null,
                    'user_agent' => request()->header('User-Agent') ?? null,
                ];

                AdminLog::create([
                    'user_id' => auth()->id() ?: null,
                    'action' => 'حذف',
                    'details' => "تم حذف ($modelNameAr) برقم #{$model->getKey()}",
                    'ip_address' => request()->ip() ?? null,
                    'owner_only' => true,
                    'meta' => json_encode($meta),
                ]);
            } catch (\Throwable $e) {}
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