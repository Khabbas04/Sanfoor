<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Major;
use App\Models\Plan;
use App\Models\University;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route as RouteFacade;
use Illuminate\Support\Facades\Schema;
use Spatie\Sitemap\Sitemap;
use Spatie\Sitemap\Tags\Url;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
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
            $xml = Cache::remember('seo:sitemap:xml:v1', now()->addHour(), function () use ($baseUrl, $now) {
                return $this->buildSitemapXml($baseUrl, $now);
            });
        } catch (Throwable $exception) {
            // Never fail crawlers with 500 because of cache backend issues.
            try {
                $xml = $this->buildSitemapXml($baseUrl, $now);
            } catch (Throwable $nestedException) {
                // Last-resort fallback: return a minimal valid sitemap.
                $xml = $this->buildMinimalSitemapXml($baseUrl, $now);
            }
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
        // Create the sitemap instance that will hold all static and dynamic URLs.
        $sitemap = Sitemap::create();

        // Add public static pages that should always appear in the sitemap.
        $this->addStaticPages($sitemap, $baseUrl, $now);

        // Add database-driven resources only when their listing routes are public.
        $this->addDynamicModelPagesSafely($sitemap, University::class, 'universities', '/universities', 0.8, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);
        $this->addDynamicModelPagesSafely($sitemap, Major::class, 'majors', '/majors', 0.8, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);
        $this->addDynamicModelPagesSafely($sitemap, Course::class, 'courses', '/courses', 0.8, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);
        $this->addDynamicModelPagesSafely($sitemap, Plan::class, 'plans', '/plans', 0.75, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);

        return $sitemap->render();
    }

    /**
     * Build minimal XML when normal generation cannot complete.
     */
    private function buildMinimalSitemapXml(string $baseUrl, $now): string
    {
        $escapedLoc = htmlspecialchars($baseUrl . '/', ENT_XML1);
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
     * Protect dynamic additions so one failing source does not break the endpoint.
     */
    private function addDynamicModelPagesSafely(
        Sitemap $sitemap,
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
                $sitemap,
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
     * Add the required public static pages to the sitemap.
     */
    private function addStaticPages(Sitemap $sitemap, string $baseUrl, $now): void
    {
        $staticPages = [
            ['path' => '/', 'priority' => 1.0, 'change' => Url::CHANGE_FREQUENCY_DAILY],
            ['path' => '/terms-of-use', 'priority' => 0.5, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/privacy-policy', 'priority' => 0.5, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/login', 'priority' => 0.4, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/register', 'priority' => 0.4, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/about', 'priority' => 0.7, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/contact', 'priority' => 0.7, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/features', 'priority' => 0.8, 'change' => Url::CHANGE_FREQUENCY_WEEKLY],
        ];

        foreach ($staticPages as $page) {
            if (!$this->isPublicGetPath($page['path'])) {
                continue;
            }

            $sitemap->add(
                Url::create($baseUrl . $page['path'])
                    ->setPriority($page['priority'])
                    ->setChangeFrequency($page['change'])
                    ->setLastModificationDate($now)
            );
        }
    }

    /**
     * Add database-backed resource URLs in chunks to avoid memory issues.
     *
     * @param class-string<Model> $modelClass
     */
    private function addDynamicModelPages(
        Sitemap $sitemap,
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

        // Skip resources whose listing pages are not publicly accessible.
        if (!$this->isPublicGetPath($pathPrefix)) {
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
                ->chunkById(500, function ($rows) use ($sitemap, $pathPrefix, $priority, $changeFrequency, $baseUrl, $fallbackDate) {
                    foreach ($rows as $row) {
                        $lastModified = $fallbackDate;

                        if (isset($row->updated_at) && $row->updated_at) {
                            $lastModified = $row->updated_at;
                        }

                        $sitemap->add(
                            Url::create($baseUrl . $pathPrefix . '/' . $row->id)
                                ->setPriority($priority)
                                ->setChangeFrequency($changeFrequency)
                                ->setLastModificationDate($lastModified)
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

        $middleware = $route->gatherMiddleware();

        foreach ($middleware as $item) {
            if (
                str_starts_with($item, 'auth')
                || str_starts_with($item, 'verified')
                || str_starts_with($item, 'admin')
                || str_starts_with($item, 'owner')
            ) {
                return false;
            }
        }

        return true;
    }
}
