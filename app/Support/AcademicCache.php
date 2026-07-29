<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * Cache generation for everything that depends on the current academic term.
 *
 * Changing the current term changes the hour limit, which changes the student's
 * academic snapshot, the available-course pool, the planner's roadmap and the
 * advisor's answers. Those are cached under per-student keys with hashes in them,
 * so they cannot be enumerated and deleted one by one — and an admin who switches
 * the term should not have to wait out a two-hour answer cache to see it apply.
 *
 * So every affected key carries a generation number. Bumping it retires the whole
 * generation at once: the next read misses, recomputes against the new term, and
 * the stale entries expire on their own. No cache flush, nothing unrelated lost.
 */
class AcademicCache
{
    private const VERSION_KEY = 'academic_context_version';

    /** Current generation. Never expires; it only moves when the term does. */
    public static function version(): int
    {
        $version = Cache::get(self::VERSION_KEY);

        if ($version === null) {
            $version = 1;
            Cache::forever(self::VERSION_KEY, $version);
        }

        return (int) $version;
    }

    /**
     * Retire the current generation.
     *
     * Called when the academic period changes. `increment` is not universally
     * available across cache stores for a missing key, so the value is seeded first.
     */
    public static function bump(): int
    {
        $next = self::version() + 1;
        Cache::forever(self::VERSION_KEY, $next);

        // These are global (not per-student) and cheap to drop outright.
        foreach (['academic_period_current', 'admin_ai_reports', 'course_load_statistics_v1', 'gemini_monitor_chat_count'] as $key) {
            Cache::forget($key);
        }

        return $next;
    }

    /** A cache key tied to the current academic generation. */
    public static function key(string $base): string
    {
        return $base . ':g' . self::version();
    }
}
