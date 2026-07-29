<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * How demanding a course actually is.
 *
 * The planner used to decide this from `difficulty_level` alone, and capped a term
 * at "two hard courses" where hard meant difficulty ≥ 4. In this database almost
 * every course carries the default value 3, so that cap never fired once and three
 * or four advanced specialisation courses could land in the same term. The
 * `grade_safety` ranking weight had the same problem: it read `$course->fail_rate`,
 * a column that does not exist, so it contributed the same constant to every course.
 *
 * So load is derived from signals that are really there:
 *   - the actual failure rate from `course_user`, when enough students have a grade
 *   - the course's level (its plan semester / the year digit in its code)
 *   - how many prerequisites stand behind it
 *   - credit hours, and whether it is an online university requirement
 *
 * The unit is "one ordinary 3-hour first-year course ≈ 1.0", so a term's total load
 * is directly comparable to a budget.
 */
class CourseLoad
{
    /** Below this many graded attempts a failure rate is noise, not a signal. */
    public const MIN_SAMPLE = 8;

    /** Used when nothing is known, matching the planner's historical assumption. */
    public const ASSUMED_FAIL_RATE = 18.0;

    /**
     * Real failure statistics per course id.
     *
     * One query for the whole plan rather than one per course, cached briefly: the
     * planner runs this for every semester of the roadmap.
     *
     * @return array<int, array{fail_rate: float, sample: int, avg_grade: ?float}>
     */
    public static function statistics(): array
    {
        return Cache::remember('course_load_statistics_v1', 600, function () {
            if (!Schema::hasTable('course_user')) {
                return [];
            }

            $rows = DB::table('course_user')
                ->selectRaw('course_id')
                ->selectRaw('COUNT(*) as graded_attempts')
                ->selectRaw('AVG(grade) as avg_grade')
                ->selectRaw('SUM(CASE WHEN grade < 60 THEN 1 ELSE 0 END) as failed_attempts')
                ->whereNotNull('grade')
                ->groupBy('course_id')
                ->get();

            $statistics = [];
            foreach ($rows as $row) {
                $sample = (int) $row->graded_attempts;
                $statistics[(int) $row->course_id] = [
                    'sample' => $sample,
                    'avg_grade' => $row->avg_grade === null ? null : round((float) $row->avg_grade, 1),
                    'fail_rate' => $sample > 0
                        ? round(((int) $row->failed_attempts / $sample) * 100, 1)
                        : self::ASSUMED_FAIL_RATE,
                ];
            }

            return $statistics;
        });
    }

    /**
     * The load of one course, in "ordinary 3-hour first-year course" units.
     *
     * @param array{
     *     type?: string, credit_hours?: int, difficulty_level?: int,
     *     course_semester?: ?int, semester?: ?int, code?: ?string, prereq_count?: int
     * } $course
     * @param array{fail_rate?: ?float, sample?: int} $stats
     */
    public static function intensity(array $course, array $stats = []): float
    {
        $hours = max(1, (int) ($course['credit_hours'] ?? 3));
        $difficulty = max(1, min(5, (int) ($course['difficulty_level'] ?? 3)));
        $prereqs = max(0, (int) ($course['prereq_count'] ?? 0));

        $load = 1.0;

        // Level: a fourth-year course is not a first-year course, whatever its
        // difficulty field happens to say.
        $load += match (self::level($course)) {
            1 => 0.0,
            2 => 0.3,
            3 => 0.6,
            default => 0.9,
        };

        // Difficulty still counts when it has actually been set away from the
        // default, it just no longer decides the answer on its own.
        $load += ($difficulty - 3) * 0.5;

        // Real failure data, when the sample is big enough to mean anything.
        $sample = (int) ($stats['sample'] ?? 0);
        $failRate = $stats['fail_rate'] ?? null;
        if ($failRate !== null && $sample >= self::MIN_SAMPLE) {
            $load += match (true) {
                $failRate >= 35 => 1.0,
                $failRate >= 25 => 0.6,
                $failRate >= 15 => 0.3,
                default => -0.2,   // a course students reliably pass is genuinely lighter
            };
        }

        // Standing behind several prerequisites means the material is cumulative.
        $load += min(0.6, $prereqs * 0.3);

        // Credit hours scale it: a one-hour lab is not a three-hour course.
        $load *= $hours / 3;

        // University requirements are delivered online here, which is materially
        // less work than an on-campus specialisation course.
        if (in_array((string) ($course['type'] ?? ''), (array) config('academic_path_planner.balance.university_types', []), true)) {
            $load *= 0.5;
        }

        return round(max(0.2, $load), 2);
    }

    /** Study year of the course: its plan semester, or the year digit in its code. */
    public static function level(array $course): int
    {
        $semester = $course['course_semester'] ?? $course['semester'] ?? null;
        if ($semester !== null && (int) $semester > 0) {
            return max(1, min(5, (int) ceil((int) $semester / 2)));
        }

        // Course codes end in <year><two-digit sequence>: 0306301 is a third-year
        // course, 0306101 a first-year one. The year digit is therefore the third
        // from the end, NOT the fourth from the start — reading position 3 lands on
        // the department prefix for the seven-digit codes this university uses.
        $digits = preg_replace('/\D/', '', (string) ($course['code'] ?? ''));
        if (strlen($digits) >= 3) {
            $digit = (int) substr($digits, -3, 1);
            if ($digit >= 1 && $digit <= 5) {
                return $digit;
            }
        }

        return 1;
    }

    /** Is this course demanding enough that two of them fill a term? */
    public static function isDemanding(array $course, array $stats = []): bool
    {
        return self::intensity($course, $stats) >= (float) config('academic_path_planner.load.demanding_threshold', 1.5);
    }

    /** A word for a term's total load, relative to the goal's budget. */
    public static function label(float $total, float $budget): string
    {
        if ($budget <= 0) {
            return 'متوازن';
        }

        $ratio = $total / $budget;

        return match (true) {
            $ratio <= 0.6 => 'خفيف',
            $ratio <= 0.9 => 'متوازن',
            $ratio <= 1.0 => 'مكثف',
            default => 'مرهق',
        };
    }
}
