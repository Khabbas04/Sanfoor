<?php

namespace Tests\Feature\Ai;

use App\Engines\CourseRankingEngine;
use App\Models\Major;
use App\Services\AcademicPathPlannerService;

/**
 * Schedule balance.
 *
 * Ranking on its own always produced an all-specialisation term, because major
 * courses unlock the most and therefore score highest. That is the schedule a
 * human advisor would refuse: university requirements here are online and lighter,
 * and a term needs at least one of them to be survivable.
 */
class SemesterBalanceTest extends AdvisorTestCase
{
    /** A pool of heavy major courses plus the lighter online requirements. */
    private function pool(Major $major, int $majorCount = 6, int $universityCount = 3): void
    {
        $pivotal = null;

        foreach (range(1, $majorCount) as $index) {
            $course = $this->course($major, [
                'name' => "مادة تخصص {$index}",
                'type' => 'compulsory',
                'credit_hours' => 3,
                'difficulty_level' => 4,
            ]);

            // The first three are open now — a realistic term has several major
            // courses to choose from. The rest hang off the first one so it carries
            // real unlock value and outranks the lighter requirements, which is what
            // produced the all-specialisation term in the first place.
            $pivotal ??= $course;
            if ($index > 3) {
                $course->prerequisites()->attach($pivotal->id);
            }
        }

        // range(1, 0) counts DOWN in PHP and would create two courses.
        foreach ($universityCount > 0 ? range(1, $universityCount) : [] as $index) {
            $this->course($major, [
                'name' => "متطلب جامعة أونلاين {$index}",
                'type' => $index === 1 ? 'university_req' : 'university_elective',
                'credit_hours' => 3,
                'difficulty_level' => 1,
            ]);
        }
    }

    private function isUniversity(array $course): bool
    {
        return str_contains((string) ($course['name'] ?? ''), 'متطلب جامعة');
    }

    /* ── the planner ────────────────────────────────────────────────────── */

    public function test_the_planner_always_includes_a_university_requirement(): void
    {
        [$user, $major] = $this->student();
        $this->pool($major);
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);
        $courses = $path['current_semester']['courses'];

        $university = array_values(array_filter($courses, fn ($c) => $this->isUniversity($c)));

        $this->assertNotEmpty($university, 'A term of only specialisation courses is not a balanced term.');
        // Balance cuts both ways: at least one requirement, but never the whole term
        // — and the specialisation courses the student came for are still there.
        $this->assertLessThanOrEqual(2, count($university), 'A term of online requirements is not a plan either.');
        $this->assertNotEmpty(
            array_filter($courses, fn ($c) => !$this->isUniversity($c)),
            'A balanced term still has to move the student through their major.'
        );
        // And the requirement says why it is there, so it does not read as filler.
        $this->assertStringContainsString('يوازن حمل', $university[0]['reason']);
        $this->assertStringContainsString('أونلاين', $university[0]['reason']);

