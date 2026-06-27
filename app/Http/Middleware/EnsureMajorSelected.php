<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureMajorSelected
{
    /**
     * Routes that students without a major are still allowed to reach.
     * All other authenticated routes will redirect to the profile completion page.
     */
    private const ALLOWED_ROUTES = [
        'complete-profile',
        'profile.complete',
        'profile.complete.update',
        'profile.edit',
        'profile.update',
        'logout',
        'heartbeat',
        'browser_close',
        'admin.api.heartbeat',
        'admin.api.browser_close',
        'verification.notice',
        'verification.verify',
        'verification.send',
    ];

    /**
     * URI prefixes that should be allowed even when major is not set.
     */
    private const ALLOWED_URI_PREFIXES = [
        'api/heartbeat',
        'api/browser-close',
        'complete-profile',
        'verify-email',
    ];

    /**
     * Force students without a selected major to complete their profile.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!Auth::check()) {
            return $next($request);
        }

        $user = Auth::user();
        $role = strtolower(trim((string) ($user->role ?? '')));

        // Only enforce for students and guests – admins, owners, and instructors are exempt.
        if (!in_array($role, ['student', 'guest'], true)) {
            return $next($request);
        }

        // Student already chose their major – allow through.
        if (!empty($user->major_id)) {
            return $next($request);
        }

        // Check if the current route is in the allowed list.
        $routeName = $request->route()?->getName();
        if ($routeName && in_array($routeName, self::ALLOWED_ROUTES, true)) {
            return $next($request);
        }

        // Check if the URI starts with an allowed prefix.
        $uri = ltrim($request->getPathInfo(), '/');
        foreach (self::ALLOWED_URI_PREFIXES as $prefix) {
            if (str_starts_with($uri, $prefix)) {
                return $next($request);
            }
        }

        // Redirect to the profile completion page.
        return redirect()->route('profile.complete');
    }
}
