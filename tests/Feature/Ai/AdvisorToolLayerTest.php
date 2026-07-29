<?php

namespace Tests\Feature\Ai;

use App\Services\AiToolRegistry;

/**
 * The tool layer wired into the live pipeline behind AI_TOOL_REGISTRY_ENABLED.
 */
class AdvisorToolLayerTest extends AdvisorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('ai.features.intent_router', true);
    }

    public function test_with_the_flag_off_no_tool_facts_reach_the_prompt(): void
    {
        config()->set('ai.features.tool_registry', false);

        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['name' => 'مادة سلة', 'credit_hours' => 3]));
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع جدولي وقول لي شو أحذف'])
            ->assertOk();

        $this->assertStringNotContainsString('نتائج موثوقة', $fake->lastSystemInstruction());
        $this->assertSame([], $response->json('tools_called') ?? []);
    }

    public function test_verified_tool_facts_are_handed_to_the_model(): void
    {
        config()->set('ai.features.tool_registry', true);

        [$user, $major] = $this->student();
        foreach (range(1, 5) as $index) {
            $this->addToCart($user, $this->course($major, ['name' => "مادة سلة {$index}", 'credit_hours' => 3]));
        }
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع جدولي وقول لي شو أحذف'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $this->assertStringContainsString('نتائج موثوقة', $prompt);
        $this->assertStringContainsString('review_cart', $prompt);
        // The real numbers, computed by the application rather than the model.
        $this->assertStringContainsString('"hours":15', $prompt);
        $this->assertStringContainsString('"limit":18', $prompt);
        // And an explicit instruction not to recompute them.
        $this->assertStringContainsString('اعتمد عليها حرفياً', $prompt);
    }

    /** A GPA target the student named is computed, not estimated by the model. */
    public function test_a_gpa_goal_is_computed_before_the_model_answers(): void
    {
        config()->set('ai.features.tool_registry', true);

        [$user, $major] = $this->student();
        foreach (range(1, 10) as $index) {
            $this->pass($user, $this->course($major, ['name' => "مادة سابقة {$index}", 'credit_hours' => 3]), 70);
        }
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'كيف أرفع معدلي لأوصل 75؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $this->assertStringContainsString('calculate_gpa_goal', $prompt);
        $this->assertStringContainsString('"current_gpa":70', $prompt);
        $this->assertStringContainsString('"target_gpa":75', $prompt);
        $this->assertStringContainsString('"required_term_average"', $prompt);
    }

    /**
     * The point of the honest-referral design: a calendar question reaches the
     * model with an instruction NOT to answer from general knowledge.
     */
    public function test_an_ungrounded_question_instructs_the_model_to_refer_instead_of_guessing(): void
    {
        config()->set('ai.features.tool_registry', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'متى تبدأ الامتحانات النهائية؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $this->assertStringContainsString('لا يوجد مصدر بيانات', $prompt);
        $this->assertStringContainsString('المصدر الرسمي', $prompt);
        $this->assertStringContainsString('لا تجب من معرفتك العامة', $prompt);
    }

    public function test_the_response_reports_which_tools_ran(): void
    {
        config()->set('ai.features.tool_registry', true);

        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع سلتي'])
            ->assertOk();

        $this->assertSame(['review_cart'], $response->json('tools_called'));
        $this->assertNotEmpty($response->json('tool_sources'));
    }

    /** A broken tool layer must not cost the student their answer. */
    public function test_a_failing_tool_layer_degrades_to_an_ordinary_answer(): void
    {
        config()->set('ai.features.tool_registry', true);

        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب سليم 🙂'])]);

        $this->app->bind(AiToolRegistry::class, fn () => new class extends AiToolRegistry {
            public function plan(array $routed, string $message = ''): array
            {
                throw new \RuntimeException('tool layer exploded');
            }
        });

        $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع سلتي'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('reply', 'جواب سليم 🙂')
            ->assertJsonPath('tools_called', []);
    }

    /** Tool results must not leak into the stored message envelope. */
    public function test_tool_results_are_not_persisted_with_the_message(): void
    {
        config()->set('ai.features.tool_registry', true);

        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chatId = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع سلتي'])
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

    /** A tool can only ever read the authenticated student's data. */
    public function test_a_tool_cannot_be_pointed_at_another_students_record(): void
    {
        [$attacker, $attackerMajor] = $this->student('attacker@example.com');
        [$victim, $victimMajor] = $this->student('victim@example.com');
        $this->course($attackerMajor, ['name' => 'مادة المهاجم']);
        $victimCourse = $this->course($victimMajor, ['name' => 'مادة الضحية']);
        $this->addToCart($victim, $victimCourse);
        $this->currentPeriod();

        $registry = app(AiToolRegistry::class);

        // Arguments cannot select a student: the caller supplies the user.
        $cart = $registry->call($attacker->fresh(), 'review_cart', ['user_id' => $victim->id]);
        $this->assertTrue($cart['data']['is_empty'], "The attacker's own cart is empty.");

        $details = $registry->call($attacker->fresh(), 'get_course_details', ['course_id' => $victimCourse->id]);
        $this->assertFalse($details['ok']);
        $this->assertSame('course_not_visible', $details['errors'][0]['code']);
    }
}
