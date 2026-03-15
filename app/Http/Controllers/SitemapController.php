<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Major;
use App\Models\Plan;
use App\Models\University;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Spatie\Sitemap\Sitemap;
use Spatie\Sitemap\Tags\Url;

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

        // Create the sitemap instance that will hold all static and dynamic URLs.
        $sitemap = Sitemap::create();

        // Add public static pages that should always appear in the sitemap.
        $this->addStaticPages($sitemap, $baseUrl, $now);

        // Add database-driven resources only when their tables exist in production.
        $this->addDynamicModelPages($sitemap, University::class, 'universities', '/universities', 0.8, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);
        $this->addDynamicModelPages($sitemap, Major::class, 'majors', '/majors', 0.8, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);
        $this->addDynamicModelPages($sitemap, Course::class, 'courses', '/courses', 0.8, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);
        $this->addDynamicModelPages($sitemap, Plan::class, 'plans', '/plans', 0.75, Url::CHANGE_FREQUENCY_WEEKLY, $baseUrl, $now);

        // Return a cached-friendly XML response for crawlers and search engines.
        return response($sitemap->render(), 200, [
            'Content-Type' => 'application/xml',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * Add the required public static pages to the sitemap.
     */
    private function addStaticPages(Sitemap $sitemap, string $baseUrl, $now): void
    {
        $staticPages = [
            ['path' => '/', 'priority' => 1.0, 'change' => Url::CHANGE_FREQUENCY_DAILY],
            ['path' => '/login', 'priority' => 0.6, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/register', 'priority' => 0.6, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/about', 'priority' => 0.7, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/contact', 'priority' => 0.7, 'change' => Url::CHANGE_FREQUENCY_MONTHLY],
            ['path' => '/features', 'priority' => 0.8, 'change' => Url::CHANGE_FREQUENCY_WEEKLY],
        ];

        foreach ($staticPages as $page) {
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
        if (!Schema::hasTable($tableName)) {
            return;
        }

        // Read records in chunks so large datasets do not exhaust server memory.
        $modelClass::query()
            ->select(['id', 'updated_at'])
            ->orderBy('id')
            ->chunkById(500, function ($rows) use ($sitemap, $pathPrefix, $priority, $changeFrequency, $baseUrl, $fallbackDate) {
                foreach ($rows as $row) {
                    $sitemap->add(
                        Url::create($baseUrl . $pathPrefix . '/' . $row->id)
                            ->setPriority($priority)
                            ->setChangeFrequency($changeFrequency)
                            ->setLastModificationDate($row->updated_at ?? $fallbackDate)
                    );
                }
            });
    }
}
