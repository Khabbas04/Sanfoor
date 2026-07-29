<?php

namespace Tests\Feature\Ai;

use App\Services\AiAnswerAssessor;
use Tests\Support\FakeGeminiService;

/**
 * Sources and confidence: what the answer is based on, and how much of it the
 * application is actually willing to stand behind.
 */
class AdvisorSourcesTest extends AdvisorTestCase
{
    private AiAnswerAssessor $assessor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assessor = new AiAnswerAssessor();
    }

    /* ── the assessor ───────────────────────────────────────────────────── */

    public function test_a_clean_grounded_answer_scores_high(): void
    {
        $result = $this->assessor->confidence([
            'intent' => ['intent' => 'course_recommendation', 'confidence' => 0.95, 'requires_clarification' => false],
            'completeness' => ['grounded' => true, 'has_academic_records' => true],
            'validation' => ['valid' => true, 'dropped_ids' => 0],
            'available_course_count' => 12,
        ]);

        $this->assertSame('high', $result['level']);
        $this->assertGreaterThan(0.8, $result['score']);
        $this->assertSame([], $result['reasons'], 'Nothing held this answer back.');
    }

    /** Missing data is the heaviest penalty: it must not read as confident. */
    public function test_an_ungrounded_answer_scores_low_and_says_why(): void
    {
        $result = $this->assessor->confidence([
            'intent' => ['intent' => 'calendar_question', 'confidence' => 0.9, 'requires_clarification' => false],
            'completeness' => ['grounded' => false, 'has_academic_records' => true],
            'validation' => ['valid' => true, 'dropped_ids' => 0],
            'available_course_count' => 10,
        ]);

        $this->assertSame('low', $result['level']);
        $this->assertContains('data_completeness', array_column($result['reasons'], 'code'));
    }

    public function test_dropped_ids_and_an_ambiguous_question_lower_the_score(): void
    {
        $clean = $this->assessor->confidence([
            'intent' => ['confidence' => 0.9, 'requires_clarification' => false],
            'completeness' => ['grounded' => true, 'has_academic_records' => true],
            'validation' => ['valid' => true, 'dropped_ids' => 0],
            'available_course_count' => 10,
        ]);

        $dropped = $this->assessor->confidence([
            'intent' => ['confidence' => 0.9, 'requires_clarification' => false],
            'completeness' => ['grounded' => true, 'has_academic_records' => true],
            'validation' => ['valid' => true, 'dropped_ids' => 3],
            'available_course_count' => 10,
        ]);

        $ambiguous = $this->assessor->confidence([
            'intent' => ['confidence' => 0.4, 'requires_clarification' => true],
            'completeness' => ['grounded' => true, 'has_academic_records' => true],
            'validation' => ['valid' => true, 'dropped_ids' => 0],
            'available_course_count' => 10,
        ]);

        $this->assertLessThan($clean['score'], $dropped['score']);
        $this->assertLessThan($clean['score'], $ambiguous['score']);
        $this->assertContains('validation', array_column($dropped['reasons'], 'code'));
        $this->assertContains('intent_clarity', array_column($ambiguous['reasons'], 'code'));
    }

    public function test_an_unresolved_named_course_lowers_the_score(): void
    {
        $result = $this->assessor->confidence([
            'intent' => ['confidence' => 0.9, 'requires_clarification' => false],
            'completeness' => ['grounded' => true, 'has_academic_records' => true],
            'validation' => ['valid' => true, 'dropped_ids' => 0],
            'asked_course_ids' => [11, 12],
            'resolved_course_ids' => [11],
            'available_course_count' => 10,
        ]);

        $this->assertContains('entity_match', array_column($result['reasons'], 'code'));
    }

    /** A fallback reply is a holding answer and must never look authoritative. */
    public function test_a_fallback_answer_is_always_low_confidence(): void
    {
        $result = $this->assessor->confidence([
            'intent' => ['confidence' => 0.97, 'requires_clarification' => false],
            'completeness' => ['grounded' => true, 'has_academic_records' => true],
            'validation' => ['valid' => true, 'dropped_ids' => 0],
            'available_course_count' => 20,
            'used_fallback' => true,
        ]);

        $this->assertSame('low', $result['level']);
        $this->assertSame([['code' => 'fallback_answer', 'weight' => 1.0]], $result['reasons']);
    }

    public function test_the_score_is_always_inside_its_bounds(): void
    {
        foreach ([[], ['completeness' => ['grounded' => false]], ['intent' => ['confidence' => 5.0]]] as $signals) {
            $score = $this->assessor->confidence($signals)['score'];
            $this->assertGreaterThanOrEqual(0.05, $score);
            $this->assertLessThanOrEqual(0.97, $score);
        }
    }

    public function test_sources_of_the_same_type_are_merged(): void
    {
        $merged = $this->assessor->mergeSources(
            [['type' => 'study_plan', 'label' => 'خطتك الدراسية', 'entity_ids' => [1, 2]]],
            [['type' => 'study_plan', 'label' => 'خطتك الدراسية', 'entity_ids' => [2, 3]]],
            [['type' => 'cart', 'label' => 'تسجيلك التجريبي', 'entity_ids' => [9]]],
            [['label' => 'بلا نوع', 'entity_ids' => [99]]], // discarded: no type
        );

        $this->assertCount(2, $merged);
        $plan = collect($merged)->firstWhere('type', 'study_plan');
        $this->assertSame([1, 2, 3], $plan['entity_ids']);
    }

    public function test_regulation_article_numbers_become_a_source(): void
    {
        $sources = $this->assessor->documentSources([
            ['text' => '**المادة (25) لا يجوز للطالب التغيب أكثر من ...'],
            ['text' => '**المادة 30 يُنذر الطالب إذا ...'],
        ]);

        $this->assertSame('regulations', $sources[0]['type']);
        $this->assertSame([25, 30], $sources[0]['entity_ids']);
        $this->assertSame([], $this->assessor->documentSources([]));
    }

    /* ── wiring ─────────────────────────────────────────────────────────── */

    public function test_with_the_flag_off_neither_field_is_emitted(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.sources', false);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('sources', [])
            ->assertJsonPath('confidence', null)
            ->assertJsonPath('validation', null);
    }

    public function test_with_the_flag_on_the_answer_cites_its_sources(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.sources', true);

        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $inCart = $this->course($major, ['name' => 'مادة بالسلة']);
        $this->pass($user, $this->course($major, ['name' => 'مادة مجتازة']), 80);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل هذا الفصل؟'])
            ->assertOk();

        $types = array_column($response->json('sources'), 'type');
        $this->assertContains('study_plan', $types);
        $this->assertContains('cart', $types);
        $this->assertContains('transcript', $types);

        foreach ($response->json('sources') as $source) {
            $this->assertSame(['type', 'label', 'entity_ids'], array_keys($source));
        }

        $this->assertSame('high', $response->json('confidence.level'));
        $this->assertTrue($response->json('validation.valid'));
        $this->assertSame(0, $response->json('validation.dropped_ids'));
    }

    /** A hallucinated id shows up as a reported, visible validation drop. */
    public function test_a_dropped_hallucinated_id_is_reported_in_the_validation_summary(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.sources', true);

        [$user, $major] = $this->student();
        $real = $this->course($major, ['name' => 'مادة حقيقية']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope([
            'suggested_course_ids' => [$real->id, 999998, 999999],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $this->assertFalse($response->json('validation.valid'));
        $this->assertSame(2, $response->json('validation.dropped_ids'));
        $this->assertContains('validation', array_column($response->json('confidence.reasons'), 'code'));
    }

    /** An ungrounded question is answered with visibly low confidence. */
    public function test_an_ungrounded_question_is_reported_as_low_confidence(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.sources', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'متى تبدأ الامتحانات النهائية؟'])
            ->assertOk();

        $this->assertSame('low', $response->json('confidence.level'));
        $this->assertContains('data_completeness', array_column($response->json('confidence.reasons'), 'code'));
    }

    /** The fallback reply carries no sources and no borrowed confidence. */
    public function test_the_fallback_reply_carries_no_sources_or_confidence(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.sources', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([FakeGeminiService::FAIL]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('is_fallback', true);

        $this->assertSame([], $response->json('sources') ?? []);
        $this->assertNull($response->json('confidence'));
    }

    /** Sources must not be persisted into the message envelope. */
    public function test_sources_are_not_persisted_with_the_message(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.sources', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chatId = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->json('chat_id');

        $stored = json_decode(
            $user->chats()->find($chatId)->messages()->where('role', 'ai')->first()->content,
            true
        );

        $this->assertSame(
            ['reply', 'suggested_courses', 'courses_to_remove', 'follow_up_suggestions', 'interactive_widget'],
            array_keys($stored)
        );
    }
}
