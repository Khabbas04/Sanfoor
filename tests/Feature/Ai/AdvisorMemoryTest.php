<?php

namespace Tests\Feature\Ai;

use App\Models\StudentAiPreference;

/**
 * The optional academic memory. Five explicit preferences — never a transcript of
 * the conversation — always visible to the student, always clearable by them.
 */
class AdvisorMemoryTest extends AdvisorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('ai.features.intent_router', true);
    }

    public function test_with_the_flag_off_nothing_is_stored_or_injected(): void
    {
        config()->set('ai.features.memory', false);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أبي معدلي يوصل 85'])
            ->assertOk();

        $this->assertDatabaseCount('student_ai_preferences', 0);
        $this->assertStringNotContainsString('تفضيلات الطالب المحفوظة', $fake->lastSystemInstruction());

        $this->actingAs($user)
            ->get(route('ai.advisor'))
            ->assertInertia(fn ($page) => $page->where('aiMemory.enabled', false));
    }

    public function test_a_stated_goal_and_target_are_remembered(): void
    {
        config()->set('ai.features.memory', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), [
                'message' => 'أبي معدلي يوصل 85 وأسجل 15 ساعة',
                'difficulty' => 'easy',
            ])
            ->assertOk();

        $preference = StudentAiPreference::where('user_id', $user->id)->firstOrFail();

        $this->assertSame('raise_gpa', $preference->active_goal);
        $this->assertEquals(85, $preference->gpa_target);
        $this->assertSame(15, $preference->preferred_load);
        $this->assertSame('easy', $preference->difficulty_preference);
    }

    /** Past messages must never become memory on their own. */
    public function test_conversation_history_is_not_mined_for_preferences(): void
    {
        config()->set('ai.features.memory', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chat = $user->chats()->create(['title' => 'محادثة قديمة']);
        $chat->messages()->create(['role' => 'user', 'content' => 'الفصل الماضي كان صعب وأبي معدلي 95']);
        $chat->messages()->create(['role' => 'ai', 'content' => json_encode(['reply' => 'جواب'])]);

        // A question that states nothing must leave the memory empty, even though
        // the history above mentions a target.
        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أخبارك؟', 'chat_id' => $chat->id])
            ->assertOk();

        $this->assertDatabaseCount('student_ai_preferences', 0);
    }

    /** A new statement must not wipe an unrelated preference set earlier. */
    public function test_remembering_one_field_does_not_erase_the_others(): void
    {
        config()->set('ai.features.memory', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        StudentAiPreference::create([
            'user_id' => $user->id,
            'preferred_load' => 12,
            'difficulty_preference' => 'easy',
        ]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أبي معدلي يوصل 80'])
            ->assertOk();

        $preference = StudentAiPreference::where('user_id', $user->id)->firstOrFail();

        $this->assertEquals(80, $preference->gpa_target);
        $this->assertSame(12, $preference->preferred_load, 'The earlier load preference must survive.');
        $this->assertSame('easy', $preference->difficulty_preference);
    }

    public function test_saved_preferences_reach_the_prompt_with_academic_rules_still_on_top(): void
    {
        config()->set('ai.features.memory', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod(3, '2026/2027'); // summer: capped at 9 hours
        StudentAiPreference::create([
            'user_id' => $user->id,
            'active_goal' => 'raise_gpa',
            'gpa_target' => 85,
            'preferred_load' => 18,
        ]);
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();

        $this->assertStringContainsString('تفضيلات الطالب المحفوظة', $prompt);
        $this->assertStringContainsString('رفع المعدل التراكمي', $prompt);
        $this->assertStringContainsString('18 ساعة', $prompt);
        // A remembered 18-hour preference must not be allowed to beat the 9-hour cap.
        $this->assertStringContainsString('9 ساعة', $prompt);
        $this->assertStringContainsString('تسبق هذه التفضيلات', $prompt);
    }

    public function test_the_student_is_shown_what_is_stored_and_why(): void
    {
        config()->set('ai.features.memory', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        StudentAiPreference::create([
            'user_id' => $user->id,
            'active_goal' => 'graduate_faster',
            'gpa_target' => 78.5,
            'preferred_load' => 15,
            'difficulty_preference' => 'balanced',
        ]);

        $response = $this->actingAs($user)->get(route('ai.advisor'))->assertOk();

        $response->assertInertia(function ($page) {
            $page->where('aiMemory.enabled', true)->where('aiMemory.has_memory', true);

            $items = $page->toArray()['props']['aiMemory']['items'];
            $this->assertSame(
                ['active_goal', 'gpa_target', 'preferred_load', 'difficulty_preference'],
                array_column($items, 'key')
            );

            foreach ($items as $item) {
                $this->assertSame(['key', 'label', 'value', 'why'], array_keys($item));
                // Every stored item must explain why it is used.
                $this->assertNotSame('', $item['why']);
            }

            return $page;
        });
    }

    public function test_a_student_can_clear_their_own_preferences(): void
    {
        config()->set('ai.features.memory', true);

        [$user] = $this->student();
        StudentAiPreference::create(['user_id' => $user->id, 'gpa_target' => 90]);

        $this->actingAs($user)
            ->deleteJson(route('ai.advisor.memory.forget'))
            ->assertOk()
            ->assertJsonPath('status', 'cleared');

        $this->assertDatabaseCount('student_ai_preferences', 0);
    }

    /** Clearing works even after the feature has been switched off. */
    public function test_preferences_can_be_cleared_while_the_feature_is_off(): void
    {
        [$user] = $this->student();
        StudentAiPreference::create(['user_id' => $user->id, 'gpa_target' => 90]);
        config()->set('ai.features.memory', false);

        $this->actingAs($user)->deleteJson(route('ai.advisor.memory.forget'))->assertOk();

        $this->assertDatabaseCount('student_ai_preferences', 0);
    }

    public function test_one_student_cannot_clear_another_students_preferences(): void
    {
        [$user] = $this->student();
        [$other] = $this->student('other@example.com');
        StudentAiPreference::create(['user_id' => $other->id, 'gpa_target' => 90]);

        $this->actingAs($user)->deleteJson(route('ai.advisor.memory.forget'))->assertOk();

        $this->assertDatabaseHas('student_ai_preferences', ['user_id' => $other->id]);
    }

    public function test_guests_cannot_touch_the_memory_endpoint(): void
    {
        $this->deleteJson(route('ai.advisor.memory.forget'))->assertUnauthorized();
    }

    /** An applied plan is remembered so it is not proposed again. */
    public function test_an_applied_plan_is_remembered(): void
    {
        config()->set('ai.features.memory', true);
        config()->set('ai.features.actions', true);

        [$user, $major] = $this->student();
        $first = $this->course($major, ['name' => 'مادة أولى']);
        $second = $this->course($major, ['name' => 'مادة ثانية']);
        $this->currentPeriod();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'apply_semester_plan',
                'course_ids' => [$first->id, $second->id],
            ])
            ->assertOk();

        $plan = StudentAiPreference::where('user_id', $user->id)->firstOrFail()->last_approved_plan;

        $this->assertSame([$first->id, $second->id], $plan['course_ids']);
        $this->assertContains('مادة أولى', $plan['names']);
        $this->assertNotEmpty($plan['applied_at']);
    }

    /** A plain cart add is not a "plan", so it is not stored as one. */
    public function test_an_ordinary_cart_add_is_not_stored_as_a_plan(): void
    {
        config()->set('ai.features.memory', true);
        config()->set('ai.features.actions', true);

        [$user, $major] = $this->student();
        $course = $this->course($major);
        $this->currentPeriod();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'add_courses_to_cart', 'course_ids' => [$course->id]])
            ->assertOk();

        $this->assertDatabaseCount('student_ai_preferences', 0);
    }

    /** A broken memory layer must not cost the student their answer. */
    public function test_a_failing_memory_layer_degrades_to_an_ordinary_answer(): void
    {
        config()->set('ai.features.memory', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب سليم 🙂'])]);

        $this->app->bind(\App\Services\AiMemoryService::class, fn () => new class extends \App\Services\AiMemoryService {
            public function promptBlock(\App\Models\User $user): string
            {
                throw new \RuntimeException('memory exploded');
            }
        });

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أبي معدلي يوصل 85'])
            ->assertOk()
            ->assertJsonPath('reply', 'جواب سليم 🙂');
    }
}
