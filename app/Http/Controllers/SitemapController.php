<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route as RouteFacade;
use Throwable;

class SitemapController extends Controller
{
    /**
     * Generate the XML sitemap dynamically for production crawling.
     */
    public function __invoke()
    {
        // Always resolve the canonical base URL from the application config first.
        $baseUrl = rtrim(config('app.url', url('/')), '/');

        // Use a single timestamp fallback when a record has no updated_at value.
        $now = now();
        $cacheKey = (string) config('sitemap.cache_key', 'seo:sitemap:xml:v4');
        $cacheTtlMinutes = (int) config('sitemap.cache_ttl_minutes', 60);

        try {
            $xml = Cache::remember($cacheKey, now()->addMinutes($cacheTtlMinutes), function () use ($baseUrl, $now) {
                return $this->buildSitemapXml($baseUrl, $now);
            });
        } catch (Throwable $exception) {
            // Never fail crawlers with 500 because of cache backend issues.
            $xml = $this->buildSitemapXml($baseUrl, $now);
        }

        // Return a cached-friendly XML response for crawlers and search engines.
        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
            'X-Robots-Tag' => 'index, follow',
            'ETag' => '"' . md5($xml) . '"',
        ]);
    }

    /**
     * Build XML sitemap content.
     */
    private function buildSitemapXml(string $baseUrl, $now): string
    {
        try {
            $entries = [];
            $seen = [];

            $this->addRequestedImportantPages($entries, $seen, $baseUrl, $now);

            if ((bool) config('sitemap.include_auth_pages', false)) {
                $this->addOptionalAuthPages($entries, $seen, $baseUrl, $now);
            }

            if ((bool) config('sitemap.include_discoverable_public_routes', false)) {
                $this->addDiscoverablePublicRoutes($entries, $seen, $baseUrl, $now);
            }

            usort($entries, function (array $a, array $b): int {
                return strcmp($a['loc'], $b['loc']);
            });

            return $this->renderXml($entries);
        } catch (Throwable $exception) {
            return $this->buildMinimalSitemapXml($baseUrl, $now);
        }
    }

    /**
     * Build minimal XML when normal generation cannot complete.
     */
    private function buildMinimalSitemapXml(string $baseUrl, $now): string
    {
        $escapedLoc = htmlspecialchars($baseUrl . '/', ENT_XML1 | ENT_QUOTES, 'UTF-8');
        $lastMod = $now->toAtomString();

        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
            . "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n"
            . "  <url>\n"
            . "    <loc>{$escapedLoc}</loc>\n"
            . "    <lastmod>{$lastMod}</lastmod>\n"
            . "    <changefreq>daily</changefreq>\n"
            . "    <priority>1.0</priority>\n"
            . "  </url>\n"
            . "</urlset>\n";
    }

    /**
     * Render valid XML from normalized sitemap entry rows.
     *
     * @param array<int, array{loc:string,lastmod:string,changefreq:string,priority:string}> $entries
     */
    private function renderXml(array $entries): string
    {
        $xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
        $xml .= "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";

        foreach ($entries as $entry) {
            $xml .= "  <url>\n";
            $xml .= '    <loc>' . htmlspecialchars($entry['loc'], ENT_XML1 | ENT_QUOTES, 'UTF-8') . "</loc>\n";
            $xml .= '    <lastmod>' . $entry['lastmod'] . "</lastmod>\n";
            $xml .= '    <changefreq>' . $entry['changefreq'] . "</changefreq>\n";
            $xml .= '    <priority>' . $entry['priority'] . "</priority>\n";
            $xml .= "  </url>\n";
        }

        $xml .= "</urlset>\n";

        return $xml;
    }

    /**
     * Add only the explicitly requested important pages.
     */
    private function addRequestedImportantPages(array &$entries, array &$seen, string $baseUrl, $now): void
    {
        $pages = config('sitemap.pages', []);

        foreach ($pages as $page) {
            if (!is_array($page) || !isset($page['path'])) {
                continue;
            }

            $path = (string) $page['path'];
            $priority = (string) ($page['priority'] ?? '0.60');
            $change = (string) ($page['change'] ?? 'monthly');

            if (!$this->isGetPathAvailable($path)) {
                continue;
            }

            $this->addEntry(
                $entries,
                $seen,
                $baseUrl,
                $path,
                $now->toAtomString(),
                $change,
                $priority
            );
        }
    }

    /**
     * Add optional auth entry points if enabled in config.
     */
    private function addOptionalAuthPages(array &$entries, array &$seen, string $baseUrl, $now): void
    {
        $authPages = [
            ['path' => '/login', 'priority' => '0.50', 'change' => 'monthly'],
            ['path' => '/register', 'priority' => '0.50', 'change' => 'monthly'],
        ];

        foreach ($authPages as $page) {
            if (!$this->isGetPathAvailable($page['path'])) {
                continue;
            }

            $this->addEntry(
                $entries,
                $seen,
                $baseUrl,
                $page['path'],
                $now->toAtomString(),
                $page['change'],
                $page['priority']
            );
        }
    }

    /**
     * Include extra public GET routes that are safe for crawlers.
     */
    private function addDiscoverablePublicRoutes(array &$entries, array &$seen, string $baseUrl, $now): void
    {
        foreach (RouteFacade::getRoutes() as $route) {
            if (!in_array('GET', $route->methods(), true)) {
                continue;
            }

            $path = '/' . ltrim($route->uri(), '/');

            if ($path === '/sitemap.xml' || str_contains($path, '{')) {
                continue;
            }

            if ($this->hasProtectedMiddleware($route->gatherMiddleware())) {
                continue;
            }

            $changefreq = $path === '/' ? 'daily' : 'monthly';
            $priority = $path === '/' ? '1.00' : '0.60';

            $this->addEntry(
                $entries,
                $seen,
                $baseUrl,
                $path,
                $now->toAtomString(),
                $changefreq,
                $priority
            );
        }
    }

    /**
     * Exclude routes that require authentication or elevated privileges.
     *
     * @param array<int, string> $middleware
     */
    private function hasProtectedMiddleware(array $middleware): bool
    {
        foreach ($middleware as $name) {
            $value = strtolower((string) $name);

            if (
                str_contains($value, 'auth')
                || str_contains($value, 'verified')
                || str_contains($value, 'admin')
                || str_contains($value, 'owner')
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a GET path is registered in routes.
     */
    private function isGetPathAvailable(string $path): bool
    {
        try {
            RouteFacade::getRoutes()->match(Request::create($path, 'GET'));
            return true;
        } catch (Throwable $exception) {
            return false;
        }
    }

    /**
     * Append a deduplicated URL entry.
     */
    private function addEntry(
        array &$entries,
        array &$seen,
        string $baseUrl,
        string $path,
        string $lastMod,
        string $changefreq,
        string $priority
    ): void {
        $normalizedPath = '/' . ltrim($path, '/');
        $normalizedPath = $normalizedPath === '//' ? '/' : $normalizedPath;

        $loc = $baseUrl . ($normalizedPath === '/' ? '/' : $normalizedPath);

        if (isset($seen[$loc])) {
            return;
        }

        $seen[$loc] = true;
        $entries[] = [
            'loc' => $loc,
            'lastmod' => $lastMod,
            'changefreq' => $changefreq,
            'priority' => $priority,
        ];
    }

}
