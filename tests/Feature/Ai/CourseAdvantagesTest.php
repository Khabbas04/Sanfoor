<?php

namespace Tests\Feature\Ai;

use App\Services\AcademicPathPlannerService;
use App\Support\CourseAdvantages;

/**
 * Per-course explanations.
 *
 * The advisor used to attach interchangeable reasons to every recommendation
 * ("مادة أساسية ضمن الخطة"), which is true of half a study plan and therefore
 * cannot help anyone choose. These are the facts that actually differ between two
 * options, computed from the student's own plan.
 */
class CourseAdvantagesTest extends AdvisorTestCase
{
    private function texts(array $course, array $context = []): string
    {
        return implode(' | ', array_column(CourseAdvantages::for($course, $context), 'text'));
    }

    public function test_a_gateway_course_names_what_it_opens(): void
    {
        $advantages = CourseAdvantages::for([
            'name' => 'برمجة الحاسوب (2)',
            'type' => 'compulsory',
            'credit_hours' => 3,
            'difficulty_level' => 3,
            'unlocks' => 6,
            'unlocks_courses' => ['هياكل البيانات', 'قواعد البيانات', 'برمجة ويب'],
        ]);

        $this->assertSame('unlocks', $advantages[0]['key'], 'What it opens is the most useful fact.');
        $this->assertStringContainsString('6 مواد', $advantages[0]['text']);
        // Named, not just counted: "6 courses" is abstract, the names are not.
        $this->assertStringContainsString('هياكل البيانات', $advantages[0]['text']);
        $this->assertStringContainsString('قواعد البيانات', $advantages[0]['text']);
    }

    public function test_a_single_unlock_is_phrased_in_the_singular(): void
    {
        $text = $this->texts([
            'type' => 'compulsory', 'credit_hours' => 3, 'difficulty_level' => 3,
            'unlocks' => 1, 'unlocks_courses' => ['تنظيم وعمارة الحاسوب'],
        ]);

        $this->assertStringContainsString('تفتح لك مادة لاحقة', $text);
        $this->assertStringNotContainsString('1 مواد', $text);
    }

