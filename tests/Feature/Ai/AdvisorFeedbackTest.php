<?php

namespace Tests\Feature\Ai;

use App\Models\AiRequestLog;
use App\Models\Message;
use Illuminate\Support\Facades\DB;

/**
 * Feedback, regeneration and conversation deletion — the endpoints the message
 * action bar calls. Their request shape must keep working unchanged while the
 * optional reason/mode parameters are added on top.
 */
class AdvisorFeedbackTest extends AdvisorTestCase
{
    public function test_feedback_is_stored_and_updated_in_place(): void
    {
        [$user] = $this->student();
        $chat = $user->chats()->create(['title' => 'محادثة']);
        $message = $chat->messages()->create(['role' => 'ai', 'content' => 'جواب']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), ['message_id' => $message->id, 'rating' => 'up'])
            ->assertOk()
            ->assertJsonPath('status', 'saved');

        $this->assertDatabaseHas('ai_feedbacks', [
            'message_id' => $message->id,
            'user_id' => $user->id,
            'rating' => 'up',
        ]);

        // A second vote updates the same row rather than adding another.
        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), [
                'message_id' => $message->id,
                'rating' => 'down',
                'comment' => 'الجواب ما كان دقيقاً',
            ])
            ->assertOk();

        $this->assertSame(1, DB::table('ai_feedbacks')->where('message_id', $message->id)->count());
        $this->assertDatabaseHas('ai_feedbacks', [
            'message_id' => $message->id,
            'rating' => 'down',
            'comment' => 'الجواب ما كان دقيقاً',
        ]);
    }

    public function test_feedback_validates_its_input_and_ownership(): void
    {
        [$user] = $this->student();
        [$other] = $this->student('other@example.com');
        $chat = $other->chats()->create(['title' => 'محادثة غيري']);
        $foreign = $chat->messages()->create(['role' => 'ai', 'content' => 'جواب']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), ['message_id' => $foreign->id, 'rating' => 'up'])
            ->assertForbidden();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), ['message_id' => $foreign->id, 'rating' => 'maybe'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('rating');

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), ['message_id' => 999999, 'rating' => 'up'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message_id');
    }

    /** Regeneration replaces the last exchange rather than appending to it. */
    public function test_regenerate_replaces_the_last_exchange(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'الجواب الأول'])]);

        $chatId = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤالي الأصلي'])
            ->assertOk()
            ->json('chat_id');

        $this->actingAs($user)
            ->postJson(route('ai.advisor.regenerate'), ['chat_id' => $chatId])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        // Still exactly one exchange, and the question is preserved verbatim.
        $messages = Message::where('chat_id', $chatId)->orderBy('id')->get();
        $this->assertCount(2, $messages);
        $this->assertSame('سؤالي الأصلي', $messages[0]->content);
        $this->assertSame('ai', $messages[1]->role);
    }

    /**
     * FIXED: regenerate() used to route through chat() with the same message and
     * the same context, hit the two-hour response cache, and hand the student back
     * the SAME reply while charging them a daily message — the model was never
     * asked again. It now bypasses that cache and produces a real second answer.
     */
    public function test_regenerate_asks_the_model_again_instead_of_replaying_the_cache(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $fake = $this->fakeGemini([
            $this->envelope(['reply' => 'الجواب الأول']),
            $this->envelope(['reply' => 'الجواب الثاني']),
        ]);

        $first = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤالي الأصلي'])
            ->assertOk()
            ->assertJsonPath('daily_messages_remaining', 4);

        $second = $this->actingAs($user)
            ->postJson(route('ai.advisor.regenerate'), ['chat_id' => $first->json('chat_id')])
            ->assertOk();

        $this->assertSame('الجواب الثاني', $second->json('reply'));
        $this->assertFalse($second->json('is_cached'));
        $this->assertCount(2, $fake->calls, 'The model must be asked a second time.');
    }

    /** Each regeneration mode reaches the model as a distinct instruction. */
    public function test_regeneration_modes_change_the_instruction_sent_to_the_model(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $expectations = [
            'shorten' => 'مختصراً جداً',
            'explain_more' => 'تفصيلاً أعمق',
            'alternative' => 'خياراً مختلفاً',
            'refresh_data' => 'تم تحديث بيانات الطالب',
        ];

        foreach ($expectations as $mode => $needle) {
            // Four question/regeneration pairs would exhaust the five-a-day budget;
            // the budget itself is covered by AdvisorLimitsTest.
            \Illuminate\Support\Facades\Cache::forget($this->dailyUsageKey($user));
            $fake = $this->fakeGemini([$this->envelope(['reply' => "جواب {$mode}"])]);

            $chatId = $this->actingAs($user)
                ->postJson(route('ai.advisor.chat'), ['message' => "سؤال عن {$mode}"])
                ->assertOk()
                ->json('chat_id');

            $this->actingAs($user)
                ->postJson(route('ai.advisor.regenerate'), ['chat_id' => $chatId, 'mode' => $mode])
                ->assertOk();

            $this->assertStringContainsString($needle, $fake->lastSystemInstruction(), "mode: {$mode}");
        }
    }

    public function test_an_unknown_regeneration_mode_is_rejected(): void
    {
        [$user] = $this->student();
        $chat = $user->chats()->create(['title' => 'محادثة']);
        $chat->messages()->create(['role' => 'user', 'content' => 'سؤال']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.regenerate'), ['chat_id' => $chat->id, 'mode' => 'make_it_rhyme'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('mode');
    }

    /* ── feedback reasons ───────────────────────────────────────────────── */

    public function test_a_feedback_reason_is_stored_when_given(): void
    {
        [$user] = $this->student();
        $chat = $user->chats()->create(['title' => 'محادثة']);
        $message = $chat->messages()->create(['role' => 'ai', 'content' => 'جواب']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), [
                'message_id' => $message->id,
                'rating' => 'down',
                'reason' => 'incorrect_information',
            ])
            ->assertOk();

        $this->assertDatabaseHas('ai_feedbacks', [
            'message_id' => $message->id,
            'rating' => 'down',
            'reason' => 'incorrect_information',
        ]);
    }

    public function test_an_unknown_feedback_reason_is_rejected(): void
    {
        [$user] = $this->student();
        $chat = $user->chats()->create(['title' => 'محادثة']);
        $message = $chat->messages()->create(['role' => 'ai', 'content' => 'جواب']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), [
                'message_id' => $message->id,
                'rating' => 'down',
                'reason' => 'i_just_do_not_like_it',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');
    }

    public function test_regenerate_rejects_another_students_conversation(): void
    {
        [$user] = $this->student();
        [$other] = $this->student('other@example.com');
        $chat = $other->chats()->create(['title' => 'محادثة غيري']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.regenerate'), ['chat_id' => $chat->id])
            ->assertForbidden();
    }

    public function test_regenerate_without_a_question_reports_an_error(): void
    {
        [$user] = $this->student();
        $chat = $user->chats()->create(['title' => 'فارغة']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.regenerate'), ['chat_id' => $chat->id])
            ->assertStatus(400)
            ->assertJsonPath('status', 'error');
    }

    public function test_a_student_can_delete_one_conversation_or_all_of_them(): void
    {
        [$user] = $this->student();
        [$other] = $this->student('other@example.com');

        $first = $user->chats()->create(['title' => 'أولى']);
        $first->messages()->create(['role' => 'user', 'content' => 'سؤال']);
        $second = $user->chats()->create(['title' => 'ثانية']);
        $second->messages()->create(['role' => 'user', 'content' => 'سؤال']);
        $foreign = $other->chats()->create(['title' => 'محادثة غيري']);
        $foreign->messages()->create(['role' => 'user', 'content' => 'سؤال']);

        foreach ([$first, $second, $foreign] as $chat) {
            AiRequestLog::create([
                'user_id' => $chat->user_id,
                'chat_id' => $chat->id,
                'route_used' => 'chat',
                'intent' => 'semester_planning',
            ]);
        }

        $this->actingAs($user)
            ->deleteJson(route('ai.advisor.delete', ['chat_id' => $foreign->id]))
            ->assertForbidden();

        $this->actingAs($user)
            ->deleteJson(route('ai.advisor.delete', ['chat_id' => $first->id]))
            ->assertOk()
            ->assertJsonPath('status', 'deleted');

        $this->assertDatabaseMissing('chats', ['id' => $first->id]);
        $this->assertSame(0, Message::where('chat_id', $first->id)->count());
        $this->assertDatabaseMissing('ai_request_logs', ['chat_id' => $first->id]);
        $this->assertDatabaseHas('ai_request_logs', ['chat_id' => $second->id]);

        $this->actingAs($user)
            ->deleteJson(route('ai.advisor.delete.all'))
            ->assertOk()
            ->assertJsonPath('status', 'all_deleted');

        $this->assertSame(0, $user->chats()->count());
        $this->assertDatabaseMissing('ai_request_logs', ['chat_id' => $second->id]);
        // Another student's history is untouched.
        $this->assertDatabaseHas('chats', ['id' => $foreign->id]);
        $this->assertSame(1, Message::where('chat_id', $foreign->id)->count());
        $this->assertDatabaseHas('ai_request_logs', ['chat_id' => $foreign->id]);
    }
}
