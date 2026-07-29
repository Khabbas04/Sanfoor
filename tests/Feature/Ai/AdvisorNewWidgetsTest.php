<?php

namespace Tests\Feature\Ai;

use App\Models\Landmark;

/**
 * The additional widgets, which the application builds from validated data rather
 * than asking the model for. The six original ones keep working untouched.
 */
class AdvisorNewWidgetsTest extends AdvisorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.tool_registry', true);
        config()->set('ai.features.new_widgets', true);
        config()->set('ai.features.sources', true);
    }

    public function test_with_the_flag_off_no_extra_widgets_are_emitted(): void
    {
        config()->set('ai.features.new_widgets', false);

        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('widgets', []);
    }

    /** The legacy widget is still delivered, and the new ones come alongside it. */
    public function test_the_legacy_widget_and_the_new_ones_coexist(): void
    {
        [$user, $major] = $this->student();
        $course = $this->course($major, ['name' => 'هياكل البيانات']);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope([
            'reply' => 'إليك التفاصيل 📘',
            'interactive_widget' => [
                'type' => 'hours_slider',
                'question' => 'كم ساعة؟',
                'min' => 12, 'max' => 18, 'default' => 15, 'current_cart_hours' => 0,
            ],
        ])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة معتمدة لمادة هياكل البيانات؟'])
            ->assertOk();

        $this->assertSame('hours_slider', $response->json('interactive_widget.type'));

        $types = array_column($response->json('widgets'), 'type');
        $this->assertContains('course_card', $types);
        $this->assertNotNull($course->id);
    }

    public function test_a_course_question_produces_a_course_card_with_the_students_own_state(): void
    {
        [$user, $major] = $this->student();
        $prerequisite = $this->course($major, ['name' => 'البرمجة الأولى']);
        $locked = $this->course($major, ['name' => 'البرمجة المتقدمة', 'semester' => 2]);
        $locked->prerequisites()->attach($prerequisite->id);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو المتطلب السابق لمادة البرمجة المتقدمة؟'])
            ->assertOk();

        $card = collect($response->json('widgets'))->firstWhere('type', 'course_card');

        $this->assertNotNull($card);
        $this->assertSame($locked->id, $card['course_id']);
        $this->assertSame('locked', $card['state']);
        $this->assertSame(['البرمجة الأولى'], $card['missing_prerequisites']);
    }

    public function test_a_gpa_goal_produces_a_goal_widget_with_real_arithmetic(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 10) as $index) {
            $this->pass($user, $this->course($major, ['name' => "مادة سابقة {$index}", 'credit_hours' => 3]), 70);
        }
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'أبي معدلي يوصل 75 وأسجل 15 ساعة'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'gpa_goal');

        $this->assertNotNull($widget);
        $this->assertEquals(70, $widget['current_gpa']);
        $this->assertEquals(75, $widget['target_gpa']);
        $this->assertEquals(85, $widget['required_term_average']);
        $this->assertTrue($widget['reachable']);
        $this->assertNotNull($widget['forecast']);
    }

    /** A student with no grades gets no GPA widget rather than a fabricated one. */
    public function test_no_gpa_widget_without_records(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'أبي معدلي يوصل 80'])
            ->assertOk();

        $this->assertNull(collect($response->json('widgets'))->firstWhere('type', 'gpa_goal'));
    }

    public function test_a_campus_question_produces_a_place_widget_for_a_real_landmark(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $landmark = Landmark::create([
            'name' => 'مبنى دائرة القبول والتسجيل',
            'type' => 'department',
            'building_location' => 'المبنى الإداري - الطابق الأول',
            'is_active' => true,
        ]);
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'وين مبنى دائرة القبول والتسجيل؟'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'campus_place');

        $this->assertNotNull($widget);
        $this->assertSame($landmark->id, $widget['place_id']);
        $this->assertSame('المبنى الإداري - الطابق الأول', $widget['building_location']);
    }

    /** No calendar source means no timeline panel that would look like data. */
    public function test_no_calendar_timeline_is_drawn_without_calendar_data(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'متى تبدأ الامتحانات النهائية؟'])
            ->assertOk();

        $types = array_column($response->json('widgets'), 'type');
        $this->assertNotContains('calendar_timeline', $types);
    }

    public function test_a_semester_planning_question_produces_a_validated_plan(): void
    {
        [$user, $major] = $this->student();
        $pivotal = $this->course($major, ['name' => 'مادة مفصلية']);
        foreach (range(1, 3) as $index) {
            $this->course($major, ['name' => "مادة لاحقة {$index}", 'semester' => 3])
                ->prerequisites()->attach($pivotal->id);
        }
        foreach (range(1, 4) as $index) {
            $this->course($major, ['name' => "مادة عادية {$index}"]);
        }
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'semester_plan');

        $this->assertNotNull($widget);
        $this->assertNotEmpty($widget['courses']);
        $this->assertLessThanOrEqual($widget['hour_limit'], $widget['total_hours']);
        $this->assertSame('apply_semester_plan', $widget['apply_action']['action']);
        $this->assertSame(
            array_column($widget['courses'], 'course_id'),
            $widget['apply_action']['course_ids']
        );
    }

    /**
     * One recommendation per reply.
     *
     * The plan panel and the model's own suggestion chips used to arrive together
     * proposing DIFFERENT courses, which left the student with two lists and no way
     * to tell which one to act on.
     */
    public function test_the_plan_panel_is_the_only_recommendation(): void
    {
        [$user, $major] = $this->student();
        $other = $this->course($major, ['name' => 'مادة اقترحها النموذج']);
        foreach (range(1, 4) as $index) {
            $this->course($major, ['name' => "مادة خطة {$index}"]);
        }
        $this->currentPeriod();

        // The model proposes its own list on the side.
        $this->fakeGemini([$this->envelope(['suggested_course_ids' => [$other->id]])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $this->assertNotNull(collect($response->json('widgets'))->firstWhere('type', 'semester_plan'));
        $this->assertSame([], $response->json('suggested_courses'), 'The panel owns the recommendation.');
    }

    /** The model is told what the panel shows, so its prose cannot contradict it. */
    public function test_the_model_is_told_exactly_what_the_panel_shows(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 4) as $index) {
            $this->course($major, ['name' => "مادة خطة {$index}"]);
        }
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();
        $this->assertStringContainsString('لوحة «خطة الفصل» معروضة للطالب', $prompt);
        $this->assertStringContainsString('ممنوع أن تقترح قائمة مواد مختلفة', $prompt);
        $this->assertStringContainsString('مادة خطة 1', $prompt);
    }

    /**
     * The plan must account for what is already registered. A summer student with
     * 3 of 9 hours taken may only be offered 6 more.
     */
    public function test_the_plan_respects_the_hours_already_in_the_cart(): void
    {
        [$user, $major] = $this->student();
        $inCart = $this->course($major, ['name' => 'مادة مسجّلة', 'credit_hours' => 3]);
        foreach (range(1, 6) as $index) {
            $this->course($major, ['name' => "مادة متاحة {$index}", 'credit_hours' => 3]);
        }
        $this->addToCart($user, $inCart);
        $this->currentPeriod(3, '2026/2027'); // summer: 9 hours
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'semester_plan');

        $this->assertNotNull($widget);
        $this->assertSame(3, $widget['cart_hours']);
        $this->assertSame(6, $widget['proposed_hours'], 'Only the remaining allowance may be proposed.');
        $this->assertSame(9, $widget['total_hours']);
        $this->assertSame(9, $widget['hour_limit']);
        // And the course already registered is not proposed again.
        $this->assertNotContains($inCart->id, array_column($widget['courses'], 'course_id'));

        // Applying it must therefore succeed in full.
        config()->set('ai.features.actions', true);
        $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.action'), $widget['apply_action'])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('skipped', []);
    }

    /** A student already at their ceiling gets no plan panel at all. */
    public function test_no_plan_is_offered_when_the_cart_is_already_full(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 3) as $index) {
            $this->addToCart($user, $this->course($major, ['name' => "مادة سلة {$index}", 'credit_hours' => 3]));
        }
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod(3, '2026/2027'); // summer: 9 hours, already taken
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $this->assertNull(collect($response->json('widgets'))->firstWhere('type', 'semester_plan'));
    }

    /** Zero-hour entries are noise in a plan panel. */
    public function test_zero_hour_courses_are_not_listed_in_the_plan(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة بلا ساعات', 'credit_hours' => 0]);
        foreach (range(1, 3) as $index) {
            $this->course($major, ['name' => "مادة عادية {$index}", 'credit_hours' => 3]);
        }
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'semester_plan');

        foreach ($widget['courses'] as $course) {
            $this->assertGreaterThan(0, $course['credit_hours']);
        }
    }

    public function test_a_graduation_question_produces_a_roadmap(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 8) as $index) {
            $this->course($major, ['name' => "مادة خطة {$index}"]);
        }
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم باقي لي حتى أتخرج؟'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'graduation_roadmap');

        $this->assertNotNull($widget);
        $this->assertNotEmpty($widget['semesters']);
        $this->assertFalse($widget['semesters'][0]['is_prediction']);
    }

    /** An unreadable question is answered with a question, not a guess. */
    public function test_an_ambiguous_question_produces_a_clarification_widget(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), [
                'message' => 'في موضوع بدي أفهمه منك بشكل عام وما بعرف كيف أشرحه لك بالضبط',
            ])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'clarification');

        $this->assertNotNull($widget);
        $this->assertNotEmpty($widget['options']);
        foreach ($widget['options'] as $option) {
            $this->assertSame(['label', 'value'], array_keys($option));
        }
    }

    public function test_sources_arrive_as_a_footer_widget_too(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'sources');

        $this->assertNotNull($widget);
        $this->assertNotEmpty($widget['sources']);
    }

    public function test_the_widget_count_is_bounded(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 6) as $index) {
            $this->course($major, ['name' => "مادة {$index}"]);
        }
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        // Three panels at most, plus the sources footer.
        $panels = array_filter($response->json('widgets'), fn ($w) => $w['type'] !== 'sources');
        $this->assertLessThanOrEqual(3, count($panels));
    }

    /** A failing builder must not cost the student their answer. */
    public function test_a_failing_widget_builder_degrades_to_no_widgets(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope(['reply' => 'جواب سليم 🙂'])]);

        $this->app->bind(\App\Services\AiWidgetBuilder::class, fn () => new class extends \App\Services\AiWidgetBuilder {
            public function __construct() {}

            public function build(\App\Models\User $user, ?array $routed, array $toolResults, array $sources = [], array $context = [], ?array $prebuiltPlan = null): array
            {
                throw new \RuntimeException('builder exploded');
            }

            public function planFor(\App\Models\User $user, string $intent, array $context = []): array
            {
                throw new \RuntimeException('planner exploded');
            }
        });

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk()
            ->assertJsonPath('reply', 'جواب سليم 🙂')
            ->assertJsonPath('widgets', []);
    }

    /** New widgets must not be persisted into the stored envelope. */
    public function test_new_widgets_are_not_persisted_with_the_message(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $chatId = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
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
}
