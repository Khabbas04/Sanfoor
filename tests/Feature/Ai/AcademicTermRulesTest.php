<?php

namespace Tests\Feature\Ai;

use App\Engines\AcademicRulesEngine;
use App\Models\AcademicPeriod;
use App\Services\AcademicPathPlannerService;
use App\Support\AcademicCache;
use Illuminate\Support\Facades\Cache;

/**
 * One source of truth for the registration ceiling, and instant propagation when
 * the admin changes the current term.
 *
 * The limits used to be duplicated in AcademicRulesEngine constants, in
 * AiAdvisorController constants AND again inside its getRegistrationLimits(), in the
 * planner config, in the advisor prompt text and as a literal 18 in the frontend.
 * They disagreed: the summer cap read 9 in some paths and 10 in others.
 */
class AcademicTermRulesTest extends AdvisorTestCase
{
    /* ── the single source ──────────────────────────────────────────────── */

    public function test_the_configured_limits_are_the_only_authority(): void
    {
        $limits = (array) config('academic_terms.limits');

        // Regular and summer terms carry different ceilings.
        $this->assertSame((int) $limits['regular'], AcademicPeriod::maxHoursFor(1));
        $this->assertSame((int) $limits['regular'], AcademicPeriod::maxHoursFor(2));
        $this->assertSame((int) $limits['summer'], AcademicPeriod::maxHoursFor(3));

        // Probation takes whichever is lower, never a higher one.
        $this->assertSame((int) $limits['probation'], AcademicPeriod::maxHoursFor(1, isProbation: true));
        $this->assertSame(
            min((int) $limits['summer'], (int) $limits['probation']),
            AcademicPeriod::maxHoursFor(3, isProbation: true)
        );

        // A graduating student gets the documented exception.
        $this->assertSame((int) $limits['graduating_regular'], AcademicPeriod::maxHoursFor(1, isGraduating: true));
        $this->assertSame((int) $limits['graduating_summer'], AcademicPeriod::maxHoursFor(3, isGraduating: true));
    }

    /** Change the config and EVERY consumer moves with it. */
    public function test_changing_the_configured_cap_moves_every_consumer(): void
    {
        config()->set('academic_terms.limits.summer', 7);
        AcademicCache::bump();

        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod(3, '2026/2027');
        $fake = $this->fakeGemini([$this->envelope()]);

        // The rules engine…
        $rules = app(AcademicRulesEngine::class)->evaluate($user, ['total_passed_hours' => 60], 0);
        $this->assertSame(7, $rules['effective_limit']);

        // …the page the student sees…
        $this->actingAs($user)
            ->get(route('ai.advisor'))
            ->assertInertia(fn ($page) => $page->where('studentStats.max_allowed_hours', 7));

        // …and the prompt the model is given.
        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة أسجل؟'])
            ->assertOk();

        $this->assertStringContainsString('7 ساعة', $fake->lastSystemInstruction());
    }

    /** The summer cap the admin asked for. */
    public function test_the_summer_term_is_capped_at_ten_hours(): void
    {
        $this->assertSame(10, (int) config('academic_terms.limits.summer'));
        $this->assertSame(18, (int) config('academic_terms.limits.regular'));

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod(3, '2026/2027');

        $rules = app(AcademicRulesEngine::class)->evaluate($user, ['total_passed_hours' => 60], 0);

        $this->assertSame(10, $rules['effective_limit']);
        $this->assertTrue($rules['is_summer']);
    }

    /* ── the term sequence ──────────────────────────────────────────────── */

    public function test_terms_follow_first_then_second_then_summer(): void
    {
        $first = $this->currentPeriod(1, '2026/2027');
        $this->assertSame(2, $first->nextTerm()['academic_term']);
        $this->assertSame('2026/2027', $first->nextTerm()['academic_year'], 'Term 1 → 2 stays in the same year.');

        $second = $this->currentPeriod(2, '2026/2027');
        $this->assertSame(3, $second->nextTerm()['academic_term']);
        $this->assertSame('الفصل الصيفي', $second->nextTerm()['label']);

        // The summer term closes the academic year.
        $summer = $this->currentPeriod(3, '2026/2027');
        $this->assertSame(1, $summer->nextTerm()['academic_term']);
        $this->assertSame('2027/2028', $summer->nextTerm()['academic_year']);
    }

    public function test_a_single_year_format_also_advances(): void
    {
        $this->assertSame('2027', AcademicPeriod::advanceYear('2026'));
        $this->assertSame('2027/2028', AcademicPeriod::advanceYear('2026/2027'));
        // An unrecognised format is left alone rather than mangled.
        $this->assertSame('غير محدد', AcademicPeriod::advanceYear('غير محدد'));
    }

