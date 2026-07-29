<?php

namespace Tests\Feature\Ai;

use Illuminate\Support\Facades\DB;

/**
 * Anti-hallucination guarantees. These are the highest-stakes behaviours in the
 * advisor: a course id invented by the model must never reach the student's cart,
 * their suggestion list, or another major's plan.
 */
class AdvisorValidationTest extends AdvisorTestCase
{
    public function test_an_invented_suggested_course_id_is_dropped(): void
    {
        [$user, $major] = $this->student();
        $real = $this->course($major, ['name' => 'مادة حقيقية']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope([
            'reply' => 'أنصحك بهذه المواد 🙂',
            'suggested_course_ids' => [$real->id, 999999],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $ids = array_column($response->json('suggested_courses'), 'id');
        $this->assertSame([$real->id], $ids);
    }

    public function test_an_invented_course_id_is_never_written_to_the_cart(): void
    {
        [$user, $major] = $this->student();
        $real = $this->course($major, ['name' => 'مادة حقيقية']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope([
            'reply' => 'تمت إضافتها بنجاح ✅',
            'courses_to_add' => [$real->id, 999999],
        ])]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أضف لي مادة حقيقية'])
            ->assertOk()
            ->assertJsonPath('refresh_cart', true);

        $cart = DB::table('user_carts')->where('user_id', $user->id)->pluck('course_id')->all();
        $this->assertSame([$real->id], $cart);
    }

    /** A course whose prerequisite is unmet must not be addable, whatever the model says. */
    public function test_an_ineligible_course_is_never_written_to_the_cart(): void
    {
        [$user, $major] = $this->student();
        $prerequisite = $this->course($major, ['name' => 'البرمجة الأولى']);
        $locked = $this->course($major, ['name' => 'البرمجة المتقدمة', 'semester' => 2]);
        $locked->prerequisites()->attach($prerequisite->id);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope([
            'reply' => 'أضفتها لك ✅',
            'courses_to_add' => [$locked->id],
        ])]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أضف البرمجة المتقدمة'])
            ->assertOk()
            ->assertJsonPath('refresh_cart', false);

        $this->assertDatabaseMissing('user_carts', ['user_id' => $user->id, 'course_id' => $locked->id]);
    }

    /** Over the term hour limit: the add is refused and the student is warned. */
    public function test_an_add_that_would_break_the_hour_limit_is_refused_with_a_warning(): void
    {
        [$user, $major] = $this->student();
        $this->currentPeriod();

        // Fill the cart to 18 hours (the normal-term limit).
        foreach (range(1, 6) as $index) {
            $this->addToCart($user, $this->course($major, ['name' => "مادة سلة {$index}", 'credit_hours' => 3]));
        }
        $extra = $this->course($major, ['name' => 'مادة إضافية']);

        $this->fakeGemini([$this->envelope([
            'reply' => 'تمت إضافتها بنجاح ✅',
            'courses_to_add' => [$extra->id],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أضف مادة إضافية'])
            ->assertOk()
            ->assertJsonPath('refresh_cart', false);

        $this->assertDatabaseMissing('user_carts', ['user_id' => $user->id, 'course_id' => $extra->id]);
        $this->assertStringContainsString('الحد المسموح', $response->json('reply'));
    }

    /** A remove suggestion for a course that is not in the cart is dropped. */
    public function test_a_remove_suggestion_outside_the_cart_is_dropped(): void
    {
        [$user, $major] = $this->student();
        $inCart = $this->course($major, ['name' => 'مادة في السلة']);
        $notInCart = $this->course($major, ['name' => 'مادة خارج السلة']);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'أنصحك بحذف هذه المواد.',
            'remove_course_ids' => [$inCart->id, $notInCart->id, 999999],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أحذف من سلتي؟'])
            ->assertOk();

        $ids = array_column($response->json('courses_to_remove'), 'id');
        $this->assertSame([$inCart->id], $ids);
    }

    /**
     * FIXED: the removal list is read from `remove_course_ids` (the name the
     * responseSchema enforces), but the prompt used to document the field as
     * `courses_to_remove` — a name the model is not allowed to emit. The prompt
     * now names the right field and the parser accepts the legacy alias too, so a
     * salvaged or non-schema envelope no longer loses its removal suggestion.
     */
    public function test_the_legacy_courses_to_remove_key_is_still_accepted(): void
    {
        [$user, $major] = $this->student();
        $inCart = $this->course($major, ['name' => 'مادة في السلة']);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'أنصحك بحذف مواد من سلتك.',
            'courses_to_remove' => [$inCart->id],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أحذف من سلتي؟'])
            ->assertOk();

        $this->assertSame([$inCart->id], array_column($response->json('courses_to_remove'), 'id'));
    }

    /** A course the student already passed is never offered again. */
    public function test_a_passed_course_is_never_suggested(): void
    {
        [$user, $major] = $this->student();
        $passed = $this->course($major, ['name' => 'مادة مجتازة']);
        $this->course($major, ['name' => 'مادة جديدة']);
        $this->pass($user, $passed, 85);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'إليك اقتراحي.',
            'suggested_course_ids' => [$passed->id],
            'courses_to_add' => [$passed->id],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $this->assertSame([], $response->json('suggested_courses'));
        $this->assertDatabaseMissing('user_carts', ['user_id' => $user->id, 'course_id' => $passed->id]);
    }

    /** Major and study-plan isolation: another plan's courses never enter the context. */
    public function test_courses_of_another_major_or_plan_version_are_isolated(): void
    {
        [$user, $major] = $this->student();
        [, $otherMajor] = $this->student('other@example.com');
        $own = $this->course($major, ['name' => 'مادة تخصصي']);
        $foreign = $this->course($otherMajor, ['name' => 'مادة تخصص آخر']);
        $oldPlan = $this->course($major, ['name' => 'مادة خطة قديمة', 'study_plan_version' => 11]);
        $this->currentPeriod();

        $fake = $this->fakeGemini([$this->envelope([
            'suggested_course_ids' => [$own->id, $foreign->id, $oldPlan->id],
            'courses_to_add' => [$foreign->id, $oldPlan->id],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو المواد المتاحة؟'])
            ->assertOk();

        $this->assertSame([$own->id], array_column($response->json('suggested_courses'), 'id'));
        $this->assertSame(0, DB::table('user_carts')->where('user_id', $user->id)->count());

        // They never even reach the prompt.
        $prompt = $fake->lastSystemInstruction();
        $this->assertStringContainsString('مادة تخصصي', $prompt);
        $this->assertStringNotContainsString('مادة تخصص آخر', $prompt);
        $this->assertStringNotContainsString('مادة خطة قديمة', $prompt);
    }

    /** A reply that claims an addition which did not happen is corrected. */
    public function test_a_false_addition_claim_is_corrected_for_the_student(): void
    {
        [$user, $major] = $this->student();
        $inCart = $this->course($major, ['name' => 'تحليل عددي']);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'تمت إضافتها بنجاح ✅',
            'courses_to_add' => [],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أضف تحليل عددي'])
            ->assertOk();

        $reply = $response->json('reply');
        $this->assertStringContainsString('للتوضيح', $reply);
        $this->assertStringContainsString('تحليل عددي', $reply);
    }

    /**
     * FIXED: claimsAdded() matched "تمت إضافتها" but not "تمت إضافة <اسم المادة>",
     * which is the phrasing the model actually prefers — so the most common false
     * claim went uncorrected. The phrase list now covers it.
     */
    public function test_a_false_addition_claim_naming_the_course_is_also_corrected(): void
    {
        [$user, $major] = $this->student();
        $inCart = $this->course($major, ['name' => 'تحليل عددي']);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'تمت إضافة تحليل عددي بنجاح ✅',
            'courses_to_add' => [],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أضف تحليل عددي'])
            ->assertOk();

        $this->assertStringContainsString('للتوضيح', $response->json('reply'));
    }

    /** The hour limit shown to the model follows the academic rules engine. */
    public function test_the_summer_hour_limit_reaches_the_prompt(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod(3, '2026/2027');
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة أسجل بالصيفي؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $this->assertStringContainsString('9 ساعة', $prompt);
        $this->assertStringContainsString('صيفي', $prompt);
    }

    /** A probation student is capped at 12 hours and the model is told so. */
    public function test_probation_lowers_the_limit_in_the_prompt(): void
    {
        [$user, $major] = $this->student();
        $failed = $this->course($major, ['name' => 'مادة بمعدل منخفض', 'credit_hours' => 3]);
        $this->pass($user, $failed, 55); // >= 50 counts as passed, < 60 is probation
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة مسموح لي؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $this->assertStringContainsString('12 ساعة', $prompt);
        $this->assertStringContainsString('إنذار', $prompt);
    }
}
