<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Major;
use App\Models\Plan;
use App\Models\University;
use Illuminate\Http\Request;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route as RouteFacade;
use Illuminate\Support\Facades\Schema;
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

        try {
            $xml = Cache::remember('seo:sitemap:xml:v2', now()->addHour(), function () use ($baseUrl, $now) {
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

            // Core pages are intentionally pinned with explicit priorities.
            $this->addCorePages($entries, $seen, $baseUrl, $now);

            // Add all remaining public GET routes discovered from the router.
            $this->addPublicRoutePages($entries, $seen, $baseUrl, $now);

            // Add database-driven details when matching public dynamic routes exist.
            $this->addDynamicModelPagesSafely($entries, $seen, University::class, 'universities', '/universities', 0.8, 'weekly', $baseUrl, $now);
            $this->addDynamicModelPagesSafely($entries, $seen, Major::class, 'majors', '/majors', 0.8, 'weekly', $baseUrl, $now);
            $this->addDynamicModelPagesSafely($entries, $seen, Course::class, 'courses', '/courses', 0.8, 'weekly', $baseUrl, $now);
            $this->addDynamicModelPagesSafely($entries, $seen, Plan::class, 'plans', '/plans', 0.75, 'weekly', $baseUrl, $now);

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
     * Protect dynamic additions so one failing source does not break the endpoint.
     */
    private function addDynamicModelPagesSafely(
        array &$entries,
        array &$seen,
        string $modelClass,
        string $tableName,
        string $pathPrefix,
        float $priority,
        string $changeFrequency,
        string $baseUrl,
        $fallbackDate,
    ): void {
        try {
            $this->addDynamicModelPages(
                $entries,
                $seen,
                $modelClass,
                $tableName,
                $pathPrefix,
                $priority,
                $changeFrequency,
                $baseUrl,
                $fallbackDate,
            );
        } catch (Throwable $exception) {
            // Keep sitemap generation alive even if one model source fails.
        }
    }

    /**
     * Add stable, high-value public pages.
     */
    private function addCorePages(array &$entries, array &$seen, string $baseUrl, $now): void
    {
        $staticPages = [
            ['path' => '/', 'priority' => '1.0', 'change' => 'daily'],
            ['path' => '/terms-of-use', 'priority' => '0.6', 'change' => 'monthly'],
            ['path' => '/privacy-policy', 'priority' => '0.6', 'change' => 'monthly'],
            ['path' => '/login', 'priority' => '0.4', 'change' => 'monthly'],
            ['path' => '/register', 'priority' => '0.4', 'change' => 'monthly'],
        ];

        foreach ($staticPages as $page) {
            if (!$this->isPublicGetPath($page['path'])) {
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
     * Auto-include public GET routes while skipping private or utility endpoints.
     */
    private function addPublicRoutePages(array &$entries, array &$seen, string $baseUrl, $now): void
    {
        $excluded = [
            '/sitemap.xml',
            '/up',
        ];

        foreach (RouteFacade::getRoutes() as $route) {
            if (!$route instanceof LaravelRoute) {
                continue;
            }

            if (!$this->isPublicGetRoute($route)) {
                continue;
            }

            $path = '/' . ltrim($route->uri(), '/');
            $path = $path === '//' ? '/' : $path;

            if (in_array($path, $excluded, true)) {
                continue;
            }

            // Skip dynamic placeholders in this static pass.
            if (str_contains($path, '{')) {
                continue;
            }

            if (str_starts_with($path, '/admin')) {
                continue;
            }

            [$changefreq, $priority] = $this->metadataForPath($path);

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
     * Return sitemap metadata defaults for known path categories.
     *
     * @return array{0:string,1:string}
     */
    private function metadataForPath(string $path): array
    {
        if ($path === '/') {
            return ['daily', '1.0'];
        }

        if ($path === '/login' || $path === '/register') {
            return ['monthly', '0.4'];
        }

        if (str_contains($path, 'privacy') || str_contains($path, 'terms')) {
            return ['monthly', '0.6'];
        }

        if (str_contains($path, 'forgot-password') || str_contains($path, 'reset-password')) {
            return ['yearly', '0.2'];
        }

        return ['monthly', '0.5'];
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

    /**
     * Add database-backed resource URLs in chunks to avoid memory issues.
     */
    private function addDynamicModelPages(
        array &$entries,
        array &$seen,
        string $modelClass,
        string $tableName,
        string $pathPrefix,
        float $priority,
        string $changeFrequency,
        string $baseUrl,
        $fallbackDate,
    ): void {
        // Skip this resource completely if the production table does not exist yet.
        try {
            if (!Schema::hasTable($tableName)) {
                return;
            }
        } catch (Throwable $exception) {
            return;
        }

        // Skip resources when no public listing or detail route is present.
        if (!$this->isPublicGetPath($pathPrefix) && !$this->hasPublicDynamicPrefix($pathPrefix)) {
            return;
        }

        // Read records in chunks so large datasets do not exhaust server memory.
        $selectColumns = ['id'];

        if (Schema::hasColumn($tableName, 'updated_at')) {
            $selectColumns[] = 'updated_at';
        }

        try {
            $modelClass::query()
                ->select($selectColumns)
                ->orderBy('id')
                ->chunkById(500, function ($rows) use (&$entries, &$seen, $pathPrefix, $priority, $changeFrequency, $baseUrl, $fallbackDate) {
                    foreach ($rows as $row) {
                        $lastModified = $fallbackDate;

                        if (isset($row->updated_at) && $row->updated_at) {
                            $lastModified = $row->updated_at;
                        }

                        $lastModifiedIso = method_exists($lastModified, 'toAtomString')
                            ? $lastModified->toAtomString()
                            : now()->toAtomString();

                        $this->addEntry(
                            $entries,
                            $seen,
                            $baseUrl,
                            $pathPrefix . '/' . $row->id,
                            $lastModifiedIso,
                            $changeFrequency,
                            number_format($priority, 2, '.', '')
                        );
                    }
                });
        } catch (Throwable $exception) {
            return;
        }
    }

    /**
     * Check if a GET path exists and does not require auth/admin middlewares.
     */
    private function isPublicGetPath(string $path): bool
    {
        try {
            $route = RouteFacade::getRoutes()->match(Request::create($path, 'GET'));
        } catch (Throwable $exception) {
            return false;
        }

        return $this->isPublicGetRoute($route);
    }

    /**
     * Check whether a given route is crawl-safe public GET endpoint.
     */
    private function isPublicGetRoute(LaravelRoute $route): bool
    {
        if (!in_array('GET', $route->methods(), true)) {
            return false;
        }

        $middleware = $route->gatherMiddleware();

        foreach ($middleware as $item) {
            if (
                str_starts_with($item, 'auth')
                || str_starts_with($item, 'verified')
                || str_starts_with($item, 'admin')
                || str_starts_with($item, 'owner')
                || str_starts_with($item, 'signed')
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if there is a public GET dynamic route like /resource/{id}.
     */
    private function hasPublicDynamicPrefix(string $pathPrefix): bool
    {
        $prefix = trim($pathPrefix, '/');

        foreach (RouteFacade::getRoutes() as $route) {
            if (!$route instanceof LaravelRoute) {
                continue;
            }

            if (!$this->isPublicGetRoute($route)) {
                continue;
            }

            $uri = trim($route->uri(), '/');

            if (preg_match('/^' . preg_quote($prefix, '/') . '\/\{[^\/]+\}$/', $uri) === 1) {
                return true;
            }
        }

        return false;
    }
}
