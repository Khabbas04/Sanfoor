<?php

namespace Tests\Feature\Ai;

use App\Models\Chat;
use App\Models\Message;
use Illuminate\Support\Facades\Cache;
use Tests\Support\FakeGeminiService;

/**
 * The SSE transport of POST /ai-advisor/stream.
 *
 * The invariants that matter most: never persist a partial reply as a finished
 * one, never duplicate the student's turn when the frontend retries against the
 * blocking endpoint, and never open a stream when there is nothing to stream.
 */
class AdvisorStreamTest extends AdvisorTestCase
{
    public function test_stream_emits_open_then_deltas_then_done(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope([
            'reply' => 'أهلاً سامر 👋 هذا جوابي المتدفق على سؤالك عن الخطة الدراسية.',
            'follow_up_suggestions' => ['كم ساعة أسجل؟'],
        ])]);

        $response = $this->actingAs($user)
            ->post(route('ai.advisor.stream'), ['message' => 'شو أسجل؟'], ['Accept' => 'text/event-stream']);

        $response->assertOk();
        $this->assertStringContainsString('text/event-stream', $response->headers->get('Content-Type'));
        $this->assertSame('no', $response->headers->get('X-Accel-Buffering'));

        $body = $response->streamedContent();

        $this->assertStringContainsString('event: open', $body);
        $this->assertStringContainsString('event: delta', $body);
        $this->assertStringContainsString('event: done', $body);
        $this->assertLessThan(
            strpos($body, 'event: done'),
            strpos($body, 'event: delta'),
            'Deltas must arrive before the terminal frame.'
        );

        // The done frame carries the complete legacy payload.
        $done = $this->frame($body, 'done');
        $this->assertSame('success', $done['status']);
        $this->assertStringContainsString('سامر', $done['reply']);
        $this->assertSame(['كم ساعة أسجل؟'], $done['follow_up_suggestions']);
        $this->assertArrayHasKey('interactive_widget', $done);
        $this->assertArrayHasKey('refresh_cart', $done);
        $this->assertFalse($done['is_fallback']);
        $this->assertSame(4, $done['daily_messages_remaining']);

        // Exactly one stored AI turn, holding the finished reply.
        $chat = Chat::findOrFail($done['chat_id']);
        $this->assertSame(1, $chat->messages()->where('role', 'ai')->count());
        $stored = json_decode($chat->messages()->where('role', 'ai')->first()->content, true);
        $this->assertSame($done['reply'], $stored['reply']);
    }

    /** The reply text arrives progressively, not in one final lump. */
    public function test_reply_text_is_pushed_while_it_is_still_being_written(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope([
            'reply' => 'مقدمة طويلة بما يكفي لتصل على أكثر من دفعة واحدة من دفعات الشبكة 🙂 وتستمر هنا.',
        ])]);

        $body = $this->actingAs($user)
            ->post(route('ai.advisor.stream'), ['message' => 'اشرح لي'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $deltas = $this->frames($body, 'delta');
        $this->assertGreaterThan(1, count($deltas), 'The reply should be delivered in several deltas.');

        $streamed = implode('', array_column($deltas, 'text'));
        $this->assertStringContainsString('مقدمة طويلة', $streamed);
        // No JSON envelope leaks into what the student sees.
        $this->assertStringNotContainsString('"reply"', $streamed);
        $this->assertStringNotContainsString('follow_up_suggestions', $streamed);
    }

    public function test_stream_is_refused_without_api_keys_and_persists_nothing(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.stream'), ['message' => 'سؤال'])
            ->assertStatus(503)
            ->assertJsonPath('reason', 'stream_unavailable');

        $this->assertSame(0, Chat::count());
        $this->assertSame(0, Message::count());
        $this->assertNull(Cache::get($this->dailyUsageKey($user)));
    }

    /** A cached answer has nothing to stream: 409 and no turn is created. */
    public function test_stream_defers_to_the_blocking_endpoint_for_a_cached_answer(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤال مكرر'])
            ->assertOk();

        $messagesBefore = Message::count();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.stream'), ['message' => 'سؤال مكرر'])
            ->assertStatus(409)
            ->assertJsonPath('reason', 'cached');

        $this->assertSame($messagesBefore, Message::count());
    }

    public function test_stream_respects_the_daily_limit(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);
        Cache::put($this->dailyUsageKey($user), 5, now()->endOfDay());

        $this->actingAs($user)
            ->postJson(route('ai.advisor.stream'), ['message' => 'سؤال'])
            ->assertStatus(429)
            ->assertJsonPath('daily_messages_remaining', 0);

        $this->assertSame(0, Message::count());
    }

    /**
     * A generation failure must leave the student's message stored (so the retry
     * can pass user_message_stored) but must NOT store a partial AI answer.
     */
    public function test_a_failed_stream_stores_the_question_but_never_a_partial_answer(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([FakeGeminiService::FAIL]);

        $body = $this->actingAs($user)
            ->post(route('ai.advisor.stream'), ['message' => 'سؤال يفشل'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $this->assertStringContainsString('event: error', $body);
        $this->assertStringNotContainsString('event: done', $body);

        $error = $this->frame($body, 'error');
        $this->assertSame('stream_failed', $error['reason']);

        $chat = Chat::findOrFail($error['chat_id']);
        $this->assertSame(1, $chat->messages()->where('role', 'user')->count());
        $this->assertSame(0, $chat->messages()->where('role', 'ai')->count());
        // Nothing was generated, so no daily message is charged.
        $this->assertNull(Cache::get($this->dailyUsageKey($user)));
    }

    /** @return array<string, mixed> The decoded payload of the first frame of $event. */
    private function frame(string $body, string $event): array
    {
        $frames = $this->frames($body, $event);
        $this->assertNotEmpty($frames, "No `{$event}` frame was emitted.");

        return $frames[0];
    }

    /** @return list<array<string, mixed>> Every decoded payload for $event. */
    private function frames(string $body, string $event): array
    {
        $payloads = [];

        foreach (preg_split("/\n\n/", $body) as $raw) {
            if (!str_contains($raw, "event: {$event}\n")) {
                continue;
            }
            foreach (explode("\n", $raw) as $line) {
                if (str_starts_with($line, 'data: ')) {
                    $decoded = json_decode(substr($line, 6), true);
                    if (is_array($decoded)) {
                        $payloads[] = $decoded;
                    }
                }
            }
        }

        return $payloads;
    }
}
