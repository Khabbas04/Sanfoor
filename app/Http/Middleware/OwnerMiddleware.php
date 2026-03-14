<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class OwnerMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!Auth::check()) {
            return redirect()->route('login');
        }

        if (Auth::user()->role === 'owner') {
            return $next($request);
        }

        return redirect('/admin/dashboard')->with([
            'message' => 'هذه الصفحة متاحة للـ Owner فقط.',
            'type' => 'error',
        ]);
    }
}
