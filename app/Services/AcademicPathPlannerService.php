<?php

namespace App\Services;

use App\Engines\AcademicRulesEngine;
use App\Engines\ValidationEngine;
use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\User;
use App\Support\CourseAdvantages;
use App\Support\CourseEligibility;
use App\Support\CourseLoad;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AcademicPathPlannerService
{
    /** Real per-course failure statistics, fetched once per request. */
    private ?array $loadStatistics = null;

    public function __construct(
        private readonly AcademicRulesEngine $rulesEngine,
        private readonly ValidationEngine $validationEngine,
        private readonly AcademicPathAiAnalysisService $aiAnalysis
    ) {
    }

    public function generate(User $user, string $goal, bool $fresh = false, ?int $requestedHours = null): array
    {
        $goalConfig = config("academic_path_planner.goals.{$goal}");
        if (!$goalConfig) {
            throw new \InvalidArgumentException('Unsupported academic path goal.');
        }

        $key = $this->cacheKey($user, $goal, $requestedHours);
        if ($fresh) {
            Cache::forget($key);
        }

        return Cache::remember(
            $key,
            now()->addMinutes((int) config('academic_path_planner.cache_ttl_minutes', 10)),
            fn () => $this->build($user, $goal, $goalConfig, $requestedHours)
        );
    }

    private function build(User $user, string $goal, array $goalConfig, ?int $requestedHours): array
    {
        $user->loadMissing('major');
        $passedRows = DB::table('course_user')
            ->join('courses', 'courses.id', '=', 'course_user.course_id')
            ->where('course_user.user_id', $user->id)
            ->where(function ($query) {
                $query->whereNull('course_user.grade')->orWhere('course_user.grade', '>=', 50);
            })
            ->select('courses.id', 'courses.credit_hours')
            ->get()
            ->unique('id');
        $initialPassedIds = $passedRows->pluck('id')->map('intval')->all();
        $initialPassedHours = (int) $passedRows->sum('credit_hours');

        $courses = $this->loadPlanCourses($user);
        $courseMap = $courses->keyBy('id');
        $remaining = $courses->reject(fn (Course $course) => in_array($course->id, $initialPassedIds, true))->keyBy('id');

        if ($remaining->isEmpty()) {
            return $this->completedResponse($goal, $goalConfig);
        }

        $currentPeriod = AcademicPeriod::current();
        $currentTerm = (int) ($currentPeriod?->academic_term ?: 1);
        // The real sequence of terms ahead (1 → 2 → summer → next year), so a
        // predicted semester can be named instead of only being "the one after".
        $upcomingTerms = $currentPeriod?->upcomingTerms(max(0, (int) config('academic_path_planner.roadmap_semesters', 3))) ?? [];
        $rules = $this->rulesEngine->evaluate(
            $user,
            ['total_passed_hours' => $initialPassedHours],
            0
        );

        $simulatedPassed = array_fill_keys($initialPassedIds, true);
        $simulatedPassedHours = $initialPassedHours;
        $semesters = [];
        $blocked = false;
        $semesterCount = (int) config('academic_path_planner.roadmap_semesters', 3);

        for ($sequence = 1; $sequence <= $semesterCount && $remaining->isNotEmpty(); $sequence++) {
            // Sequence 1 is the current term; the rest follow the configured order.
            $upcoming = $sequence === 1 ? null : ($upcomingTerms[$sequence - 2] ?? null);
            $term = $sequence === 1
                ? $currentTerm
                : (int) ($upcoming['academic_term'] ?? ((($currentTerm - 1 + ($sequence - 1)) % 3) + 1));
            $isSummer = AcademicPeriod::termType($term) === 'summer';
            $hourLimit = $sequence === 1
                ? (int) $rules['effective_limit']
                : $this->futureHourLimit($goalConfig, $isSummer, (bool) ($rules['is_probation'] ?? false));
            $targetHours = $sequence === 1 && $requestedHours !== null
                ? min($hourLimit, max(3, $requestedHours))
                : $this->targetHours($goalConfig, $hourLimit, $isSummer);
            $available = $remaining->filter(
                fn (Course $course) => $this->isAvailable($course, $simulatedPassed, $simulatedPassedHours)
            );

            if ($available->isEmpty()) {
                $blocked = true;
                break;
            }

            $ranked = $available
                ->map(fn (Course $course) => $this->rankCourse($course, $remaining, $goalConfig))
                ->sortByDesc('score')
                ->values();
            $selected = $this->selectSemester($ranked, $targetHours, (int) $goalConfig['max_hard_courses'], $goalConfig);

            if ($selected->isEmpty()) {
                $blocked = true;
                break;
            }

            // The student's own position in the plan, so a course can be described
            // as late relative to where they actually are.
            $studentSemester = (int) ($rules['student_semester'] ?? 0);
            $semesterCourses = $selected
                ->map(fn (array $item) => $this->courseResult($item + ['student_semester' => $studentSemester]))
                ->values()
                ->all();
            $semesterHours = (int) $selected->sum(fn (array $item) => $item['course']->credit_hours);
            $hardCount = $selected->filter(fn (array $item) => $this->isHard($item['course']))->count();
            $semesterLoad = round((float) $selected->sum(fn (array $item) => $this->courseLoad($item['course'])), 2);

            $semesters[] = [
                'sequence' => $sequence,
                // Named, not positional: "الفصل الصيفي 2026/2027" tells the student
                // that the 10-hour cap applies there; "الفصل الذي يليه" does not.
                'label' => $sequence === 1
                    ? 'أفضل مواد لهذا الفصل'
                    : trim(AcademicPeriod::termLabel($term) . ' ' . (string) ($upcoming['academic_year'] ?? '')),
                'academic_term' => $term,
                'academic_year' => $sequence === 1
                    ? (string) ($currentPeriod?->academic_year ?? '')
                    : (string) ($upcoming['academic_year'] ?? ''),
                'is_summer' => $isSummer,
                'is_prediction' => $sequence > 1,
                'total_hours' => $semesterHours,
                'hour_limit' => $hourLimit,
                'workload_level' => CourseLoad::label($semesterLoad, (float) ($goalConfig['max_load'] ?? 0))
                    ?: $this->workloadLabel($semesterHours, $hardCount, $isSummer),
                // The load is reported, not just used: when the budget had to be
                // relaxed for a student whose plan is all heavy, they should see that
                // the term is intense rather than discover it in week three.
                'load' => [
                    'score' => $semesterLoad,
                    'budget' => (float) ($goalConfig['max_load'] ?? 0),
                    'demanding_courses' => $hardCount,
                    'is_over_budget' => ($goalConfig['max_load'] ?? 0) > 0 && $semesterLoad > (float) $goalConfig['max_load'],
                    // A term that stops well short of the hour limit looks like a bug
                    // unless the reason is stated. It is a decision, so it is said out
                    // loud — together with the goal that would change it.
                    'note' => $this->loadNote($semesterHours, $hourLimit, $hardCount, (int) $goalConfig['max_hard_courses'], $goal),
                ],
                'courses' => $semesterCourses,
            ];

            foreach ($selected as $item) {
                $course = $item['course'];
                $simulatedPassed[$course->id] = true;
                $simulatedPassedHours += (int) $course->credit_hours;
                $remaining->forget($course->id);
            }
        }

        if ($semesters === []) {
            return $this->blockedResponse($goal, $goalConfig);
        }

        $validation = $this->validationEngine->validateAcademicPath(
            $user,
            $semesters,
            $initialPassedIds,
            $initialPassedHours
        );
        if (!$validation['valid']) {
            throw new \RuntimeException('Generated academic path did not pass validation.');
        }

        $firstSemester = $semesters[0] ?? null;
        $directUnlocks = collect($firstSemester['courses'] ?? [])->sum(fn (array $course) => $course['unlocks']['direct_count']);
        $totalUnlocks = collect($firstSemester['courses'] ?? [])->sum(fn (array $course) => $course['unlocks']['total_path_count']);
        $avoidsBottleneck = collect($firstSemester['courses'] ?? [])->contains(
            fn (array $course) => in_array($course['priority'], ['critical', 'high'], true)
                && $course['unlocks']['direct_count'] >= 2
        );

        $path = [
            'planner_version' => (string) config('academic_path_planner.version'),
            'goal' => ['id' => $goal, 'label' => $goalConfig['label']],
            'requested_hours' => $requestedHours,
            'status' => 'ready',
            'current_semester' => $firstSemester,
            'summary' => [
                'unlocks_count' => $directUnlocks,
                'path_unlocks_count' => $totalUnlocks,
                'avoids_next_semester_bottleneck' => $avoidsBottleneck,
                'workload_level' => $firstSemester['workload_level'] ?? 'متوازن',
                'goal_fit' => 'high',
                'message' => $this->summaryMessage($goal, $blocked),
            ],
            'roadmap' => array_slice($semesters, 1),
            'validation' => $validation,
            'confidence' => [
                'value' => $blocked ? 0.72 : 0.9,
                'label' => $blocked ? 'متوسطة' : 'مرتفعة',
                'based_on' => ['الخطة الأكاديمية', 'السجل الأكاديمي', 'المتطلبات السابقة', 'حدود الساعات'],
            ],
            'limitations' => $blocked
                ? ['بعض المواد المتبقية تحتاج متطلبات لا يمكن فتحها ضمن نطاق الفصول المعروض.']
                : ['الفصول المستقبلية تقديرية وتتغير عند تحديث السجل أو طرح المواد.'],
            'generated_at' => now()->toISOString(),
            'expires_at' => now()->addMinutes((int) config('academic_path_planner.cache_ttl_minutes', 10))->toISOString(),
        ];

        return $this->aiAnalysis->analyze($user, $path);
    }

    private function loadPlanCourses(User $user): Collection
    {
        $stats = DB::table('course_user')
            ->selectRaw('course_id, AVG(grade) as avg_grade, COUNT(grade) as graded_attempts')
            ->selectRaw('SUM(CASE WHEN grade < 60 THEN 1 ELSE 0 END) as failed_attempts')
            ->whereNotNull('grade')
            ->groupBy('course_id');

        return Course::query()
            ->withoutGlobalScopes()
            ->leftJoinSub($stats, 'course_stats', fn ($join) => $join->on('courses.id', '=', 'course_stats.course_id'))
            ->select('courses.*')
            ->selectRaw('COALESCE(course_stats.avg_grade, 72) as avg_grade')
            ->selectRaw('COALESCE(course_stats.graded_attempts, 0) as graded_attempts')
            ->selectRaw('CASE WHEN COALESCE(course_stats.graded_attempts, 0) > 0 THEN (course_stats.failed_attempts * 100.0 / course_stats.graded_attempts) ELSE 18 END as fail_rate')
            ->with(['prerequisites:id,name', 'children:id,name'])
            ->where('is_quiz_only', false)
            ->where('study_plan_version', (int) $user->study_plan_version)
            ->where(function ($query) use ($user) {
                $query->where('major_id', $user->major_id)->orWhereNull('major_id');
            })
            ->orderBy('semester')
            ->get();
    }

    private function isAvailable(Course $course, array $passed, int $passedHours): bool
    {
        return $course->prerequisites->every(fn (Course $prerequisite) => isset($passed[$prerequisite->id]))
            && !CourseEligibility::isLockedByPassedHours($course, $passedHours);
    }

    private function rankCourse(Course $course, Collection $remaining, array $goalConfig): array
    {
        $directUnlocks = $course->children->whereIn('id', $remaining->keys())->count();
        $pathUnlocks = $this->descendantCount($course->id, $remaining);
        $difficulty = max(1, min(5, (int) ($course->difficulty_level ?: 3)));
        $failRate = max(0, min(100, (float) ($course->fail_rate ?? 18)));
        $weights = $goalConfig['weights'];

        $components = [
            'direct_unlocks' => $directUnlocks * $weights['direct_unlocks'],
            'path_unlocks' => $pathUnlocks * $weights['path_unlocks'],
            'compulsory' => in_array($course->type, ['compulsory', 'supporting'], true) ? $weights['compulsory'] : 0,
            'semester_urgency' => max(0, 10 - max(0, (int) $course->semester - 1)) * ($weights['semester_urgency'] / 10),
            'difficulty_safety' => (6 - $difficulty) * $weights['difficulty_safety'],
            'grade_safety' => max(0, (100 - $failRate) / 20) * $weights['grade_safety'],
        ];

        return [
            'course' => $course,
            'score' => round(array_sum($components), 2),
            'score_components' => $components,
            'direct_unlocks' => $directUnlocks,
            'path_unlocks' => $pathUnlocks,
        ];
    }

    private function descendantCount(int $courseId, Collection $remaining, array $visited = []): int
    {
        return count($this->descendantIds($courseId, $remaining, $visited));
    }

    private function descendantIds(int $courseId, Collection $remaining, array $visited = []): array
    {
        if (isset($visited[$courseId])) {
            return [];
        }
        $visited[$courseId] = true;
        $course = $remaining->get($courseId);
        if (!$course) {
            return [];
        }

        $ids = [];
        foreach ($course->children->whereIn('id', $remaining->keys()) as $child) {
            if (isset($visited[$child->id])) {
                continue;
            }
            $ids[$child->id] = true;
            foreach ($this->descendantIds($child->id, $remaining, $visited) as $descendantId) {
                $ids[$descendantId] = true;
            }
        }

        return array_map('intval', array_keys($ids));
    }

    private function selectSemester(Collection $ranked, int $targetHours, int $maxHardCourses, array $goalConfig = []): Collection
    {
        $selected = collect();
        $hours = 0;
        $hardCount = 0;

        // The real ceiling on how demanding a term may be. Counting "hard courses"
        // never worked here because difficulty_level is the default 3 almost
        // everywhere; this budget is measured from signals that exist.
        $loadBudget = (float) ($goalConfig['max_load'] ?? 0);
        $load = 0.0;

        // Reserve the university requirements FIRST.
        //
        // Taking purely by score fills the term with specialisation courses, since
        // those unlock the most and therefore rank highest — and a semester of five
        // major courses is the schedule that breaks a student. University
        // requirements here are online and lighter, so they go in before the greedy
        // pass rather than competing with courses that will always outscore them.
        foreach ($this->reserveUniversityCourses($ranked, $targetHours) as $item) {
            $selected->push($item);
            $hours += (int) $item['course']->credit_hours;
            $hardCount += $this->isHard($item['course']) ? 1 : 0;
            $load += $this->courseLoad($item['course']);
        }

        $reservedIds = $selected->map(fn (array $item) => (int) $item['course']->id)->all();
        $universityCount = count($reservedIds);
        // The rule cuts both ways: a term of five online requirements is no more a
        // plan than a term of five specialisation courses.
        $maxUniversity = max(1, (int) config('academic_path_planner.balance.max_university_courses', 2));

        // Courses held back because the term is already demanding enough. They are
        // remembered, not discarded: the two caps below are preferences, and a
        // student whose remaining plan is all heavy still has to register a real
        // term rather than be sent away with six hours.
        $deferred = [];

        foreach ($ranked as $item) {
            $course = $item['course'];
            if (in_array((int) $course->id, $reservedIds, true)) {
                continue;
            }

            $courseHours = (int) $course->credit_hours;
            $hard = $this->isHard($course);
            $isUniversity = $this->isUniversityCourse($course);
            $courseLoad = $this->courseLoad($course);

            // Hours and the university cap are hard limits: the first is a
            // regulation, the second would otherwise turn the term into filler.
            if ($hours + $courseHours > $targetHours
                || ($isUniversity && $universityCount >= $maxUniversity)) {
                continue;
            }

            $tooManyDemanding = $hard && $hardCount >= $maxHardCourses;
            $overBudget = $loadBudget > 0 && $selected->isNotEmpty() && $load + $courseLoad > $loadBudget;

            if ($tooManyDemanding || $overBudget) {
                $deferred[] = $item;
                continue;
            }

            $selected->push($item);
            $hours += $courseHours;
            $hardCount += $hard ? 1 : 0;
            $universityCount += $isUniversity ? 1 : 0;
            $load += $courseLoad;
        }

        // Only now, and only to reach a term worth registering.
        //
        // The load BUDGET may be exceeded here, but `max_hard_courses` may not: that
        // is the goal's actual promise. A student who chose "reduce pressure" asked
        // for a lighter term, so handing them a fourth demanding course to fill hours
        // would be ignoring the only instruction they gave.
        $minimumHours = min($targetHours, (int) config('academic_path_planner.load.min_hours_before_relaxing', 9));
        foreach ($deferred as $item) {
            if ($hours >= $minimumHours) {
                break;
            }

            $course = $item['course'];
            $courseHours = (int) $course->credit_hours;
            $hard = $this->isHard($course);

            if ($hours + $courseHours > $targetHours || ($hard && $hardCount >= $maxHardCourses)) {
                continue;
            }

            $selected->push($item);
            $hours += $courseHours;
            $hardCount += $hard ? 1 : 0;
            $load += $this->courseLoad($course);
        }

        if ($selected->isEmpty() && $ranked->isNotEmpty()) {
            $first = $ranked->first();
            if ((int) $first['course']->credit_hours <= $targetHours) {
                $selected->push($first);
            }
        }

        return $selected;
    }

    /**
     * The best-scoring university requirements that fit inside the term.
     *
     * Only what actually exists is reserved: a student with none left in their plan
     * gets an unchanged, purely score-ranked semester rather than an empty slot.
     *
     * @return list<array>
     */
    private function reserveUniversityCourses(Collection $ranked, int $targetHours): array
    {
        $balance = (array) config('academic_path_planner.balance', []);
        $minimum = (int) ($balance['min_university_courses'] ?? 0);

        if ($minimum < 1) {
            return [];
        }

        $types = (array) ($balance['university_types'] ?? []);
        $maximum = max($minimum, (int) ($balance['max_university_courses'] ?? $minimum));

        $reserved = [];
        $hours = 0;

        foreach ($ranked as $item) {
            if (count($reserved) >= min($minimum, $maximum)) {
                break;
            }
            if (!in_array((string) $item['course']->type, $types, true)) {
                continue;
            }

            $courseHours = (int) $item['course']->credit_hours;
            // A single requirement must never consume the whole term on its own.
            if ($courseHours < 1 || $hours + $courseHours > $targetHours) {
                continue;
            }

            $reserved[] = $item;
            $hours += $courseHours;
        }

        return $reserved;
    }

    /**
     * How demanding this course is, using the real failure statistics.
     *
     * The statistics are fetched once per request by CourseLoad and cached, so this
     * stays cheap even though the roadmap calls it for every candidate in every
     * semester.
     */
    private function courseLoad(Course $course): float
    {
        $this->loadStatistics ??= CourseLoad::statistics();

        return CourseLoad::intensity([
            'type' => $course->type,
            'credit_hours' => (int) $course->credit_hours,
            'difficulty_level' => (int) ($course->difficulty_level ?: 3),
            'course_semester' => $course->semester,
            'code' => $course->code,
            'prereq_count' => $course->prerequisites->count(),
        ], $this->loadStatistics[$course->id] ?? []);
    }

    /**
     * Why the term is lighter than the hour limit, when it is.
     *
     * Silence here reads as a failure to fill the schedule. Naming the cause — and
     * the goal that would lift it — turns it back into advice.
     */
    private function loadNote(int $hours, int $hourLimit, int $hardCount, int $maxHardCourses, string $goal): ?string
    {
        // Two hours of slack is just how course sizes divide; not worth explaining.
        if ($hours >= $hourLimit - 2) {
            return null;
        }

        if ($hardCount < $maxHardCourses) {
            return null; // room was left by availability, not by a decision here
        }

        $note = "أبقيت الفصل على {$hours} ساعة من {$hourLimit}: ما تبقّى متاحاً لك مواد ثقيلة، وتحميلك أكثر من {$maxHardCourses} منها في فصل واحد يرفع خطر التعثّر.";

        return $goal === 'fastest_graduation'
            ? $note
            : $note . ' إن كنت مستعداً لضغط أعلى، جرّب هدف «التخرج بأسرع وقت».';
    }

    private function isUniversityCourse(Course $course): bool
    {
        return in_array(
            (string) $course->type,
            (array) config('academic_path_planner.balance.university_types', []),
            true
        );
    }

    private function courseResult(array $item): array
    {
        /** @var Course $course */
        $course = $item['course'];
        $direct = $item['direct_unlocks'];
        $path = $item['path_unlocks'];
        $priority = $path >= 5 || $direct >= 4 ? 'critical' : ($path >= 3 || $direct >= 2 ? 'high' : 'normal');

        // What makes THIS course worth taking, in terms the student can compare.
        // The old list said "مادة أساسية ضمن الخطة" about half the plan, which is
        // true and useless — it cannot help anyone choose between two options.
        $this->loadStatistics ??= CourseLoad::statistics();
        $stats = $this->loadStatistics[$course->id] ?? [];

        $advantages = CourseAdvantages::for([
            'name' => $course->name,
            'type' => $course->type,
            'credit_hours' => (int) $course->credit_hours,
            'difficulty_level' => (int) ($course->difficulty_level ?: 3),
            'unlocks' => $direct,
            'path_unlocks' => $path,
            'unlocks_courses' => $course->children->take(3)->pluck('name')->all(),
            'course_semester' => $course->semester,
            // Real institutional history, so "heavy" is evidence rather than a guess.
            'fail_rate' => $stats['fail_rate'] ?? null,
            'fail_sample' => $stats['sample'] ?? 0,
        ], ['student_semester' => $item['student_semester'] ?? 0]);

        $reasons = array_map(fn (array $advantage) => $advantage['text'], $advantages);

        return [
            'id' => (int) $course->id,
            'code' => $course->code,
            'name' => $course->name,
            'credit_hours' => (int) $course->credit_hours,
            'difficulty_level' => (int) ($course->difficulty_level ?: 3),
            'priority' => $priority,
            'priority_score' => $item['score'],
            'load' => $this->courseLoad($course),
            'fail_rate' => ($stats['sample'] ?? 0) >= CourseLoad::MIN_SAMPLE ? $stats['fail_rate'] : null,
            'reason' => $reasons[0],
            'reasons' => array_slice($reasons, 0, 3),
            // Same facts with their icons, for a UI that shows them as chips rather
            // than hiding them behind an expander.
            'advantages' => $advantages,
            'unlocks' => [
                'direct_count' => $direct,
                'total_path_count' => $path,
                'courses' => $course->children->take(4)->map(fn (Course $child) => [
                    'id' => (int) $child->id,
                    'name' => $child->name,
                ])->values()->all(),
            ],
            'impact' => [
                'path' => $priority === 'critical' ? 'high' : ($priority === 'high' ? 'medium' : 'low'),
                'gpa' => (float) ($course->fail_rate ?? 18) >= 30 ? 'high' : 'medium',
                'workload' => $this->isHard($course) ? 'high' : 'balanced',
            ],
            'academic_indicators' => [
                'average_grade' => round((float) ($course->avg_grade ?? 72), 1),
                'failure_rate' => round((float) ($course->fail_rate ?? 18), 1),
                'graded_attempts' => (int) ($course->graded_attempts ?? 0),
                'sample_is_sufficient' => (int) ($course->graded_attempts ?? 0) >= 10,
            ],
        ];
    }

    private function targetHours(array $goalConfig, int $limit, bool $isSummer): int
    {
        // The aim, not the ceiling — from the same config the limits come from.
        $base = (int) config('academic_terms.target_hours.' . ($isSummer ? 'summer' : 'regular'), $isSummer ? 9 : 15);

        return match ($goalConfig['target_load']) {
            'maximum' => $limit,
            'light' => min($limit, $isSummer ? 6 : 12),
            'moderate' => min($limit, $isSummer ? 6 : 12),
            default => min($limit, $base),
        };
    }

    /**
     * The ceiling for a PREDICTED term, which may be a different kind of term than
     * the current one — the roadmap walks 1 → 2 → summer, and the summer cap is not
     * the regular cap. Read from config/academic_terms.php like everything else.
     */
    private function futureHourLimit(array $goalConfig, bool $isSummer, bool $isProbation): int
    {
        return AcademicPeriod::maxHoursFor($isSummer ? 3 : 1, $isProbation);
    }

    /**
     * A course heavy enough that two of them make a full term.
     *
     * `fail_rate` is read here for the tree page's query, which selects it as an
     * alias; on a plain model it is absent, which is why this used to be decided by
     * `difficulty_level` alone — and that is the default 3 nearly everywhere. The
     * derived load is the reliable signal, so it decides now.
     */
    private function isHard(Course $course): bool
    {
        return (int) ($course->difficulty_level ?: 3) >= 4
            || (float) ($course->fail_rate ?? 18) >= 30
            || $this->courseLoad($course) >= (float) config('academic_path_planner.load.demanding_threshold', 1.5);
    }

    private function workloadLabel(int $hours, int $hardCount, bool $isSummer): string
    {
        if ($hardCount >= 3 || (!$isSummer && $hours >= 18)) {
            return 'مرتفع';
        }
        if ($hours <= ($isSummer ? 6 : 12) && $hardCount <= 1) {
            return 'خفيف';
        }
        return 'متوازن';
    }

    private function summaryMessage(string $goal, bool $blocked): string
    {
        if ($blocked) {
            return 'هذه أفضل خطة ممكنة ضمن المواد التي يمكن فتحها من بياناتك الحالية.';
        }

        return match ($goal) {
            'fastest_graduation' => 'المسار يعطي الأولوية للمواد التي تفتح أكبر عدد من المواد اللاحقة.',
            'improve_gpa' => 'المسار يحمي المعدل من تكديس المواد مرتفعة الصعوبة والمخاطر.',
            'reduce_pressure' => 'المسار يخفف الحمل ويوزع المواد الصعبة على الفصول.',
            default => 'المسار يوازن بين فتح المواد وحماية معدلك من الحمل المرتفع.',
        };
    }

    private function completedResponse(string $goal, array $goalConfig): array
    {
        return [
            'planner_version' => (string) config('academic_path_planner.version'),
            'goal' => ['id' => $goal, 'label' => $goalConfig['label']],
            'status' => 'completed',
            'current_semester' => null,
            'summary' => [
                'unlocks_count' => 0,
                'path_unlocks_count' => 0,
                'avoids_next_semester_bottleneck' => false,
                'workload_level' => 'مكتمل',
                'goal_fit' => 'high',
                'message' => 'أنجزت مواد خطتك الأكاديمية المسجلة. راجع إجراءات التخرج النهائية مع الجامعة.',
            ],
            'roadmap' => [],
            'validation' => ['valid' => true, 'checked_rules' => [], 'errors' => [], 'warnings' => []],
            'confidence' => ['value' => 1, 'label' => 'مرتفعة', 'based_on' => ['السجل الأكاديمي', 'الخطة الأكاديمية']],
            'limitations' => [],
            'generated_at' => now()->toISOString(),
            'expires_at' => now()->addMinutes(10)->toISOString(),
        ];
    }

    private function blockedResponse(string $goal, array $goalConfig): array
    {
        return [
            'planner_version' => (string) config('academic_path_planner.version'),
            'goal' => ['id' => $goal, 'label' => $goalConfig['label']],
            'status' => 'blocked',
            'current_semester' => null,
            'summary' => [
                'unlocks_count' => 0,
                'path_unlocks_count' => 0,
                'avoids_next_semester_bottleneck' => false,
                'workload_level' => 'غير متاح',
                'goal_fit' => 'low',
                'message' => 'تعذر بناء مسار صالح من البيانات الحالية لأن المواد المتبقية لا يمكن فتحها بالمتطلبات المسجلة.',
            ],
            'roadmap' => [],
            'validation' => [
                'valid' => false,
                'checked_rules' => ['prerequisites', 'minimum_passed_hours', 'plan_membership'],
                'errors' => [['code' => 'no_available_starting_course']],
                'warnings' => [],
            ],
            'confidence' => ['value' => 0.4, 'label' => 'منخفضة', 'based_on' => ['المتطلبات السابقة']],
            'limitations' => ['راجع ترابط المتطلبات السابقة أو بيانات المواد المجتازة مع الإدارة.'],
            'generated_at' => now()->toISOString(),
            'expires_at' => now()->addMinutes(10)->toISOString(),
        ];
    }

    private function cacheKey(User $user, string $goal, ?int $requestedHours): string
    {
        $academicUpdated = DB::table('course_user')->where('user_id', $user->id)->max('updated_at') ?: 'none';
        $planUpdated = DB::table('graduation_plans')->where('user_id', $user->id)->max('updated_at') ?: 'none';
        $periodVersion = (int) Cache::get('academic_insights_version', 1);
        $courseVersion = (int) Cache::get('dashboard_courses_version', 1);
        $signature = hash('sha256', implode('|', [
            $user->updated_at,
            $academicUpdated,
            $planUpdated,
            $periodVersion,
            $courseVersion,
        ]));

        $hoursKey = $requestedHours === null ? 'auto' : $requestedHours;

        return "academic_path:user:{$user->id}:goal:{$goal}:hours:{$hoursKey}:{$signature}";
    }
}
