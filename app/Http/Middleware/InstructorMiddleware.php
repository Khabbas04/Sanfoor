<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InstructorMiddleware
{
    /**
     * Allow access for instructor, admin, and owner users.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!Auth::check()) {
            return redirect()->route('login');
        }

        $role = strtolower((string) Auth::user()->role);

        if (in_array($role, ['instructor', 'admin', 'owner'], true)) {
            return $next($request);
        }

        return redirect('/')->with([
            'message' => 'عذراً، هذه الصفحة مخصصة للكادر التدريسي فقط.',
            'type' => 'error',
        ]);
    }
}
