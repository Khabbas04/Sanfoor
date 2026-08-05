<?php

namespace Tests\Feature\Ai;

use App\Engines\StructuredRagEngine;

/**
 * Intent-aware retrieval (StructuredRagEngine::gatherFor) and its wiring into
 * the pipeline behind AI_ENHANCED_RAG_ENABLED.
 */
class StructuredRagRetrievalTest extends AdvisorTestCase
{
    /** gather() must keep behaving exactly as it did. */
    public function test_the_original_gather_is_untouched_by_the_new_retrieval(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 20) as $index) {
            $this->course($major, ['name' => "مادة {$index}"]);
        }
        $this->currentPeriod();

        $engine = app(StructuredRagEngine::class);
        $base = $engine->gather($user);

        $this->assertSame(
            ['profile', 'cart', 'available_courses', 'locked_courses'],
            array_keys($base)
        );
        $this->assertCount(20, $base['available_courses']);
    }

    public function test_retrieval_trims_the_pool_to_what_the_intent_can_use(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 20) as $index) {
            $this->course($major, ['name' => "مادة {$index}"]);
        }
        $this->currentPeriod();

        $engine = app(StructuredRagEngine::class);

        $recommendation = $engine->gatherFor($user, ['intent' => 'course_recommendation']);
        $policy = $engine->gatherFor($user, ['intent' => 'academic_policy']);

        $this->assertCount(12, $recommendation['available_courses']);
        $this->assertTrue($recommendation['truncated']);
        $this->assertSame(20, $recommendation['total_available_count']);

        // A regulations question does not need a course catalogue.
        $this->assertCount(3, $policy['available_courses']);

        // The unfiltered picture is still reported alongside the trimmed pool.
        $this->assertSame(20, $policy['total_available_count']);
    }

    public function test_a_course_the_student_named_always_survives_the_trim(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 20) as $index) {
            $this->course($major, ['name' => "مادة {$index}"]);
        }
        $needle = $this->course($major, ['name' => 'مادة نادرة جداً', 'type' => 'elective', 'difficulty_level' => 1]);
        $this->currentPeriod();

        $result = app(StructuredRagEngine::class)->gatherFor($user, [
            'intent' => 'academic_policy', // the tightest pool there is
            'entities' => ['course_ids' => [$needle->id]],
        ]);

        $this->assertContains($needle->id, array_column($result['available_courses'], 'id'));
        $this->assertSame([$needle->id], array_column($result['named_courses'], 'id'));
    }

    /** "Why can't I take this?" needs the locked course itself. */
    public function test_a_named_locked_course_is_surfaced(): void
    {
        [$user, $major] = $this->student();
        $prerequisite = $this->course($major, ['name' => 'البرمجة الأولى']);
        $locked = $this->course($major, ['name' => 'البرمجة المتقدمة', 'semester' => 2]);
        $locked->prerequisites()->attach($prerequisite->id);
        $this->currentPeriod();

        $result = app(StructuredRagEngine::class)->gatherFor($user, [
            'intent' => 'prerequisite_check',
            'entities' => ['course_ids' => [$locked->id]],
        ]);

        $this->assertSame([$locked->id], array_column($result['named_locked_courses'], 'id'));
        $this->assertNotEmpty($result['locked_courses'][0]['reasons'] ?? []);
    }

    public function test_retrieval_reports_its_sources(): void
    {
        [$user, $major] = $this->student();
        $available = $this->course($major, ['name' => 'مادة متاحة']);
        $inCart = $this->course($major, ['name' => 'مادة بالسلة']);
        $passed = $this->course($major, ['name' => 'مادة مجتازة']);
        $this->pass($user, $passed, 80);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();

        $result = app(StructuredRagEngine::class)->gatherFor($user->fresh(), ['intent' => 'gpa_goal']);

        $types = array_column($result['sources'], 'type');
        $this->assertContains('study_plan', $types);
        $this->assertContains('cart', $types);
        $this->assertContains('transcript', $types);
        $this->assertContains('academic_rules', $types);

        foreach ($result['sources'] as $source) {
            $this->assertSame(['type', 'label', 'entity_ids'], array_keys($source));
            $this->assertNotSame('', $source['label']);
        }

        $studyPlan = collect($result['sources'])->firstWhere('type', 'study_plan');
        $this->assertContains($available->id, $studyPlan['entity_ids']);

        $transcript = collect($result['sources'])->firstWhere('type', 'transcript');
        $this->assertSame([$passed->id], $transcript['entity_ids']);
    }

    /** An empty cart produces no cart source, so citations stay meaningful. */
    public function test_sources_only_list_what_actually_contributed(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $result = app(StructuredRagEngine::class)->gatherFor($user, ['intent' => 'course_question']);

        $types = array_column($result['sources'], 'type');
        $this->assertNotContains('cart', $types);
        $this->assertNotContains('transcript', $types);
        $this->assertNotContains('academic_rules', $types);
    }

    /** Retrieval is honest about the data this deployment does not have. */
    public function test_completeness_marks_ungrounded_intents(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $engine = app(StructuredRagEngine::class);

        $calendar = $engine->gatherFor($user, ['intent' => 'calendar_question']);
        $this->assertFalse($calendar['completeness']['has_calendar_data']);
        $this->assertFalse($calendar['completeness']['grounded']);

        $sections = $engine->gatherFor($user, ['intent' => 'section_question']);
        $this->assertTrue($sections['completeness']['grounded']);

        $recommendation = $engine->gatherFor($user, ['intent' => 'course_recommendation']);
        $this->assertTrue($recommendation['completeness']['grounded']);

        // A GPA question is only grounded once the student has grades on record.
        $gpa = $engine->gatherFor($user, ['intent' => 'gpa_goal']);
        $this->assertFalse($gpa['completeness']['grounded']);
    }

    public function test_retrieval_never_crosses_major_or_plan_boundaries(): void
    {
        [$user, $major] = $this->student();
        [, $otherMajor] = $this->student('other@example.com');
        $own = $this->course($major, ['name' => 'مادة تخصصي']);
        $foreign = $this->course($otherMajor, ['name' => 'مادة تخصص آخر']);
        $oldPlan = $this->course($major, ['name' => 'مادة خطة قديمة', 'study_plan_version' => 11]);
        $this->currentPeriod();

        $result = app(StructuredRagEngine::class)->gatherFor($user, [
            'intent' => 'course_recommendation',
            // Even when the ids are handed in as "named" entities.
            'entities' => ['course_ids' => [$foreign->id, $oldPlan->id]],
        ]);

        $ids = array_column($result['available_courses'], 'id');
        $this->assertContains($own->id, $ids);
        $this->assertNotContains($foreign->id, $ids);
        $this->assertNotContains($oldPlan->id, $ids);
        $this->assertSame([], $result['named_courses']);
    }

    /* ── wiring ─────────────────────────────────────────────────────────── */

    /** With the flag off the prompt is built from the untrimmed pool, as before. */
    public function test_with_the_flag_off_the_pool_is_not_trimmed(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', false);
        config()->set('ai.features.tool_registry', false);

        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة مذكورة بالاسم', 'type' => 'elective', 'difficulty_level' => 1]);
        foreach (range(1, 12) as $index) {
            $this->course($major, ['name' => "مادة إجبارية {$index}", 'type' => 'compulsory']);
        }
        $this->currentPeriod();

        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة معتمدة لمادة مذكورة بالاسم؟'])
            ->assertOk();

        // Ranking still cuts at its own limit, so a low-scoring elective the
        // student asked about does not necessarily reach the prompt.
        $this->assertStringNotContainsString('مادة مذكورة بالاسم', $fake->lastSystemInstruction());
    }

    /** With the flag on, the course the student asked about reaches the model. */
    public function test_with_the_flag_on_the_named_course_reaches_the_prompt(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);

        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة مذكورة بالاسم', 'type' => 'elective', 'difficulty_level' => 1]);
        foreach (range(1, 12) as $index) {
            $this->course($major, ['name' => "مادة إجبارية {$index}", 'type' => 'compulsory']);
        }
        $this->currentPeriod();

        $fake = $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة معتمدة لمادة مذكورة بالاسم؟'])
            ->assertOk();

        $this->assertStringContainsString('مادة مذكورة بالاسم', $fake->lastSystemInstruction());
        $this->assertNotEmpty($response->json('intent.entities.course_ids'));
    }

    /**
     * Trimming what the model SEES must never shrink what validation ALLOWS:
     * a course outside the trimmed pool is still addable when the student is
     * eligible for it.
     */
    public function test_trimming_the_prompt_pool_does_not_narrow_validation(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);

        [$user, $major] = $this->student();
        foreach (range(1, 20) as $index) {
            $this->course($major, ['name' => "مادة إجبارية {$index}", 'type' => 'compulsory']);
        }
        $tail = $this->course($major, ['name' => 'مادة اختيارية طرفية', 'type' => 'elective', 'difficulty_level' => 5]);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'تمت إضافتها بنجاح ✅',
            'courses_to_add' => [$tail->id],
        ])]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أضف مادة اختيارية طرفية'])
            ->assertOk()
            ->assertJsonPath('refresh_cart', true);

        $this->assertDatabaseHas('user_carts', ['user_id' => $user->id, 'course_id' => $tail->id]);
    }

    /** A retrieval failure degrades to the legacy pool rather than erroring. */
    public function test_a_failing_retrieval_degrades_to_the_legacy_pool(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);

        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة عادية']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب سليم 🙂'])]);

        // gather() still works (inherited); only the new retrieval path fails.
        $this->app->bind(StructuredRagEngine::class, fn () => new class extends StructuredRagEngine {
            public function gatherFor(\App\Models\User $user, array $options = []): array
            {
                throw new \RuntimeException('retrieval exploded');
            }
        });

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('reply', 'جواب سليم 🙂')
            ->assertJsonPath('intent', null);
    }
}
