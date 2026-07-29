<?php

namespace Tests\Feature\Ai;

use App\Models\Chat;

/**
 * The response contract of POST /ai-advisor/chat, exactly as the frontend reads
 * it today. Nothing here may change while the advisor is being enhanced: new
 * fields are additive, existing ones keep their name, type and meaning.
 */
class AdvisorContractTest extends AdvisorTestCase
{
    /** Every key Advisor.jsx touches on a successful reply. */
    public function test_chat_returns_the_full_legacy_response_contract(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مقدمة في البرمجة']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope([
            'reply' => 'أهلاً سامر 👋 هذه خطتك.',
            'follow_up_suggestions' => ['كم ساعة مسموح لي؟'],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل هذا الفصل؟'])
            ->assertOk();

        $response->assertJsonStructure([
            'status',
            'reply',
            'suggested_courses',
            'courses_to_remove',
            'follow_up_suggestions',
            'interactive_widget',
            'refresh_cart',
            'chat_id',
            'chat_title',
            'daily_messages_remaining',
            'has_daily_limit',
            'is_fallback',
            'is_cached',
            'fallback_reason',
        ]);

        $response->assertJsonPath('status', 'success')
            ->assertJsonPath('is_fallback', false)
            ->assertJsonPath('is_cached', false)
            ->assertJsonPath('fallback_reason', null)
            ->assertJsonPath('has_daily_limit', true)
            ->assertJsonPath('follow_up_suggestions', ['كم ساعة مسموح لي؟']);

        $this->assertIsArray($response->json('suggested_courses'));
        $this->assertIsArray($response->json('courses_to_remove'));
        $this->assertStringContainsString('سامر', $response->json('reply'));
    }

    /** A new chat is created, titled from the message, and both turns are stored. */
    public function test_chat_persists_the_turn_and_titles_a_new_conversation(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كيف أرفع معدلي؟'])
            ->assertOk();

        $chat = Chat::findOrFail($response->json('chat_id'));

        $this->assertSame($user->id, $chat->user_id);
        $this->assertSame('كيف أرفع معدلي؟', $chat->title);
        $this->assertSame('كيف أرفع معدلي؟', $response->json('chat_title'));

        $messages = $chat->messages()->orderBy('id')->get();
        $this->assertCount(2, $messages);
        $this->assertSame('user', $messages[0]->role);
        $this->assertSame('كيف أرفع معدلي؟', $messages[0]->content);
        $this->assertSame('ai', $messages[1]->role);

        // The AI turn is stored as the five-key envelope the frontend parses.
        $stored = json_decode($messages[1]->content, true);
        $this->assertSame(
            ['reply', 'suggested_courses', 'courses_to_remove', 'follow_up_suggestions', 'interactive_widget'],
            array_keys($stored)
        );
    }

    /** An existing conversation is continued, and chat_title stays null. */
    public function test_chat_appends_to_an_existing_conversation(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chat = $user->chats()->create(['title' => 'محادثة قائمة']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'وبعدين؟', 'chat_id' => $chat->id])
            ->assertOk()
            ->assertJsonPath('chat_id', $chat->id)
            ->assertJsonPath('chat_title', null);

        $this->assertSame(2, $chat->messages()->count());
        $this->assertSame('محادثة قائمة', $chat->fresh()->title);
    }

    /**
     * A retry after a failed stream must not store the student's message twice.
     * This is what `user_message_stored` exists for.
     */
    public function test_user_message_stored_flag_prevents_a_duplicated_turn(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chat = $user->chats()->create(['title' => 'إعادة محاولة']);
        $chat->messages()->create(['role' => 'user', 'content' => 'سؤالي']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), [
                'message' => 'سؤالي',
                'chat_id' => $chat->id,
                'user_message_stored' => true,
            ])
            ->assertOk();

        $this->assertSame(1, $chat->messages()->where('role', 'user')->count());
        $this->assertSame(1, $chat->messages()->where('role', 'ai')->count());
    }

    /** Historical messages keep loading through the unchanged messages endpoint. */
    public function test_stored_legacy_messages_are_returned_verbatim(): void
    {
        [$user] = $this->student();
        $chat = $user->chats()->create(['title' => 'محادثة قديمة']);
        $chat->messages()->create(['role' => 'user', 'content' => 'سؤال قديم']);
        $legacy = json_encode([
            'reply' => 'جواب قديم',
            'suggested_courses' => [],
            'courses_to_remove' => [],
            'follow_up_suggestions' => [],
            'interactive_widget' => null,
        ], JSON_UNESCAPED_UNICODE);
        $chat->messages()->create(['role' => 'ai', 'content' => $legacy]);

        $response = $this->actingAs($user)
            ->getJson(route('ai.advisor.messages', ['chat_id' => $chat->id]))
            ->assertOk();

        $this->assertCount(2, $response->json());
        $this->assertSame($legacy, $response->json('1.content'));
    }

    public function test_another_students_conversation_is_not_readable(): void
    {
        [$owner] = $this->student('owner@example.com');
        [$intruder] = $this->student('intruder@example.com');
        $chat = $owner->chats()->create(['title' => 'خاص']);

        $this->actingAs($intruder)
            ->getJson(route('ai.advisor.messages', ['chat_id' => $chat->id]))
            ->assertForbidden();

        $this->actingAs($intruder)
            ->postJson(route('ai.advisor.chat'), ['message' => 'مرحبا', 'chat_id' => $chat->id])
            ->assertForbidden();
    }

    public function test_message_validation_rules_are_enforced(): void
    {
        [$user] = $this->student();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => str_repeat('ا', 2001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤال', 'difficulty' => 'impossible'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('difficulty');
    }

    public function test_guests_cannot_reach_the_advisor(): void
    {
        $this->postJson(route('ai.advisor.chat'), ['message' => 'مرحبا'])
            ->assertUnauthorized();
    }
}
