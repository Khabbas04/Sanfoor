<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
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
        if (Auth::check() && Schema::hasColumn('users', 'last_seen_at')) {
            // Update the last_seen_at column for the currently authenticated user
            User::where('id', Auth::id())->update(['last_seen_at' => now()]);
        }

        return $next($request);
    }
}
