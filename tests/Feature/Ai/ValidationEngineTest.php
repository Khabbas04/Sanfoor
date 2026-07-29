<?php

namespace Tests\Feature\Ai;

use App\Engines\ValidationEngine;
use Tests\TestCase;

/**
 * The targeted validators added alongside ValidationEngine::validate().
 */
class ValidationEngineTest extends TestCase
{
    private ValidationEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new ValidationEngine();
    }

    public function test_every_validator_answers_in_the_same_shape(): void
    {
        $results = [
            $this->engine->validateAiCourseIds([1], [1]),
            $this->engine->validateCourseRecommendation([], ['effective_limit' => 18]),
            $this->engine->validateCartAction('add', [1], ['cart_ids' => [], 'eligible_ids' => [1], 'hours_by_id' => [1 => 3]], ['effective_limit' => 18]),
            $this->engine->validateCampusPlace('المكتبة', [1 => 'المكتبة']),
            $this->engine->validateCalendarEvent(null, ['has_calendar_data' => false]),
            $this->engine->validateGpaScenario([], []),
            $this->engine->validateAiAnswerEntities('نص', []),
        ];

        foreach ($results as $result) {
            foreach (['valid', 'checked_rules', 'errors', 'warnings'] as $key) {
                $this->assertArrayHasKey($key, $result);
            }
            $this->assertIsBool($result['valid']);
            $this->assertNotEmpty($result['checked_rules']);
        }
    }

    public function test_course_ids_outside_the_students_own_pool_are_errors(): void
    {
        $result = $this->engine->validateAiCourseIds([11, 99, 0, -3], [11, 12]);

        $this->assertFalse($result['valid']);
        $this->assertSame(
            ['hallucinated_id', 'invalid_id', 'invalid_id'],
            array_column($result['errors'], 'code')
        );

        $this->assertTrue($this->engine->validateAiCourseIds([11, 12], [11, 12, 13])['valid']);
    }

    public function test_a_recommendation_over_the_students_limit_is_rejected(): void
    {
        $courses = [
            ['id' => 1, 'credit_hours' => 3],
            ['id' => 2, 'credit_hours' => 3],
            ['id' => 3, 'credit_hours' => 3],
            ['id' => 4, 'credit_hours' => 3],
        ];

        // A student on probation is capped at 12 hours.
        $result = $this->engine->validateCourseRecommendation(
            array_merge($courses, [['id' => 5, 'credit_hours' => 3]]),
            ['effective_limit' => 12, 'is_probation' => true]
        );

        $this->assertFalse($result['valid']);
        $this->assertSame('exceeds_hour_limit', $result['errors'][0]['code']);
        $this->assertSame(15, $result['hours']);
        $this->assertSame(12, $result['limit']);

        // The same load is fine for a graduating student on 21 hours.
        $this->assertTrue(
            $this->engine->validateCourseRecommendation($courses, ['effective_limit' => 21])['valid']
        );
    }

    public function test_a_heavy_load_warns_without_blocking(): void
    {
        $result = $this->engine->validateCourseRecommendation([
            ['id' => 1, 'credit_hours' => 3, 'difficulty_level' => 5],
            ['id' => 2, 'credit_hours' => 3, 'difficulty_level' => 4],
            ['id' => 3, 'credit_hours' => 3, 'difficulty_level' => 5],
        ], ['effective_limit' => 18]);

        $this->assertTrue($result['valid'], 'A hard schedule is a warning, not a refusal.');
        $this->assertContains('heavy_load', array_column($result['warnings'], 'code'));
    }

    public function test_probation_warns_at_two_hard_courses(): void
    {
        $result = $this->engine->validateCourseRecommendation([
            ['id' => 1, 'credit_hours' => 3, 'difficulty_level' => 4],
            ['id' => 2, 'credit_hours' => 3, 'difficulty_level' => 5],
        ], ['effective_limit' => 12, 'is_probation' => true]);

        $this->assertTrue($result['valid']);
        $this->assertContains('heavy_load_on_probation', array_column($result['warnings'], 'code'));
    }

    public function test_an_empty_recommendation_is_a_warning(): void
    {
        $result = $this->engine->validateCourseRecommendation([], ['effective_limit' => 18]);

        $this->assertTrue($result['valid']);
        $this->assertContains('empty_recommendation', array_column($result['warnings'], 'code'));
    }

    public function test_a_cart_add_accepts_only_eligible_courses_within_the_limit(): void
    {
        $state = [
            'cart_ids' => [7],
            'eligible_ids' => [1, 2, 3],
            'hours_by_id' => [1 => 3, 2 => 3, 3 => 3],
        ];
        $rules = ['effective_limit' => 9, 'cart_hours' => 3];

        $result = $this->engine->validateCartAction('add', [1, 2, 3, 7, 99], $state, $rules);

        // 3 in the cart + 3 + 3 fits in 9; the third course would break it.
        $this->assertTrue($result['valid']);
        $this->assertSame([1, 2], $result['accepted_ids']);
        $this->assertSame(9, $result['projected_hours']);

        $codes = array_column($result['errors'], 'code');
        $this->assertContains('exceeds_hour_limit', $codes);
        $this->assertContains('not_eligible', $codes);
        $this->assertContains('already_in_cart', array_column($result['warnings'], 'code'));
    }

    public function test_a_cart_add_with_nothing_acceptable_fails(): void
    {
        $result = $this->engine->validateCartAction(
            'add',
            [99],
            ['cart_ids' => [], 'eligible_ids' => [1], 'hours_by_id' => [1 => 3]],
            ['effective_limit' => 18, 'cart_hours' => 0]
        );

        $this->assertFalse($result['valid']);
        $this->assertSame([], $result['accepted_ids']);
    }

    public function test_a_cart_removal_only_touches_courses_that_are_in_the_cart(): void
    {
        $result = $this->engine->validateCartAction(
            'remove',
            [7, 8],
            ['cart_ids' => [7], 'eligible_ids' => [], 'hours_by_id' => []],
            ['effective_limit' => 18, 'cart_hours' => 3]
        );

        $this->assertTrue($result['valid']);
        $this->assertSame([7], $result['accepted_ids']);
        $this->assertSame('not_in_cart', $result['errors'][0]['code']);
    }

    public function test_an_unknown_cart_action_is_refused(): void
    {
        $result = $this->engine->validateCartAction('drop_database', [1], [], []);

        $this->assertFalse($result['valid']);
        $this->assertSame('unknown_action', $result['errors'][0]['code']);
    }

    public function test_a_campus_place_must_exist_in_the_directory(): void
    {
        $places = [3 => 'مبنى دائرة القبول والتسجيل', 4 => 'المكتبة'];

        $matched = $this->engine->validateCampusPlace('دائرة القبول والتسجيل', $places);
        $this->assertTrue($matched['valid']);
        $this->assertSame(3, $matched['matched_id']);

        $invented = $this->engine->validateCampusPlace('مبنى الهندسة النووية', $places);
        $this->assertFalse($invented['valid']);
        $this->assertSame('unknown_place', $invented['errors'][0]['code']);

        $this->assertFalse($this->engine->validateCampusPlace(null, $places)['valid']);
    }

    /** With no calendar table, a calendar answer must be refused, not invented. */
    public function test_a_calendar_answer_is_refused_when_there_is_no_calendar_source(): void
    {
        $result = $this->engine->validateCalendarEvent(
            ['title' => 'بداية الامتحانات', 'date' => '2026-12-01'],
            ['has_calendar_data' => false]
        );

        $this->assertFalse($result['valid']);
        $this->assertSame('no_calendar_source', $result['errors'][0]['code']);
    }

    public function test_a_calendar_event_needs_a_title_and_a_date(): void
    {
        $result = $this->engine->validateCalendarEvent(['title' => 'بداية الفصل'], ['has_calendar_data' => true]);

        $this->assertFalse($result['valid']);
        $this->assertSame([['code' => 'missing_field', 'field' => 'date']], $result['errors']);
    }

    public function test_gpa_values_must_be_on_the_percentage_scale(): void
    {
        $result = $this->engine->validateGpaScenario(
            ['current_gpa' => 2.9, 'target_gpa' => 120],
            ['total_passed_hours' => 60]
        );

        $this->assertFalse($result['valid']);
        $this->assertSame(['out_of_percentage_scale'], array_unique(array_column($result['errors'], 'code')));
    }

    /** A target a single semester cannot reach is a promise, not advice. */
    public function test_an_unreachable_gpa_target_is_rejected_with_the_real_ceiling(): void
    {
        // 60 hours at 65% + 15 hours at a perfect 100% tops out at ~72%.
        $result = $this->engine->validateGpaScenario(
            ['current_gpa' => 65, 'target_gpa' => 85, 'planned_hours' => 15],
            ['total_passed_hours' => 60]
        );

        $this->assertFalse($result['valid']);
        $this->assertSame('target_unreachable_this_term', $result['errors'][0]['code']);
        $this->assertSame(72.0, $result['errors'][0]['max_possible']);

        // A reachable target passes.
        $this->assertTrue($this->engine->validateGpaScenario(
            ['current_gpa' => 65, 'target_gpa' => 70, 'planned_hours' => 15],
            ['total_passed_hours' => 60]
        )['valid']);
    }

    public function test_a_student_without_records_gets_a_warning_not_a_refusal(): void
    {
        $result = $this->engine->validateGpaScenario(
            ['current_gpa' => 0, 'target_gpa' => 80, 'planned_hours' => 15],
            ['total_passed_hours' => 0]
        );

        $this->assertTrue($result['valid']);
        $this->assertContains('no_records', array_column($result['warnings'], 'code'));
    }

    public function test_an_internal_course_id_token_in_the_reply_is_an_error(): void
    {
        $leaked = $this->engine->validateAiAnswerEntities('خذ [ID: 42] هذا الفصل', [42 => 'هياكل البيانات']);

        $this->assertFalse($leaked['valid']);
        $this->assertSame('leaked_internal_id', $leaked['errors'][0]['code']);
    }

    public function test_course_names_in_the_reply_are_resolved_to_ids(): void
    {
        $result = $this->engine->validateAiAnswerEntities(
            'أنصحك بمادة هياكل البيانات هذا الفصل، وتأجيل قواعد البيانات.',
            [11 => 'هياكل البيانات', 12 => 'قواعد البيانات', 13 => 'الشبكات']
        );

        $this->assertTrue($result['valid']);
        $this->assertSame([11, 12], $result['mentioned_course_ids']);
    }

    public function test_name_matching_survives_arabic_spelling_variants(): void
    {
        $result = $this->engine->validateAiAnswerEntities(
            'مادة الرياضيات المتقطعه مناسبه إلك',
            [21 => 'الرياضيات المتقطّعة']
        );

        $this->assertSame([21], $result['mentioned_course_ids']);
    }
}
