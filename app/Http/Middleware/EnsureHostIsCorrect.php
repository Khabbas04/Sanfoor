<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureHostIsCorrect
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $allowedHosts = [
            'sanfoor.me', 
            'www.sanfoor.me', 
            'localhost', 
            '127.0.0.1'
        ];

        $host = $request->getHost();

        // If the host is not in our allowed list, we do a 301 Permanent Redirect to the official domain.
        // This is excellent for SEO because it steals the domain authority of the fake domain.
        if (!in_array($host, $allowedHosts)) {
            $officialUrl = 'https://sanfoor.me' . $request->getRequestUri();
            return redirect($officialUrl, 301);
        }

        return $next($request);
    }
}
