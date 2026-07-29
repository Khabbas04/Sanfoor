<?php

namespace Tests\Feature\Ai;

use Illuminate\Support\Facades\Cache;
use Tests\Support\FakeGeminiService;

/**
 * Daily limit, hourly throttle, cache and fallback accounting.
 *
 * Two behaviours pinned here are questionable and flagged in the test names:
 * a cached answer and a fallback answer both still consume one of the student's
 * five daily messages. They are pinned, not fixed, so the enhancement work can
 * show it changed nothing by accident.
 */
class AdvisorLimitsTest extends AdvisorTestCase
{
    public function test_daily_limit_is_five_messages_then_the_advisor_refuses(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        foreach ([4, 3, 2, 1, 0] as $expectedRemaining) {
            $this->actingAs($user)
                ->postJson(route('ai.advisor.chat'), ['message' => 'سؤال رقم ' . $expectedRemaining])
                ->assertOk()
                ->assertJsonPath('daily_messages_remaining', $expectedRemaining)
                ->assertJsonPath('has_daily_limit', true);
        }

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤال سادس'])
            ->assertStatus(429)
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('daily_messages_remaining', 0)
            ->assertJsonPath('has_daily_limit', true);
    }

    public function test_admins_have_no_daily_limit(): void
    {
        [$admin, $major] = $this->student('admin@example.com', ['role' => 'admin']);
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($admin)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤال إداري'])
            ->assertOk()
            ->assertJsonPath('has_daily_limit', false)
            ->assertJsonPath('daily_messages_remaining', null);

        $this->assertNull(Cache::get($this->dailyUsageKey($admin)));
    }

    /** The hourly throttle answers with status=success and a wait message. */
    public function test_hourly_rate_limit_returns_a_soft_wait_message(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        Cache::put("ai_rate_limit_{$user->id}", 40, now()->addHour());

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤال'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('interactive_widget', null);

        $this->assertStringContainsString('الأقصى', $response->json('reply'));
        // No generation happened, so nothing is charged against the daily limit.
        $this->assertNull(Cache::get($this->dailyUsageKey($user)));
        $this->assertSame(0, $user->chats()->count());
    }

    /**
     * FIXED: an identical question served from the response cache costs no cloud
     * call, so it no longer consumes one of the student's five daily messages.
     */
    public function test_a_cached_answer_is_flagged_and_costs_no_daily_message(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope(['reply' => 'جواب مخزّن 🙂'])]);

        $first = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'نفس السؤال بالحرف'])
            ->assertOk()
            ->assertJsonPath('is_cached', false);

        $second = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'نفس السؤال بالحرف'])
            ->assertOk()
            ->assertJsonPath('is_cached', true)
            ->assertJsonPath('is_fallback', false);

        $this->assertSame($first->json('reply'), $second->json('reply'));
        $this->assertCount(1, $fake->calls, 'A cached answer must not call the model again.');
        $this->assertSame(4, $second->json('daily_messages_remaining'), 'No generation, no charge.');
    }

    /**
     * FIXED: the local fallback is a degraded answer the student did not ask for,
     * so it no longer costs them a daily message.
     */
    public function test_the_local_fallback_costs_no_daily_message(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        // No fakeGemini() call: config has no keys, so getApiKeys() is empty.

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة مسموح لي؟'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('is_fallback', true)
            ->assertJsonPath('fallback_reason', 'local_fallback')
            ->assertJsonPath('daily_messages_remaining', 5);

        $this->assertNotEmpty($response->json('reply'));
        $this->assertStringNotContainsStringIgnoringCase('gemini', $response->json('reply'));
        $this->assertNull(Cache::get($this->dailyUsageKey($user)));
    }

    /** A provider failure falls back locally and never leaks the provider name. */
    public function test_provider_failure_falls_back_locally_without_leaking_the_provider(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $this->fakeGemini([FakeGeminiService::FAIL]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('is_fallback', true)
            ->assertJsonPath('fallback_reason', 'gemini_unavailable');

        // The provider failed, so this degraded answer costs nothing either, and
        // the student is told they may retry.
        $this->assertSame(5, $response->json('daily_messages_remaining'));
        $this->assertTrue($response->json('can_retry'));

        $reply = $response->json('reply');
        $this->assertStringContainsString('مستشار سنفور البديل', $reply);
        $this->assertStringNotContainsStringIgnoringCase('gemini', $reply);
        $this->assertStringNotContainsStringIgnoringCase('exception', $reply);
        $this->assertStringNotContainsStringIgnoringCase('api', $reply);

        // The turn is still stored so the conversation stays coherent.
        $this->assertSame(1, $user->chats()->first()->messages()->where('role', 'ai')->count());
    }

    public function test_index_page_reports_the_remaining_daily_messages(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        Cache::put($this->dailyUsageKey($user), 2, now()->endOfDay());

        $this->actingAs($user)
            ->get(route('ai.advisor'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Ai/Advisor')
                ->where('dailyMessagesRemaining', 3)
                ->where('hasDailyLimit', true)
                ->has('studentStats')
                ->has('chats')
                ->has('initialCartIds'));
    }
}
