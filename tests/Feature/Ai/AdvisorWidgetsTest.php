<?php

namespace Tests\Feature\Ai;

/**
 * The six interactive widgets the advisor ships today, as they arrive at the
 * frontend: `interactive_widget` is a single object, never a list, and the
 * sanitiser keeps only fields the chosen type actually uses.
 */
class AdvisorWidgetsTest extends AdvisorTestCase
{
    public function test_comparison_widget_survives_sanitising_and_gets_course_ids_by_name(): void
    {
        [$user, $major] = $this->student();
        $first = $this->course($major, ['name' => 'هياكل البيانات', 'credit_hours' => 3]);
        $second = $this->course($major, ['name' => 'قواعد البيانات', 'credit_hours' => 3]);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'إليك المقارنة 📊',
            'interactive_widget' => [
                'type' => 'comparison',
                'title' => 'أيهم أنسب لك؟',
                'items' => [
                    ['name' => 'هياكل البيانات', 'code' => '101', 'credit_hours' => 3, 'difficulty' => 4, 'unlocks' => 2, 'gpa_impact' => 'متوسط', 'recommendation' => 'ابدأ بها'],
                    ['name' => 'قواعد البيانات', 'code' => '102', 'credit_hours' => 3, 'difficulty' => 3, 'unlocks' => 1, 'gpa_impact' => 'إيجابي', 'recommendation' => 'خيار جيد'],
                ],
            ],
        ])]);

        $widget = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'قارن بين هياكل البيانات وقواعد البيانات'])
            ->assertOk()
            ->json('interactive_widget');

        $this->assertSame('comparison', $widget['type']);
        $this->assertCount(2, $widget['items']);
        // The id is resolved from the literal name — the model never sends ids here.
        $this->assertSame($first->id, $widget['items'][0]['id']);
        $this->assertSame($second->id, $widget['items'][1]['id']);
    }

    public function test_cart_review_widget_carries_verdicts_and_summary(): void
    {
        [$user, $major] = $this->student();
        $inCart = $this->course($major, ['name' => 'مادة ثقيلة', 'credit_hours' => 3]);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'راجعت جدولك 🛒',
            'interactive_widget' => [
                'type' => 'cart_review',
                'title' => 'مراجعة جدولك',
                'courses' => [
                    ['name' => 'مادة ثقيلة', 'code' => '201', 'credit_hours' => 3, 'difficulty' => 5, 'verdict' => 'warning', 'reason' => 'صعبة مع باقي جدولك'],
                ],
                'summary' => ['total_hours' => 3, 'max_hours' => 18, 'overall_difficulty' => 'متوسط', 'recommendation' => 'جدولك متوازن'],
            ],
        ])]);

        $widget = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'راجع سلتي'])
            ->assertOk()
            ->json('interactive_widget');

        $this->assertSame('cart_review', $widget['type']);
        $this->assertSame('warning', $widget['courses'][0]['verdict']);
        $this->assertSame($inCart->id, $widget['courses'][0]['id']);
        $this->assertSame(18, $widget['summary']['max_hours']);
    }

    public function test_hours_slider_and_poll_widgets_pass_through(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $this->fakeGemini([
            $this->envelope([
                'reply' => 'كم ساعة تحب تسجل؟',
                'interactive_widget' => ['type' => 'hours_slider', 'question' => 'كم ساعة؟', 'min' => 12, 'max' => 18, 'default' => 15, 'current_cart_hours' => 0],
            ]),
            $this->envelope([
                'reply' => 'شو أولويتك؟',
                'interactive_widget' => ['type' => 'poll', 'question' => 'شو أهم شي إلك؟', 'options' => [['label' => 'أرفع معدلي', 'value' => 'gpa'], ['label' => 'أسرّع تخرجي', 'value' => 'graduate']]],
            ]),
        ]);

        $slider = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة أسجل؟'])
            ->assertOk()
            ->json('interactive_widget');

        $this->assertSame('hours_slider', $slider['type']);
        $this->assertSame(15, $slider['default']);

        $poll = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'ساعدني أحدد أولويتي'])
            ->assertOk()
            ->json('interactive_widget');

        $this->assertSame('poll', $poll['type']);
        $this->assertCount(2, $poll['options']);
    }

    public function test_gpa_forecast_values_are_clamped_to_the_percentage_scale(): void
    {
        [$user, $major] = $this->student();
        $graded = $this->course($major, ['name' => 'مادة بعلامة', 'credit_hours' => 3]);
        $this->pass($user, $graded, 71.5);
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'توقع معدلك 📈',
            'interactive_widget' => [
                'type' => 'gpa_forecast',
                'title' => 'توقّع معدلك',
                'current_gpa' => 71.5,
                'target_gpa' => 75,
                'note' => 'على أساس 80% بالمواد الجديدة',
                'points' => [
                    ['label' => 'الآن', 'expected' => 71.5],
                    ['label' => 'الفصل القادم', 'expected' => 140, 'optimistic' => 200, 'pessimistic' => -30],
                ],
            ],
        ])]);

        $widget = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أقدر أوصل 75؟'])
            ->assertOk()
            ->json('interactive_widget');

        $this->assertSame('gpa_forecast', $widget['type']);
        foreach ($widget['points'] as $point) {
            foreach (['expected', 'optimistic', 'pessimistic'] as $key) {
                if (isset($point[$key])) {
                    $this->assertGreaterThanOrEqual(0, $point[$key]);
                    $this->assertLessThanOrEqual(100, $point[$key]);
                }
            }
        }
    }

    public function test_radar_values_are_clamped_and_axis_counts_are_enforced(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة أولى']);
        $this->course($major, ['name' => 'مادة ثانية']);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'مقارنة متعددة الأبعاد 🕸️',
            'interactive_widget' => [
                'type' => 'radar',
                'title' => 'مقارنة',
                'axes' => ['الصعوبة', 'الجهد', 'أثرها على المعدل'],
                'series' => [
                    ['name' => 'مادة أولى', 'values' => [9, -2, 3]],
                    ['name' => 'مادة ثانية', 'values' => [2, 2]],
                ],
            ],
        ])]);

        $widget = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'قارن مادة أولى ومادة ثانية بكل الأبعاد'])
            ->assertOk()
            ->json('interactive_widget');

        $this->assertSame('radar', $widget['type']);
        foreach ($widget['series'] as $series) {
            $this->assertCount(count($widget['axes']), $series['values']);
            foreach ($series['values'] as $value) {
                $this->assertGreaterThanOrEqual(0, $value);
                $this->assertLessThanOrEqual(5, $value);
            }
        }
    }

    public function test_an_unknown_widget_type_is_dropped(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'جواب عادي.',
            'interactive_widget' => ['type' => 'holographic_projection', 'title' => 'شيء غير مدعوم'],
        ])]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'اعرض لي شيئاً'])
            ->assertOk()
            ->assertJsonPath('interactive_widget', null);
    }

    /**
     * When the model describes a chart without emitting one, the deterministic
     * engine builds it from the student's own record instead.
     */
    public function test_a_gpa_question_gets_a_deterministic_forecast_when_the_model_omits_one(): void
    {
        [$user, $major] = $this->student();
        $graded = $this->course($major, ['name' => 'مادة بعلامة', 'credit_hours' => 3]);
        $this->pass($user, $graded, 71);
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'الرسم البياني أدناه يوضح توقع معدلك 📈',
            'interactive_widget' => null,
        ])]);

        $widget = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كيف بيتأثر معدلي التراكمي؟'])
            ->assertOk()
            ->json('interactive_widget');

        $this->assertNotNull($widget, 'A GPA question must still produce a forecast widget.');
        $this->assertSame('gpa_forecast', $widget['type']);
        $this->assertNotEmpty($widget['points']);
    }

    /** After a real cart write the student is shown the resulting schedule. */
    public function test_a_successful_add_produces_a_cart_review_widget(): void
    {
        [$user, $major] = $this->student();
        $target = $this->course($major, ['name' => 'مادة مطلوبة']);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'تمت إضافتها بنجاح ✅',
            'courses_to_add' => [$target->id],
            'interactive_widget' => null,
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أضف مادة مطلوبة'])
            ->assertOk()
            ->assertJsonPath('refresh_cart', true);

        $widget = $response->json('interactive_widget');
        $this->assertSame('cart_review', $widget['type']);
        $this->assertContains($target->id, array_column($widget['courses'], 'id'));
    }

    /** Follow-up suggestions are capped and stay strings. */
    public function test_follow_up_suggestions_are_capped(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'follow_up_suggestions' => ['سؤال 1', 'سؤال 2', 'سؤال 3', 'سؤال 4', 'سؤال 5'],
        ])]);

        $suggestions = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'سؤال'])
            ->assertOk()
            ->json('follow_up_suggestions');

        $this->assertLessThanOrEqual(3, count($suggestions));
        foreach ($suggestions as $suggestion) {
            $this->assertIsString($suggestion);
        }
    }
}
