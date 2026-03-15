<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    /**
     * Allow access only for admin-level users.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Redirect guests to the login page before checking roles.
        if (!Auth::check()) {
            return redirect()->route('login');
        }

        // Normalize the role to keep authorization checks case-insensitive.
        $role = strtolower((string) Auth::user()->role);

        if (in_array($role, ['admin', 'owner'], true)) {
            return $next($request);
        }

        // Reject non-admin users and send them back with a flash message.
        return redirect('/')->with([
            'message' => 'عذراً، لا تمتلك صلاحيات الوصول للوحة التحكم.',
            'type' => 'error',
        ]);
    }
}