<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class OwnerMiddleware
{
    /**
     * Restrict access to owner-only actions.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Force authentication before checking the elevated owner role.
        if (!Auth::check()) {
            return redirect()->route('login');
        }

        // Normalize the saved role to avoid casing issues across environments.
        $role = strtolower((string) Auth::user()->role);

        if ($role === 'owner') {
            return $next($request);
        }

        // Send non-owners back to the admin dashboard with a clear error message.
        return redirect('/admin/dashboard')->with([
            'message' => 'هذه الصفحة متاحة للـ Owner فقط.',
            'type' => 'error',
        ]);
    }
}
