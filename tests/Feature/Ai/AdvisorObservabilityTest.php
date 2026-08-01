<?php

namespace Tests\Feature\Ai;

use App\Models\AiRequestLog;
use Tests\Support\FakeGeminiService;

/**
 * The operational log and the admin metrics built on it. It writes to its own
 * table only, and never at the cost of an answer.
 */
class AdvisorObservabilityTest extends AdvisorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.tool_registry', true);
        config()->set('ai.features.sources', true);
        config()->set('ai.features.observability', true);
    }

    public function test_a_normal_answer_is_logged_with_its_intent_tools_and_timing(): void
    {
        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع سلتي'])
            ->assertOk();

        $log = AiRequestLog::firstOrFail();

        $this->assertSame($user->id, $log->user_id);
        $this->assertSame('chat', $log->route_used);
        $this->assertSame('cart_review', $log->intent);
        $this->assertSame(['review_cart'], $log->tools_called);
        $this->assertFalse($log->fallback_used);
        $this->assertFalse($log->validation_failed);
        $this->assertNotNull($log->response_time_ms);
        $this->assertSame(config('ai.prompt_version'), $log->prompt_version);
        $this->assertNotNull($log->answer_confidence);
    }

    public function test_dropped_hallucinated_ids_are_recorded(): void
    {
        [$user, $major] = $this->student();
        $real = $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['suggested_course_ids' => [$real->id, 999998, 999999]])]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $log = AiRequestLog::firstOrFail();

        $this->assertSame(2, $log->dropped_ids);
        $this->assertTrue($log->validation_failed);
    }

    public function test_a_provider_failure_records_the_error_type_but_not_its_message(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([FakeGeminiService::FAIL]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $log = AiRequestLog::where('fallback_used', true)->firstOrFail();

        $this->assertSame('gemini_unavailable', $log->fallback_reason);
        $this->assertSame(\Exception::class, $log->provider_error_type);
        // An exception message can carry a URL with a key in it, so only the class
        // name is stored.
        foreach ($log->toArray() as $value) {
            if (is_string($value)) {
                $this->assertStringNotContainsString('key=', $value);
                $this->assertStringNotContainsString('test-key', $value);
            }
        }
    }

    public function test_a_cached_answer_is_marked_as_cached(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)->postJson(route('ai.advisor.chat'), ['message' => 'سؤال مكرر'])->assertOk();
        $this->actingAs($user)->postJson(route('ai.advisor.chat'), ['message' => 'سؤال مكرر'])->assertOk();

        $this->assertSame(1, AiRequestLog::where('was_cached', true)->count());
        $this->assertSame(2, AiRequestLog::count());
    }

    public function test_the_stream_logs_its_time_to_first_token(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب متدفق طويل بما يكفي ليصل على دفعات 🙂'])]);

        $this->actingAs($user)
            ->post(route('ai.advisor.stream'), ['message' => 'شو أسجل؟'], ['Accept' => 'text/event-stream'])
            ->streamedContent();

        $log = AiRequestLog::where('route_used', 'stream')->firstOrFail();

        $this->assertNotNull($log->time_to_first_token_ms);
        $this->assertLessThanOrEqual($log->response_time_ms, $log->time_to_first_token_ms);
    }

    public function test_a_regeneration_is_logged_under_its_own_route(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'أول']), $this->envelope(['reply' => 'ثاني'])]);

        $chatId = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤالي'])
            ->json('chat_id');

        $this->actingAs($user)
            ->postJson(route('ai.advisor.regenerate'), ['chat_id' => $chatId, 'mode' => 'shorten'])
            ->assertOk();

        $this->assertSame(1, AiRequestLog::where('route_used', 'regenerate')->count());
    }

    public function test_actions_and_feedback_reasons_are_logged(): void
    {
        config()->set('ai.features.actions', true);

        [$user, $major] = $this->student();
        $course = $this->course($major);
        $this->currentPeriod();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'add_courses_to_cart', 'course_ids' => [$course->id]])
            ->assertOk();

        $actionLog = AiRequestLog::where('route_used', 'action')->firstOrFail();
        $this->assertSame('add_courses_to_cart', $actionLog->action_name);
        $this->assertSame('success', $actionLog->action_result);

        $chat = $user->chats()->create(['title' => 'محادثة']);
        $message = $chat->messages()->create(['role' => 'ai', 'content' => 'جواب']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), [
                'message_id' => $message->id,
                'rating' => 'down',
                'reason' => 'too_long',
            ])
            ->assertOk();

        $this->assertSame('too_long', AiRequestLog::where('route_used', 'feedback')->firstOrFail()->feedback_reason);
    }

    /** A bare thumbs-down logs no reason row: there is nothing to group by. */
    public function test_feedback_without_a_reason_logs_nothing(): void
    {
        [$user] = $this->student();
        $chat = $user->chats()->create(['title' => 'محادثة']);
        $message = $chat->messages()->create(['role' => 'ai', 'content' => 'جواب']);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.feedback'), ['message_id' => $message->id, 'rating' => 'down'])
            ->assertOk();

        $this->assertSame(0, AiRequestLog::where('route_used', 'feedback')->count());
    }

    public function test_with_observability_off_nothing_is_written(): void
    {
        config()->set('ai.features.observability', false);

        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $this->assertSame(0, AiRequestLog::count());
    }

    /** The conversation tables must not gain operational columns. */
    public function test_the_conversation_tables_are_untouched(): void
    {
        foreach (['intent', 'tools_called', 'response_time_ms', 'fallback_used'] as $column) {
            $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('messages', $column));
            $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('chats', $column));
        }
    }

    /** A logging failure must never cost the student their answer. */
    public function test_a_logging_failure_does_not_break_the_reply(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب سليم 🙂'])]);

        $this->app->bind(\App\Services\AiRequestLogger::class, fn () => new class extends \App\Services\AiRequestLogger {
            public function logRequest(?\App\Models\User $user, string $route, array $context = []): void
            {
                throw new \RuntimeException('logger exploded');
            }
        });

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('reply', 'جواب سليم 🙂');
    }

    /* ── admin metrics ──────────────────────────────────────────────────── */

    /** Blocked for students by the admin middleware before the controller runs. */
    public function test_the_metrics_endpoint_is_admin_only(): void
    {
        [$student] = $this->student();

        $this->actingAs($student)->getJson(route('admin.reports.ai_quality'))->assertRedirect();
        $this->getJson(route('admin.reports.ai_quality'))->assertRedirect();
    }

    public function test_the_metrics_endpoint_aggregates_the_log(): void
    {
        [$admin, $major] = $this->student('admin@example.com', ['role' => 'admin']);
        $this->addToCart($admin, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chatResponse = $this->actingAs($admin->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع سلتي'])
            ->assertOk();

        AiRequestLog::create([
            'user_id' => $admin->id,
            'route_used' => 'chat',
            'intent' => 'gpa_goal',
            'fallback_used' => true,
            'fallback_reason' => 'gemini_unavailable',
            'response_time_ms' => 900,
        ]);

        $response = $this->actingAs($admin)
            ->getJson(route('admin.reports.ai_quality'))
            ->assertOk();

        $this->assertTrue($response->json('available'));
        $this->assertSame(2, $response->json('total_answers'));
        $this->assertEquals(50, $response->json('fallback_rate'));
        $this->assertContains('cart_review', array_column($response->json('top_intents'), 'intent'));
        $this->assertContains('review_cart', array_column($response->json('tools_used'), 'tool'));
        $this->assertGreaterThan(0, $response->json('avg_response_ms'));

        $cartReview = collect($response->json('top_intents'))->firstWhere('intent', 'cart_review');
        $this->assertNotNull($cartReview);
        $this->assertNotEmpty($cartReview['chats']);
        $this->assertSame($chatResponse->json('chat_id'), $cartReview['chats'][0]['chat_id']);
        $this->assertSame($admin->id, $cartReview['chats'][0]['student']['id']);
        $this->assertSame($admin->name, $cartReview['chats'][0]['student']['name']);
    }

    public function test_the_metrics_endpoint_handles_an_empty_log(): void
    {
        [$admin] = $this->student('admin@example.com', ['role' => 'admin']);

        $response = $this->actingAs($admin)
            ->getJson(route('admin.reports.ai_quality'))
            ->assertOk();

        $this->assertTrue($response->json('available'));
        $this->assertSame(0, $response->json('total_answers'));
        $this->assertEquals(0, $response->json('fallback_rate'));
        $this->assertSame([], $response->json('tools_used'));
    }

    public function test_deleting_a_chat_removes_it_from_the_database_and_cached_metrics(): void
    {
        [$admin, $major] = $this->student('admin@example.com', ['role' => 'admin']);
        $this->addToCart($admin, $this->course($major, ['credit_hours' => 3]));
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chatId = $this->actingAs($admin->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع تسجيلي'])
            ->assertOk()
            ->json('chat_id');

        $this->actingAs($admin)
            ->getJson(route('admin.reports.ai_quality'))
            ->assertOk()
            ->assertJsonPath('total_answers', 1);

        $this->actingAs($admin)
            ->deleteJson(route('ai.advisor.delete', ['chat_id' => $chatId]))
            ->assertOk();

        $this->assertDatabaseMissing('chats', ['id' => $chatId]);
        $this->assertDatabaseMissing('messages', ['chat_id' => $chatId]);
        $this->assertDatabaseMissing('ai_request_logs', ['chat_id' => $chatId]);

        $this->actingAs($admin)
            ->getJson(route('admin.reports.ai_quality'))
            ->assertOk()
            ->assertJsonPath('total_answers', 0)
            ->assertJsonPath('top_intents', []);
    }
}
