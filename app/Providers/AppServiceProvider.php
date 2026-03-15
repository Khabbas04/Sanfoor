<?php

namespace App\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

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
        // Prefetch Vite chunks to improve perceived frontend performance.
        Vite::prefetch(concurrency: 3);

        // Register a custom mail macro that sends messages through the Brevo API.
        Mail::macro('brevo', function ($to, $subject, $html) {
            return Http::withHeaders([
                'api-key' => env('BREVO_API_KEY'),
                'Content-Type' => 'application/json',
            ])->post('https://api.brevo.com/v3/smtp/email', [
                // Define the sender shown in outgoing transactional emails.
                'sender' => [
                    'email' => env('MAIL_FROM_ADDRESS'),
                    'name' => env('MAIL_FROM_NAME'),
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