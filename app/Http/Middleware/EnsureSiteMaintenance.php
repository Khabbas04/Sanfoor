<?php

namespace App\Http\Middleware;

use App\Models\SiteMaintenance;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSiteMaintenance
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $maintenance = SiteMaintenance::current();

        if (!$maintenance || !$maintenance->is_enabled) {
            return $next($request);
        }

        if ($request->routeIs('system.maintenance')) {
            return $next($request);
        }

        $user = $request->user();
        $normalizedRole = strtolower(trim((string) ($user->role ?? '')));
        if ($user && in_array($normalizedRole, ['admin', 'owner'], true)) {
            return $next($request);
        }

        return redirect()->route('system.maintenance');
    }
}