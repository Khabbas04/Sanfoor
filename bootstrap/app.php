<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

// Bootstrap the Laravel application and register the main runtime configuration.
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        // Register the main route files used by the application.
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Append project-specific middleware to the default web stack.
        $middleware->web(append: [
            \App\Http\Middleware\EnsureHostIsCorrect::class,
            \App\Http\Middleware\EnsureSiteMaintenance::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\UpdateLastSeenAt::class,
            \App\Http\Middleware\EnsureMajorSelected::class,
            \App\Http\Middleware\GuestDemoMiddleware::class,
        ]);

        // Register short aliases for role-based access control middleware.
        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'owner' => \App\Http\Middleware\OwnerMiddleware::class,
            'instructor' => \App\Http\Middleware\InstructorMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->respond(function ($response, $e, $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return $response;
            }

            if ($response->getStatusCode() === 404) {
                return \Inertia\Inertia::render('System/Error', [
                    'status' => 404,
                ])->toResponse($request)->setStatusCode(404);
            }

            if (!app()->environment('local') && in_array($response->getStatusCode(), [500, 503, 403])) {
                return \Inertia\Inertia::render('System/Error', [
                    'status' => $response->getStatusCode(),
                ])->toResponse($request)->setStatusCode($response->getStatusCode());
            }

            return $response;
        });
    })->create();