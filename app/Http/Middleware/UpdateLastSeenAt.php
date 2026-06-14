<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class UpdateLastSeenAt
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::check()) {
            $userId = Auth::id();
            $cacheKey = "user_last_seen_{$userId}";

            // Only update the database once every 5 minutes per user
            // This prevents a heavy database write on every single page navigation
            if (!\Illuminate\Support\Facades\Cache::has($cacheKey)) {
                User::where('id', $userId)->update(['last_seen_at' => now()]);
                \Illuminate\Support\Facades\Cache::put($cacheKey, true, now()->addMinutes(5));
            }
        }

        return $next($request);
    }
}
