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
        Event::listen(EloquentCreated::class, function ($event) {
            try {
                $model = $event->model ?? null;
                if (!$model) return;
                $class = get_class($model);
                // Avoid logging admin logs themselves to prevent recursion
                if (Str::endsWith($class, 'AdminLog') || Str::endsWith($class, 'AdminNote')) return;

                $meta = [
                    'event' => 'created',
                    'model' => $class,
                    'id' => $model->getKey(),
                    'attributes' => $model->getAttributes(),
                    'route' => request()->path() ?? null,
                    'ip' => request()->ip() ?? null,
                    'user_agent' => request()->header('User-Agent') ?? null,
                ];

                AdminLog::create([
                    'user_id' => auth()->id() ?: null,
                    'action' => 'MODEL_CREATED',
                    'details' => "Created {$class} id=" . ($model->getKey() ?? 'null'),
                    'ip_address' => request()->ip() ?? null,
                    'owner_only' => true,
                    'meta' => json_encode($meta),
                ]);
            } catch (\Throwable $e) {
                // swallow errors to avoid breaking requests
            }
        });

        Event::listen(EloquentUpdated::class, function ($event) {
            try {
                $model = $event->model ?? null;
                if (!$model) return;
                $class = get_class($model);
                if (Str::endsWith($class, 'AdminLog') || Str::endsWith($class, 'AdminNote')) return;

                $meta = [
                    'event' => 'updated',
                    'model' => $class,
                    'id' => $model->getKey(),
                    'changes' => $model->getChanges(),
                    'original' => $model->getOriginal(),
                    'route' => request()->path() ?? null,
                    'ip' => request()->ip() ?? null,
                    'user_agent' => request()->header('User-Agent') ?? null,
                ];

                AdminLog::create([
                    'user_id' => auth()->id() ?: null,
                    'action' => 'MODEL_UPDATED',
                    'details' => "Updated {$class} id=" . ($model->getKey() ?? 'null'),
                    'ip_address' => request()->ip() ?? null,
                    'owner_only' => true,
                    'meta' => json_encode($meta),
                ]);
            } catch (\Throwable $e) {
            }
        });

        Event::listen(EloquentDeleted::class, function ($event) {
            try {
                $model = $event->model ?? null;
                if (!$model) return;
                $class = get_class($model);
                if (Str::endsWith($class, 'AdminLog') || Str::endsWith($class, 'AdminNote')) return;

                $meta = [
                    'event' => 'deleted',
                    'model' => $class,
                    'id' => $model->getKey(),
                    'attributes' => $model->getAttributes(),
                    'route' => request()->path() ?? null,
                    'ip' => request()->ip() ?? null,
                    'user_agent' => request()->header('User-Agent') ?? null,
                ];

                AdminLog::create([
                    'user_id' => auth()->id() ?: null,
                    'action' => 'MODEL_DELETED',
                    'details' => "Deleted {$class} id=" . ($model->getKey() ?? 'null'),
                    'ip_address' => request()->ip() ?? null,
                    'owner_only' => true,
                    'meta' => json_encode($meta),
                ]);
            } catch (\Throwable $e) {
            }
        });
        Event::listen(\Illuminate\Auth\Events\Registered::class, function (\Illuminate\Auth\Events\Registered $event) {
            $url = config('services.discord.webhook_url');
            if ($url) {
                try {
                    $user = $event->user;
                    $name = $user->name ?? 'طالب جديد';
                    $email = $user->email ?? 'بدون إيميل';
                    $role = $user->role ?? 'student';
                    
                    $message = "🎉 **تسجيل جديد في سنفور!** 🎉\n\n";
                    $message .= "👤 **الاسم:** {$name}\n";
                    $message .= "📧 **الإيميل:** {$email}\n";
                    $message .= "🎓 **النوع:** {$role}\n";
                    
                    Http::post($url, [
                        'content' => $message,
                    ]);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error('Failed to send Discord webhook', ['error' => $e->getMessage()]);
                }
            }
        });
    }
}