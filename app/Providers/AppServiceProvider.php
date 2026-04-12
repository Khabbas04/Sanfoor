<?php

namespace App\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Event;
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
    }
}