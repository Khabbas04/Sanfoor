<?php

namespace Tests\Feature\Ai;

use App\Services\AiIntentRouterService;
use App\Services\StudentAcademicContextService;

/**
 * The intent router wired into the live pipeline.
 *
 * The contract here is as much about the OFF state as the ON state: with the
 * flag down the advisor must behave exactly as it did before this code existed.
 */
class AdvisorIntentIntegrationTest extends AdvisorTestCase
{
    public function test_with_the_flag_off_no_intent_is_reported(): void
    {
        config()->set('ai.features.intent_router', false);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل هذا الفصل؟'])
            ->assertOk()
            ->assertJsonPath('intent', null);
    }

    public function test_with_the_flag_on_the_intent_is_reported_alongside_the_legacy_payload(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'هياكل البيانات']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل هذا الفصل؟'])
            ->assertOk()
            ->assertJsonPath('intent.intent', 'course_recommendation')
            ->assertJsonPath('intent.requires_clarification', false);

        $this->assertGreaterThan(0.5, $response->json('intent.confidence'));

        // Every legacy key is still exactly where it was.
        $response->assertJsonStructure([
            'reply', 'suggested_courses', 'courses_to_remove', 'follow_up_suggestions',
            'interactive_widget', 'refresh_cart', 'chat_id', 'daily_messages_remaining',
            'has_daily_limit', 'is_fallback', 'is_cached', 'fallback_reason',
        ]);
    }

    /** The intent must never be written into the stored message envelope. */
    public function test_the_stored_message_envelope_keeps_its_five_keys(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chatId = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كيف أرفع معدلي؟'])
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

    /** A router failure must degrade to the legacy path, not to an error. */
    public function test_a_failing_router_degrades_to_the_legacy_path(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب سليم 🙂'])]);

        // A router that throws on every call.
        $this->app->bind(AiIntentRouterService::class, function () {
            return new class extends AiIntentRouterService {
                public function route(string $message, array $context = []): array
                {
                    throw new \RuntimeException('router exploded');
                }
            };
        });

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('intent', null)
            ->assertJsonPath('reply', 'جواب سليم 🙂');
    }

    /**
     * The point of Phase 1: the ranking engine finally receives the intent and
     * the course shape it reads, so a course that unlocks many others outranks a
     * dead-end elective in the prompt.
     */
    public function test_the_ranking_engine_now_receives_usable_inputs(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $pivotal = $this->course($major, ['name' => 'مادة مفصلية', 'type' => 'compulsory']);
        foreach (range(1, 4) as $index) {
            $child = $this->course($major, ['name' => "مادة لاحقة {$index}", 'semester' => 3]);
            $child->prerequisites()->attach($pivotal->id);
        }
        $deadEnd = $this->course($major, ['name' => 'مادة اختيارية معزولة', 'type' => 'elective']);
        $this->currentPeriod();

        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل هذا الفصل؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $pivotalAt = mb_strpos($prompt, 'مادة مفصلية');
        $deadEndAt = mb_strpos($prompt, 'مادة اختيارية معزولة');

        $this->assertNotFalse($pivotalAt, 'The pivotal course must reach the prompt.');
        $this->assertNotFalse($deadEndAt);
        $this->assertLessThan(
            $deadEndAt,
            $pivotalAt,
            'A course that unlocks four others must be ranked above an isolated elective.'
        );
        // The unlock count itself is now visible to the model, by name.
        $this->assertStringContainsString('تفتح لك 4 مواد لاحقة', $prompt);
        $this->assertStringContainsString('مادة لاحقة 1', $prompt);
    }

    /** The GPA intents steer the ranking toward lighter courses. */
    public function test_a_gpa_goal_steers_ranking_toward_easier_courses(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $easy = $this->course($major, ['name' => 'مادة خفيفة', 'difficulty_level' => 1]);
        $hard = $this->course($major, ['name' => 'مادة قاسية', 'difficulty_level' => 5]);
        $this->currentPeriod();

        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كيف أرفع معدلي لأوصل 80؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $this->assertLessThan(
            mb_strpos($prompt, 'مادة قاسية'),
            mb_strpos($prompt, 'مادة خفيفة'),
            'When the goal is a higher GPA the lighter course must rank first.'
        );
        $this->assertNotNull($easy->id);
        $this->assertNotNull($hard->id);
    }

    /** The streaming transport reports the intent too. */
    public function test_the_stream_done_frame_carries_the_intent(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $body = $this->actingAs($user)
            ->post(route('ai.advisor.stream'), ['message' => 'راجع جدولي'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $this->assertStringContainsString('cart_review', $body);
    }

    /** The context facade agrees with the engines it wraps. */
    public function test_the_context_facade_reports_one_consistent_picture(): void
    {
        [$user, $major] = $this->student();
        $available = $this->course($major, ['name' => 'مادة متاحة', 'credit_hours' => 3]);
        $inCart = $this->course($major, ['name' => 'مادة بالسلة', 'credit_hours' => 3]);
        $passed = $this->course($major, ['name' => 'مادة مجتازة', 'credit_hours' => 3]);
        $this->pass($user, $passed, 80);
        $this->addToCart($user, $inCart);
        $this->currentPeriod(3, '2026/2027');

        $context = app(StudentAcademicContextService::class)->for($user->fresh(), true);

        $this->assertSame(18, $context['rules']['academic_limit']);
        $this->assertSame(9, $context['rules']['effective_limit'], 'Summer caps the term at 9 hours.');
        $this->assertTrue($context['period']['is_summer']);
        $this->assertSame(3, $context['cart']['hours']);
        $this->assertTrue($context['completeness']['has_academic_records']);
        $this->assertFalse($context['completeness']['has_calendar_data']);

        // The pooled courses carry both spellings of the unlock count.
        $ids = array_column($context['available_courses'], 'id');
        $this->assertContains($available->id, $ids);
        $this->assertNotContains($passed->id, $ids);
        foreach ($context['available_courses'] as $course) {
            $this->assertArrayHasKey('unlocks', $course);
            $this->assertArrayHasKey('unlocks_count', $course);
            $this->assertSame($course['unlocks'], $course['unlocks_count']);
        }

        // Course names cover both the available pool and the cart.
        $this->assertArrayHasKey($inCart->id, $context['course_names']);
        $this->assertArrayHasKey($available->id, $context['course_names']);
    }

    public function test_the_context_facade_invalidates_the_legacy_caches_too(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $service = app(StudentAcademicContextService::class);
        $service->for($user, true);

        $this->assertNotNull(\Illuminate\Support\Facades\Cache::get("ai_student_context_{$user->id}"));

        $service->invalidate($user);

        $this->assertNull(\Illuminate\Support\Facades\Cache::get("ai_student_context_{$user->id}"));
        $this->assertNull(\Illuminate\Support\Facades\Cache::get("student_academic_data_{$user->id}"));
        $this->assertNull(\Illuminate\Support\Facades\Cache::get("student_cart_data_{$user->id}"));
    }
}