        // The hard-course cap of the `balanced` goal is what leaves room for the
        // lighter requirements in the first place, so it must still hold.
        $this->assertLessThanOrEqual(
            2,
            count(array_filter($courses, fn ($c) => $c['difficulty_level'] >= 4)),
            'The balanced goal allows at most two hard courses.'
        );
    }

    /** The balance rule must not blow the hour limit. */
    public function test_balancing_respects_the_hour_limit(): void
    {
        [$user, $major] = $this->student();
        $this->pool($major);
        $this->currentPeriod(3, '2026/2027'); // summer: 9 hours

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);
        $semester = $path['current_semester'];

        $this->assertLessThanOrEqual($semester['hour_limit'], $semester['total_hours']);
        $this->assertTrue($path['validation']['valid']);
    }

    /** A student with no requirements left gets an unchanged, ranked term. */
    public function test_a_student_without_university_requirements_is_unaffected(): void
    {
        [$user, $major] = $this->student();
        $this->pool($major, majorCount: 6, universityCount: 0);
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);
        $courses = $path['current_semester']['courses'];

        $this->assertNotEmpty($courses);
        $this->assertSame([], array_filter($courses, fn ($c) => $this->isUniversity($c)));
        $this->assertTrue($path['validation']['valid']);
    }

    /** Already-passed requirements are not proposed again to "balance" anything. */
    public function test_a_passed_requirement_is_not_reserved_again(): void
    {
        [$user, $major] = $this->student();
        $this->pool($major, majorCount: 4, universityCount: 1);
        $passedRequirement = $this->course($major, [
            'name' => 'متطلب جامعة أونلاين مجتاز',
            'type' => 'university_req',
            'credit_hours' => 3,
        ]);
        $this->pass($user, $passedRequirement, 88);
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user->fresh(), 'balanced', true);
        $names = array_column($path['current_semester']['courses'], 'name');

        $this->assertNotContains('متطلب جامعة أونلاين مجتاز', $names);
        $this->assertContains('متطلب جامعة أونلاين 1', $names);
    }

    /** The balance rule applies to the whole roadmap, not just the first term. */
    public function test_every_planned_semester_is_balanced(): void
    {
        [$user, $major] = $this->student();
        $this->pool($major, majorCount: 12, universityCount: 6);
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);

        foreach (array_merge([$path['current_semester']], $path['roadmap']) as $semester) {
            $university = array_filter($semester['courses'], fn ($c) => $this->isUniversity($c));
            $this->assertNotEmpty($university, "Unbalanced semester: {$semester['label']}");
        }
    }

    /* ── the ranker feeding the model ───────────────────────────────────── */

    public function test_the_shortlist_handed_to_the_model_is_never_all_major_courses(): void
    {
        $pool = [];
        foreach (range(1, 10) as $index) {
            $pool[] = [
                'id' => $index,
                'name' => "مادة تخصص {$index}",
                'type' => 'compulsory',
                'credit_hours' => 3,
                'difficulty_level' => 4,
                'unlocks' => 5,
                'prereq_count' => 0,
            ];
        }
        // The lowest-value course in the pool: it can only get in via the rule.
        $pool[] = [
            'id' => 99,
            'name' => 'متطلب جامعة أونلاين',
            'type' => 'university_req',
            'credit_hours' => 3,
            'difficulty_level' => 1,
            'unlocks' => 0,
            'prereq_count' => 0,
        ];

        $ranked = app(CourseRankingEngine::class)->rank($pool, ['student_year' => 1, 'student_semester' => 1], 'عام');

        $this->assertCount(8, $ranked, 'The prompt budget is unchanged.');
        $ids = array_column($ranked, 'id');
        $this->assertContains(99, $ids, 'A university requirement must reach the model.');
        $this->assertStringContainsString(
            'يوازن حمل الفصل',
            collect($ranked)->firstWhere('id', 99)['reason']
        );
    }

    public function test_the_shortlist_is_untouched_when_it_is_already_mixed(): void
    {
        $pool = [
            ['id' => 1, 'name' => 'تخصص', 'type' => 'compulsory', 'credit_hours' => 3, 'difficulty_level' => 3, 'unlocks' => 4, 'prereq_count' => 0],
            ['id' => 2, 'name' => 'متطلب', 'type' => 'university_req', 'credit_hours' => 3, 'difficulty_level' => 1, 'unlocks' => 3, 'prereq_count' => 0],
        ];

        $ranked = app(CourseRankingEngine::class)->rank($pool, ['student_year' => 1, 'student_semester' => 1], 'عام');

        $this->assertSame([1, 2], array_column($ranked, 'id'));
        // No swap happened, so the swap-in marker is absent — the course keeps the
        // ordinary computed description it would have had anyway.
        $this->assertStringNotContainsString(
            'يوازن حمل الفصل مع مواد التخصص',
            collect($ranked)->firstWhere('id', 2)['reason']
        );
    }

    public function test_an_empty_pool_stays_empty(): void
    {
        $this->assertSame([], app(CourseRankingEngine::class)->rank([], ['student_year' => 1], 'عام'));
    }

    /* ── end to end ─────────────────────────────────────────────────────── */

    /** The model receives a balanced shortlist and is told to keep it balanced. */
    public function test_the_prompt_offers_a_requirement_and_demands_balance(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $this->pool($major);
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل هذا الفصل؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();

        $this->assertStringContainsString('متطلب جامعة أونلاين', $prompt);
        $this->assertStringContainsString('لا تقترح فصلاً كله مواد تخصص', $prompt);
    }

    /** The plan panel the student sees is balanced too. */
    public function test_the_plan_widget_is_balanced(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.new_widgets', true);

        [$user, $major] = $this->student();
        $this->pool($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'semester_plan');

        $this->assertNotNull($widget);
        $this->assertNotEmpty(
            array_filter($widget['courses'], fn ($c) => str_contains($c['name'], 'متطلب جامعة')),
            'The panel the student can apply with one press must itself be balanced.'
        );
    }
}