    public function test_a_course_late_in_the_plan_is_flagged(): void
    {
        $text = $this->texts(
            ['type' => 'compulsory', 'credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 2],
            ['student_semester' => 5]
        );

        $this->assertStringContainsString('متأخرة عن فصلها', $text);
        $this->assertStringContainsString('الفصل 2', $text);
    }

    public function test_a_course_on_schedule_is_not_flagged_as_late(): void
    {
        $text = $this->texts(
            ['type' => 'compulsory', 'credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 5],
            ['student_semester' => 5]
        );

        $this->assertStringNotContainsString('متأخرة', $text);
    }

    /** A heavy course is called heavy: an advantage list that hides cost is a sales pitch. */
    public function test_a_heavy_course_carries_its_warning(): void
    {
        $text = $this->texts(['type' => 'compulsory', 'credit_hours' => 3, 'difficulty_level' => 5, 'unlocks' => 2]);

        $this->assertStringContainsString('ثقيلة', $text);
        $this->assertStringContainsString('تفتح', $text, 'The upside is still stated alongside it.');
    }

    public function test_a_light_course_is_described_as_gpa_friendly(): void
    {
        $text = $this->texts(['type' => 'compulsory', 'credit_hours' => 3, 'difficulty_level' => 1]);

        $this->assertStringContainsString('حماية معدلك', $text);
    }

    public function test_a_university_requirement_leads_with_what_it_is(): void
    {
        $advantages = CourseAdvantages::for([
            'type' => 'university_req',
            'credit_hours' => 3,
            'difficulty_level' => 1,
        ]);

        // Identity first: "online requirement" already implies the lighter load, so
        // spending a second line on "low difficulty" would repeat one fact.
        $this->assertSame('balance', $advantages[0]['key']);
        $this->assertStringContainsString('أونلاين', $advantages[0]['text']);
        $this->assertSame([], array_filter($advantages, fn ($a) => $a['key'] === 'gpa_safe'));
    }

    public function test_a_one_hour_course_is_described_as_cheap_progress(): void
    {
        $text = $this->texts(['type' => 'compulsory', 'credit_hours' => 1, 'difficulty_level' => 3]);

        $this->assertStringContainsString('ساعة معتمدة واحدة', $text);
    }

    /** Never empty, and never more than a student will read. */
    public function test_the_list_is_always_useful_and_bounded(): void
    {
        $this->assertNotEmpty(CourseAdvantages::for([]));
        $this->assertLessThanOrEqual(3, count(CourseAdvantages::for([
            'type' => 'university_req',
            'credit_hours' => 1,
            'difficulty_level' => 1,
            'unlocks' => 4,
            'unlocks_courses' => ['أ', 'ب'],
            'course_semester' => 1,
        ], ['student_semester' => 6])));

        foreach (CourseAdvantages::for([]) as $advantage) {
            $this->assertSame(['key', 'icon', 'text'], array_keys($advantage));
            $this->assertNotSame('', $advantage['text']);
        }
    }

    /** The generic filler that made the old reasons useless must not come back. */
    public function test_generic_reasons_are_not_produced_for_a_distinctive_course(): void
    {
        $text = $this->texts([
            'type' => 'compulsory', 'credit_hours' => 3, 'difficulty_level' => 4,
            'unlocks' => 3, 'unlocks_courses' => ['مادة لاحقة'],
        ]);

        $this->assertStringNotContainsString('مادة أساسية ضمن الخطة', $text);
        $this->assertStringNotContainsString('مناسبة لتقدمك', $text);
    }

    /* ── where the student actually sees them ───────────────────────────── */

    /** The Tree planner cards. */
    public function test_the_planner_attaches_advantages_to_every_course(): void
    {
        [$user, $major] = $this->student();
        $gateway = $this->course($major, ['name' => 'مادة مفصلية', 'credit_hours' => 3]);
        foreach (range(1, 3) as $index) {
            $this->course($major, ['name' => "مادة لاحقة {$index}", 'semester' => 3])
                ->prerequisites()->attach($gateway->id);
        }
        $this->course($major, ['name' => 'متطلب جامعة', 'type' => 'university_req', 'difficulty_level' => 1]);
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);

        foreach ($path['current_semester']['courses'] as $course) {
            $this->assertNotEmpty($course['advantages'], "No advantages for {$course['name']}");
            $this->assertNotEmpty($course['reason']);
            // reasons stays populated so the existing expander keeps working.
            $this->assertNotEmpty($course['reasons']);
        }

        $gatewayRow = collect($path['current_semester']['courses'])->firstWhere('name', 'مادة مفصلية');
        $this->assertStringContainsString('تفتح لك 3 مواد', $gatewayRow['advantages'][0]['text']);
        $this->assertStringContainsString('مادة لاحقة', $gatewayRow['advantages'][0]['text']);
    }

    /** The chat's suggestion chips. */
    public function test_suggested_courses_in_chat_carry_their_advantages(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $gateway = $this->course($major, ['name' => 'مادة مفصلية']);
        $this->course($major, ['name' => 'مادة لاحقة', 'semester' => 3])->prerequisites()->attach($gateway->id);
        $this->currentPeriod();

        $this->fakeGemini([$this->envelope(['suggested_course_ids' => [$gateway->id]])]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $suggested = $response->json('suggested_courses.0');

        $this->assertSame($gateway->id, $suggested['id']);
        $this->assertNotEmpty($suggested['advantages']);
        $this->assertStringContainsString('تفتح', $suggested['advantages'][0]['text']);
    }

    /** The chat plan panel. */
    public function test_the_plan_panel_explains_each_row(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.new_widgets', true);

        [$user, $major] = $this->student();
        foreach (range(1, 4) as $index) {
            $this->course($major, ['name' => "مادة {$index}", 'credit_hours' => 3]);
        }
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'semester_plan');

        $this->assertNotNull($widget);
        foreach ($widget['courses'] as $course) {
            $this->assertNotEmpty($course['advantages'], "No advantages for {$course['name']}");
        }
    }

    /** And the model is given the same material, plus the rule against filler. */
    public function test_the_prompt_carries_the_computed_reasons_and_bans_generic_ones(): void
    {
        config()->set('ai.features.intent_router', true);

        [$user, $major] = $this->student();
        $gateway = $this->course($major, ['name' => 'مادة مفصلية']);
        $this->course($major, ['name' => 'مادة لاحقة', 'semester' => 3])->prerequisites()->attach($gateway->id);
        $this->currentPeriod();
        $fake = $this->fakeGemini([$this->envelope()]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'شو أسجل؟'])
            ->assertOk();

        $prompt = $fake->lastSystemInstruction();

        $this->assertStringContainsString('تفتح لك مادة لاحقة', $prompt);
        $this->assertStringContainsString('ما يميّزها هي تحديداً', $prompt);
        $this->assertStringContainsString('ممنوعة', $prompt);
    }
}