    public function test_the_upcoming_terms_walk_the_whole_cycle(): void
    {
        $terms = $this->currentPeriod(2, '2026/2027')->upcomingTerms(3);

        $this->assertSame([3, 1, 2], array_column($terms, 'academic_term'));
        $this->assertSame(['2026/2027', '2027/2028', '2027/2028'], array_column($terms, 'academic_year'));
    }

    /** A predicted summer term must be planned against the SUMMER cap. */
    public function test_a_predicted_summer_term_uses_the_summer_cap(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 12) as $index) {
            $this->course($major, ['name' => "مادة {$index}", 'credit_hours' => 3]);
        }
        // Current term is the second, so the next one in the roadmap is the summer.
        $this->currentPeriod(2, '2026/2027');

        $path = app(AcademicPathPlannerService::class)->generate($user, 'fastest_graduation', true);
        $summer = collect($path['roadmap'])->firstWhere('is_summer', true);

        $this->assertNotNull($summer, 'The roadmap must reach the summer term.');
        $this->assertSame(3, $summer['academic_term']);
        $this->assertLessThanOrEqual((int) config('academic_terms.limits.graduating_summer'), $summer['total_hours']);
        // Named, so the student can see which term the lighter cap belongs to.
        $this->assertStringContainsString('الصيفي', $summer['label']);
        $this->assertSame('2026/2027', $summer['academic_year']);
    }

    /** The advisor is told what comes next and what it allows. */
    public function test_the_prompt_states_the_next_term_and_its_ceiling(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod(2, '2026/2027');
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();

        $this->assertStringContainsString('تسلسل الفصول', $prompt);
        $this->assertStringContainsString('الفصل الصيفي', $prompt);
        $this->assertStringContainsString((string) config('academic_terms.limits.summer') . ' ساعة', $prompt);
    }

    /* ── propagation ────────────────────────────────────────────────────── */

    /**
     * The admin's complaint: changing the term from the settings screen has to apply
     * across the site immediately, not after a cached snapshot expires.
     */
    public function test_changing_the_current_term_retires_every_derived_cache(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod(1, '2026/2027');

        // Warm the snapshot under the regular term. A chat request is what populates
        // it; the page itself deliberately clears these keys on load.
        $this->fakeGemini([$this->envelope()]);
        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة أسجل؟'])
            ->assertOk();

        $generation = AcademicCache::version();
        $this->assertNotNull(
            Cache::get(AcademicCache::key("student_academic_data_{$user->id}")),
            'The snapshot must be cached before the change, or this proves nothing.'
        );
        $this->assertSame(
            18,
            Cache::get(AcademicCache::key("student_academic_data_{$user->id}"))['max_allowed_hours']
        );

        // The admin switches to the summer term.
        $this->currentPeriod(3, '2026/2027');

        $this->assertGreaterThan($generation, AcademicCache::version(), 'The generation must move.');

        // The warmed snapshot is retired, and the new cap applies at once.
        $this->actingAs($user)
            ->get(route('ai.advisor'))
            ->assertInertia(fn ($page) => $page->where(
                'studentStats.max_allowed_hours',
                (int) config('academic_terms.limits.summer')
            ));
    }

    /** A stale AI answer must not survive a term change either. */
    public function test_a_cached_answer_does_not_survive_a_term_change(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod(1, '2026/2027');
        $fake = $this->fakeGemini([
            $this->envelope(['reply' => 'جواب الفصل الاعتيادي']),
            $this->envelope(['reply' => 'جواب الفصل الصيفي']),
        ]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة أسجل؟'])
            ->assertOk()
            ->assertJsonPath('reply', 'جواب الفصل الاعتيادي');

        $this->currentPeriod(3, '2026/2027');

        // Same question, new term: the answer is regenerated against the new cap
        // instead of being replayed from the two-hour response cache.
        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة أسجل؟'])
            ->assertOk()
            ->assertJsonPath('is_cached', false)
            ->assertJsonPath('reply', 'جواب الفصل الصيفي');

        $this->assertCount(2, $fake->calls);
    }

    public function test_the_generation_only_moves_when_a_period_is_written(): void
    {
        $this->currentPeriod(1, '2026/2027');
        $generation = AcademicCache::version();

        [$user, $major] = $this->student();
        $this->course($major);
        $this->actingAs($user)->get(route('ai.advisor'))->assertOk();

        $this->assertSame($generation, AcademicCache::version(), 'Ordinary traffic must not churn the cache.');
    }
}
