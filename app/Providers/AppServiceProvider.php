<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Http;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Vite prefetch (كما كان)
        Vite::prefetch(concurrency: 3);

        // Macro لإرسال الإيميل عبر Brevo API
        Mail::macro('brevo', function ($to, $subject, $html) {

            return Http::withHeaders([
                'api-key' => env('BREVO_API_KEY'),
                'Content-Type' => 'application/json',
            ])->post('https://api.brevo.com/v3/smtp/email', [

                'sender' => [
                    'email' => env('MAIL_FROM_ADDRESS'),
                    'name'  => env('MAIL_FROM_NAME'),
                ],

                'to' => [
                    ['email' => $to]
                ],

                'subject' => $subject,

                'htmlContent' => $html,

            ]);
        });
    }
}