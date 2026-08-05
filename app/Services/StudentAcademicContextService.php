<?php

namespace App\Services;

use App\Engines\AcademicRulesEngine;
use App\Engines\StructuredRagEngine;
use App\Models\AcademicPeriod;
use App\Models\User;
use App\Support\AcademicCache;
use Illuminate\Support\Facades\Cache;

/**
 * One place to ask "what is this student's academic situation right now?".
 *
 * A thin facade, not a new implementation: the numbers still come from
 * StructuredRagEngine, AcademicRulesEngine and User::calculateGPA(). It exists
 * because the same picture is currently assembled twice per request — once by
 * AiAdvisorController and once by StructuredRagEngine — in two different shapes,
 * which is how CourseRankingEngine ended up reading course keys that the shape
 * it receives does not have.
 *
 * Deliberately used by NEW code paths only for now. The legacy fetching in
 * AiAdvisorController stays exactly as it is until this is proven in production.
 */
class StudentAcademicContextService
{
    private const CACHE_TTL = 300;

    public function __construct(
        private StructuredRagEngine $rag,
        private AcademicRulesEngine $rules,
    ) {}

    /**
     * The student's full context: profile, cart, rules and course pools.
     *
     * @return array{
     *     profile: array, cart: array, rules: array, period: array,
     *     available_courses: array, locked_courses: array, course_names: array<int, string>,
     *     completeness: array
     * }
     */
    public function for(User $user, bool $fresh = false): array
    {
        $key = $this->cacheKey($user);

        if ($fresh) {
            Cache::forget($key);
        }

        return Cache::remember($key, self::CACHE_TTL, function () use ($user) {
            $rag = $this->rag->gather($user);

            $rules = $this->rules->evaluate(
                $user,
                ['total_passed_hours' => $rag['profile']['total_passed_hours'] ?? 0],
                (int) ($rag['cart']['hours'] ?? 0)
            );

            $period = AcademicPeriod::current();

            $available = $this->normaliseCourses($rag['available_courses'] ?? []);
            $locked = $this->normaliseCourses($rag['locked_courses'] ?? []);

            $names = [];
            foreach ($available as $course) {
                $names[(int) $course['id']] = (string) $course['name'];
            }
            foreach ($locked as $course) {
                $names[(int) $course['id']] = (string) $course['name'];
            }
            foreach (($rag['cart']['map'] ?? []) as $id => $name) {
                $names[(int) $id] = (string) $name;
            }

            return [
                'profile' => $rag['profile'],
                'cart' => $rag['cart'],
                'rules' => $rules,
                'period' => [
                    'label' => $period?->displayLabel() ?? 'الفصل الحالي غير محدد',
                    'academic_year' => $period?->academic_year,
                    'academic_term' => $period?->academic_term,
                    'is_summer' => (bool) ($rules['is_summer'] ?? false),
                    'is_defined' => $period !== null,
                ],
                'available_courses' => $available,
                'locked_courses' => $locked,
                'course_names' => $names,
                'completeness' => $this->completeness($rag, $period),
            ];
        });
    }

    /**
     * Drop the cached context for a student.
     *
     * Also clears the two legacy keys the controller writes, so a cart change
     * cannot leave the old and new paths disagreeing about the same student.
     */
    public function invalidate(User|int $user): void
    {
        $id = $user instanceof User ? $user->id : $user;

        Cache::forget(AcademicCache::key("ai_student_context_{$id}"));
        Cache::forget(AcademicCache::key("student_academic_data_{$id}"));
        Cache::forget(AcademicCache::key("student_cart_data_{$id}"));
    }

    /**
     * Give every course entry BOTH spellings of the derived keys.
     *
     * StructuredRagEngine emits `unlocks_count`; CourseRankingEngine and the
     * controller's own pool read `unlocks`. Rather than rename a key that other
     * callers depend on, the shape here is a superset, so whichever name a
     * consumer reads it gets the same number.
     */
    public function normaliseCourses(array $courses): array
    {
        $normalised = [];

        foreach ($courses as $id => $course) {
            if (!is_array($course)) {
                continue;
            }

            $course['id'] = (int) ($course['id'] ?? $id);
            $unlocks = (int) ($course['unlocks'] ?? $course['unlocks_count'] ?? 0);
            $course['unlocks'] = $unlocks;
            $course['unlocks_count'] = $unlocks;
            $course['prereq_count'] = (int) ($course['prereq_count'] ?? 0);
            $course['credit_hours'] = (int) ($course['credit_hours'] ?? 0);
            $course['difficulty_level'] = max(1, min(5, (int) ($course['difficulty_level'] ?? 3)));
            $course['sections'] = (array) ($course['sections'] ?? []);
            $course['schedule_info'] = (string) ($course['schedule_info'] ?? '');

            $normalised[] = $course;
        }

        return $normalised;
    }

    /**
     * How much of the picture is actually known.
     *
     * Used by the confidence score and by the answer itself: a student with no
     * recorded grades cannot be given a GPA projection, and this deployment has
     * no calendar or directory tables to ground those questions in.
     */
    private function completeness(array $rag, ?AcademicPeriod $period): array
    {
        return [
            'has_academic_records' => (bool) ($rag['profile']['has_academic_records'] ?? false),
            'has_major' => ($rag['profile']['college_id'] ?? null) !== null,
            'has_period' => $period !== null,
            'has_cart' => !empty($rag['cart']['ids'] ?? []),
            'available_course_count' => count($rag['available_courses'] ?? []),
            'has_calendar_data' => false,
            'has_section_data' => true,
            'has_directory_data' => false,
        ];
    }

    /**
     * Keyed to the academic generation: switching the current term retires every
     * cached snapshot at once, so the new hour limit applies immediately instead of
     * after this TTL expires.
     */
    private function cacheKey(User $user): string
    {
        return AcademicCache::key("ai_student_context_{$user->id}");
    }
}
