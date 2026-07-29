<?php

namespace Tests\Feature\Ai;

use Tests\Support\FakeGeminiService;

/**
 * The optional progress events on the streaming path. They are additive: the
 * open/delta/done sequence the current frontend relies on is unchanged, and with
 * the flag off none of the new events are emitted at all.
 */
class AdvisorStreamEventsTest extends AdvisorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.tool_registry', true);
    }

    public function test_with_the_flag_off_only_the_original_events_are_emitted(): void
    {
        config()->set('ai.features.stream_events', false);

        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $body = $this->actingAs($user->fresh())
            ->post(route('ai.advisor.stream'), ['message' => 'راجع سلتي'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $this->assertSame(['open', 'delta', 'done'], array_values(array_unique($this->eventNames($body))));
    }

    public function test_with_the_flag_on_progress_events_describe_the_pipeline(): void
    {
        config()->set('ai.features.stream_events', true);

        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $body = $this->actingAs($user->fresh())
            ->post(route('ai.advisor.stream'), ['message' => 'راجع سلتي'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $events = $this->eventNames($body);

        foreach (['open', 'retrieving_context', 'intent_detected', 'tool_started', 'tool_completed', 'validating', 'response_started', 'delta', 'done'] as $expected) {
            $this->assertContains($expected, $events, "missing event: {$expected}");
        }

        // Order is the point of a progress trace.
        $this->assertLessThan(
            array_search('response_started', $events, true),
            array_search('intent_detected', $events, true)
        );
        $this->assertLessThan(
            array_search('delta', $events, true),
            array_search('response_started', $events, true)
        );
        $this->assertLessThan(
            array_search('done', $events, true),
            array_search('validating', $events, true)
        );
    }

    public function test_the_intent_event_carries_the_intent_and_its_confidence(): void
    {
        config()->set('ai.features.stream_events', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $body = $this->actingAs($user)
            ->post(route('ai.advisor.stream'), ['message' => 'كيف أرفع معدلي لأوصل 80؟'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $payload = $this->firstPayload($body, 'intent_detected');

        $this->assertSame('gpa_goal', $payload['intent']);
        $this->assertGreaterThan(0.5, $payload['confidence']);
    }

    public function test_a_failed_stream_announces_the_fallback(): void
    {
        config()->set('ai.features.stream_events', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([FakeGeminiService::FAIL]);

        $body = $this->actingAs($user)
            ->post(route('ai.advisor.stream'), ['message' => 'شو أسجل؟'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $events = $this->eventNames($body);
        $this->assertContains('fallback', $events);
        $this->assertContains('error', $events);
        $this->assertNotContains('done', $events);
        $this->assertSame('stream_failed', $this->firstPayload($body, 'fallback')['reason']);
    }

    /** The blocking endpoint is unaffected by the flag. */
    public function test_the_blocking_endpoint_is_untouched_by_stream_events(): void
    {
        config()->set('ai.features.stream_events', true);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب عادي 🙂'])]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('reply', 'جواب عادي 🙂');
    }

    /** @return list<string> event names in the order they were emitted */
    private function eventNames(string $body): array
    {
        preg_match_all('/^event: (\S+)$/m', $body, $matches);

        return $matches[1];
    }

    private function firstPayload(string $body, string $event): array
    {
        foreach (preg_split("/\n\n/", $body) as $frame) {
            if (!str_contains($frame, "event: {$event}\n")) {
                continue;
            }
            foreach (explode("\n", $frame) as $line) {
                if (str_starts_with($line, 'data: ')) {
                    return json_decode(substr($line, 6), true) ?? [];
                }
            }
        }

        $this->fail("No `{$event}` frame was emitted.");
    }
}
