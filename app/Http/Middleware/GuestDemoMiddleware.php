<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class GuestDemoMiddleware
{
    /**
     * Routes that guest demo users ARE allowed to POST to.
     * Everything else that mutates data is blocked.
     */
    private const ALLOWED_WRITE_ROUTES = [
        'logout',
        'heartbeat',
        'browser_close',
        'admin.api.heartbeat',
        'admin.api.browser_close',
        'profile.complete.update',
        'ai.advisor.chat',
        'ai.advisor.regenerate',
        'ai.advisor.feedback',
        'ai.advisor.delete',
        'ai.advisor.delete.all',
    ];

    /**
     * URI prefixes that guests are still allowed to POST to.
     */
    private const ALLOWED_WRITE_URI_PREFIXES = [
        'api/heartbeat',
        'api/browser-close',
        'logout',
        'complete-profile',
        'ai-advisor',
    ];

    /**
     * Block write operations (POST, PUT, PATCH, DELETE) for guest demo users.
     *
     * Read operations (GET, HEAD, OPTIONS) are always allowed so the guest
     * can browse every page and experience the full UI.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! Auth::check()) {
            return $next($request);
        }

        $user = Auth::user();
        $role = strtolower(trim((string) ($user->role ?? '')));

        // Only restrict guest role users.
        if ($role !== 'guest') {
            return $next($request);
        }

        // Allow all read operations.
        if ($request->isMethod('GET') || $request->isMethod('HEAD') || $request->isMethod('OPTIONS')) {
            return $next($request);
        }

        // Check if this write route is explicitly allowed.
        $routeName = $request->route()?->getName();
        if ($routeName && in_array($routeName, self::ALLOWED_WRITE_ROUTES, true)) {
            return $next($request);
        }

        // Check URI prefix allowlist.
        $uri = ltrim($request->getPathInfo(), '/');
        foreach (self::ALLOWED_WRITE_URI_PREFIXES as $prefix) {
            if (str_starts_with($uri, $prefix)) {
                return $next($request);
            }
        }

        // Block the write request.
        // For Inertia and normal web requests, we redirect back with a flash message 
        // to show a beautiful toast instead of throwing a generic error.
        // If it's a raw non-Inertia API call, return JSON.
        if ($request->expectsJson() && !$request->header('X-Inertia')) {
            return response()->json([
                'message' => 'هذه الميزة غير متاحة في الوضع التجريبي. سجل بحسابك للوصول الكامل!',
            ], 403);
        }

        return redirect()->back()->with([
            'message' => '🎫 هذه الميزة غير متاحة في الوضع التجريبي — استكشف المنصة أولاً!',
            'type'    => 'warning',
        ]);
    }
}
