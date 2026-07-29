<?php

namespace Tests\Feature\Ai;

use App\Models\Landmark;
use App\Services\AiToolRegistry;

/**
 * The tool layer: what it can run, what it refuses, and what it admits it
 * cannot answer.
 */
class AiToolRegistryTest extends AdvisorTestCase
{
    private AiToolRegistry $registry;

    protected function setUp(): void
    {
        parent::setUp();
        $this->registry = app(AiToolRegistry::class);
    }

    public function test_only_allow_listed_tools_exist(): void
    {
        $this->assertSame([
            'search_courses',
            'get_course_details',
            'validate_prerequisites',
            'calculate_gpa_goal',
            'review_cart',
            'get_calendar_events',
            'search_campus_directory',
        ], $this->registry->names());

        $this->assertFalse($this->registry->has('delete_student_record'));
        $this->assertNull($this->registry->get('delete_student_record'));
    }

    public function test_a_tool_the_model_invented_is_refused_and_logged(): void
    {
        [$user] = $this->student();

        $result = $this->registry->call($user, 'drop_all_tables');

        $this->assertFalse($result['ok']);
        $this->assertSame('tool_not_allowed', $result['errors'][0]['code']);
        $this->assertSame([['tool' => 'drop_all_tables', 'ok' => false, 'arguments' => [], 'error' => 'not_allowed']], $this->registry->callLog());
    }

    public function test_every_declaration_is_well_formed(): void
    {
        foreach ($this->registry->declarations() as $declaration) {
            $this->assertSame(['name', 'description', 'parameters'], array_keys($declaration));
            $this->assertContains($declaration['name'], $this->registry->names());
            $this->assertNotSame('', $declaration['description']);
            $this->assertSame('OBJECT', $declaration['parameters']['type']);
        }

        $only = $this->registry->declarations(['review_cart']);
        $this->assertCount(1, $only);
        $this->assertSame('review_cart', $only[0]['name']);
    }

    /* ── search_courses ─────────────────────────────────────────────────── */

    public function test_search_courses_stays_inside_the_students_plan(): void
    {
        [$user, $major] = $this->student();
        [, $otherMajor] = $this->student('other@example.com');
        $own = $this->course($major, ['name' => 'هياكل البيانات']);
        $foreign = $this->course($otherMajor, ['name' => 'هياكل البيانات المتقدمة']);
        $this->currentPeriod();

        $result = $this->registry->call($user, 'search_courses', ['query' => 'هياكل بيانات']);

        $this->assertTrue($result['ok']);
        $ids = array_column($result['data']['courses'], 'id');
        $this->assertContains($own->id, $ids);
        $this->assertNotContains($foreign->id, $ids);
        $this->assertSame('study_plan', $result['sources'][0]['type']);
    }

    public function test_search_courses_filters_and_orders_by_strategic_value(): void
    {
        [$user, $major] = $this->student();
        $pivotal = $this->course($major, ['name' => 'مادة مفصلية']);
        foreach (range(1, 3) as $index) {
            $this->course($major, ['name' => "مادة لاحقة {$index}", 'semester' => 3])
                ->prerequisites()->attach($pivotal->id);
        }
        $this->course($major, ['name' => 'مادة سهلة معزولة', 'difficulty_level' => 1, 'type' => 'elective']);
        $this->course($major, ['name' => 'مادة قاسية', 'difficulty_level' => 5]);
        $this->currentPeriod();

        $all = $this->registry->call($user, 'search_courses', []);
        $this->assertSame($pivotal->id, $all['data']['courses'][0]['id'], 'Unlocks lead the results.');

        $easy = $this->registry->call($user, 'search_courses', ['max_difficulty' => 2]);
        foreach ($easy['data']['courses'] as $course) {
            $this->assertLessThanOrEqual(2, $course['difficulty_level']);
        }

        $electives = $this->registry->call($user, 'search_courses', ['type' => 'elective']);
        foreach ($electives['data']['courses'] as $course) {
            $this->assertSame('elective', $course['type']);
        }

        $limited = $this->registry->call($user, 'search_courses', ['limit' => 2]);
        $this->assertCount(2, $limited['data']['courses']);
        $this->assertTrue($limited['data']['truncated']);
    }

    /* ── get_course_details ─────────────────────────────────────────────── */

    public function test_course_details_report_the_students_own_status(): void
    {
        [$user, $major] = $this->student();
        $prerequisite = $this->course($major, ['name' => 'البرمجة الأولى']);
        $locked = $this->course($major, ['name' => 'البرمجة المتقدمة', 'semester' => 2]);
        $locked->prerequisites()->attach($prerequisite->id);
        $this->currentPeriod();

        $open = $this->registry->call($user, 'get_course_details', ['course_id' => $prerequisite->id]);
        $this->assertTrue($open['ok']);
        $this->assertTrue($open['data']['student_status']['is_open']);
        $this->assertSame(['البرمجة المتقدمة'], $open['data']['unlocks']);

        $blocked = $this->registry->call($user, 'get_course_details', ['course_id' => $locked->id]);
        $this->assertTrue($blocked['ok']);
        $this->assertFalse($blocked['data']['student_status']['is_open']);
        $this->assertSame(['البرمجة الأولى'], $blocked['data']['student_status']['missing_prerequisites']);
    }

    public function test_course_details_refuse_a_course_outside_the_students_plan(): void
    {
        [$user, $major] = $this->student();
        [, $otherMajor] = $this->student('other@example.com');
        $this->course($major);
        $foreign = $this->course($otherMajor, ['name' => 'مادة تخصص آخر']);
        $this->currentPeriod();

        $result = $this->registry->call($user, 'get_course_details', ['course_id' => $foreign->id]);

        $this->assertFalse($result['ok']);
        $this->assertSame('course_not_visible', $result['errors'][0]['code']);
        $this->assertSame([], $result['data']);
    }

    public function test_course_details_require_a_course_id(): void
    {
        [$user] = $this->student();

        $this->assertSame(
            'missing_course_id',
            $this->registry->call($user, 'get_course_details', [])['errors'][0]['code']
        );
    }

    /* ── validate_prerequisites ─────────────────────────────────────────── */

    public function test_prerequisite_validation_separates_open_from_blocked(): void
    {
        [$user, $major] = $this->student();
        $open = $this->course($major, ['name' => 'مادة مفتوحة']);
        $prerequisite = $this->course($major, ['name' => 'متطلب سابق']);
        $blocked = $this->course($major, ['name' => 'مادة مغلقة', 'semester' => 2]);
        $blocked->prerequisites()->attach($prerequisite->id);
        $this->currentPeriod();

        $result = $this->registry->call($user, 'validate_prerequisites', [
            'course_ids' => [$open->id, $blocked->id],
        ]);

        $this->assertTrue($result['ok']);
        $this->assertSame([$open->id], array_column($result['data']['open'], 'id'));
        $this->assertSame([$blocked->id], array_column($result['data']['blocked'], 'id'));
        $this->assertFalse($result['data']['all_open']);
        $this->assertNotEmpty($result['data']['blocked'][0]['reasons']);
    }

    public function test_prerequisite_validation_checks_the_hour_limit_too(): void
    {
        [$user, $major] = $this->student();
        $ids = [];
        foreach (range(1, 7) as $index) {
            $ids[] = $this->course($major, ['name' => "مادة {$index}", 'credit_hours' => 3])->id;
        }
        $this->currentPeriod();

        $result = $this->registry->call($user, 'validate_prerequisites', ['course_ids' => $ids]);

        $this->assertSame(21, $result['data']['hours']);
        $this->assertSame(18, $result['data']['limit']);
        $this->assertFalse($result['data']['within_limit']);
    }

    /* ── calculate_gpa_goal ─────────────────────────────────────────────── */

    public function test_the_gpa_goal_tool_computes_the_required_term_average(): void
    {
        [$user, $major] = $this->student();
        // 30 hours at 70%.
        foreach (range(1, 10) as $index) {
            $this->pass($user, $this->course($major, ['name' => "مادة سابقة {$index}", 'credit_hours' => 3]), 70);
        }
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();

        $result = $this->registry->call($user->fresh(), 'calculate_gpa_goal', [
            'target_gpa' => 75,
            'planned_hours' => 15,
        ]);

        $this->assertTrue($result['ok']);
        $this->assertSame(70.0, $result['data']['current_gpa']);
        $this->assertSame(30, $result['data']['passed_hours']);
        // (75 × 45 − 70 × 30) ÷ 15 = 85
        $this->assertSame(85.0, $result['data']['required_term_average']);
        $this->assertTrue($result['data']['reachable_this_term']);
        $this->assertNotNull($result['data']['forecast']);
    }

    public function test_the_gpa_goal_tool_refuses_an_impossible_target(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 10) as $index) {
            $this->pass($user, $this->course($major, ['name' => "مادة سابقة {$index}", 'credit_hours' => 3]), 60);
        }
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();

        $result = $this->registry->call($user->fresh(), 'calculate_gpa_goal', [
            'target_gpa' => 95,
            'planned_hours' => 9,
        ]);

        $this->assertFalse($result['data']['reachable_this_term']);
        $this->assertNotNull($result['data']['max_possible_this_term']);
        $this->assertLessThan(95, $result['data']['max_possible_this_term']);
    }

    /** No grades on record means no cumulative average to project. */
    public function test_the_gpa_goal_tool_is_honest_without_records(): void
    {
        [$user, $major] = $this->student();
        $this->course($major, ['name' => 'مادة متاحة']);
        $this->currentPeriod();

        $result = $this->registry->call($user, 'calculate_gpa_goal', ['target_gpa' => 80]);

        $this->assertFalse($result['data']['grounded']);
        $this->assertNull($result['data']['current_gpa']);
        $this->assertStringContainsString('علامات', $result['data']['message']);
    }

    /* ── review_cart ────────────────────────────────────────────────────── */

    public function test_review_cart_reports_hours_limit_and_widget(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 5) as $index) {
            $this->addToCart($user, $this->course($major, ['name' => "مادة سلة {$index}", 'credit_hours' => 3]));
        }
        $this->currentPeriod();

        $result = $this->registry->call($user->fresh(), 'review_cart', []);

        $this->assertTrue($result['ok']);
        $this->assertFalse($result['data']['is_empty']);
        $this->assertSame(15, $result['data']['hours']);
        $this->assertSame(18, $result['data']['limit']);
        $this->assertTrue($result['data']['within_limit']);
        $this->assertSame('cart_review', $result['data']['widget']['type']);
        $this->assertSame('cart', $result['sources'][0]['type']);
    }

    public function test_review_cart_handles_an_empty_cart(): void
    {
        [$user, $major] = $this->student();
        $this->course($major);
        $this->currentPeriod();

        $result = $this->registry->call($user, 'review_cart', []);

        $this->assertTrue($result['ok']);
        $this->assertTrue($result['data']['is_empty']);
        $this->assertSame(0, $result['data']['hours']);
    }

    /** review_cart must never write. */
    public function test_review_cart_does_not_change_the_cart(): void
    {
        [$user, $major] = $this->student();
        $course = $this->course($major);
        $this->addToCart($user, $course);
        $this->currentPeriod();

        $this->registry->call($user->fresh(), 'review_cart', []);

        $this->assertSame(1, \Illuminate\Support\Facades\DB::table('user_carts')->where('user_id', $user->id)->count());
    }

    /* ── ungrounded intents ─────────────────────────────────────────────── */

    public function test_the_calendar_tool_refuses_to_invent_dates(): void
    {
        [$user] = $this->student();
        $period = $this->currentPeriod(3, '2026/2027');

        $result = $this->registry->call($user, 'get_calendar_events', ['event_type' => 'امتحانات']);

        $this->assertFalse($result['ok']);
        $this->assertSame('data_unavailable', $result['errors'][0]['code']);
        // The current term IS known, so it is still reported.
        $this->assertSame($period->academic_year, $result['data']['current_period']['academic_year']);
        $this->assertTrue($result['data']['current_period']['is_summer']);
        $this->assertNotSame('', $result['data']['referral']);
    }

    public function test_the_campus_tool_matches_only_real_landmarks(): void
    {
        [$user] = $this->student();
        Landmark::create(['name' => 'مبنى دائرة القبول والتسجيل', 'type' => 'department', 'is_active' => true]);
        Landmark::create(['name' => 'المكتبة الرئيسية', 'type' => 'facility', 'is_active' => true]);

        $found = $this->registry->call($user, 'search_campus_directory', ['query' => 'دائرة القبول والتسجيل']);
        $this->assertTrue($found['ok']);
        $this->assertSame('مبنى دائرة القبول والتسجيل', $found['data']['matched']['name']);
        $this->assertSame('campus_directory', $found['sources'][0]['type']);

        $invented = $this->registry->call($user, 'search_campus_directory', ['query' => 'مبنى المفاعل النووي']);
        $this->assertFalse($invented['ok']);
        $this->assertSame('unknown_place', $invented['errors'][0]['code']);
        // The real list is offered instead of an invented building.
        $this->assertContains('المكتبة الرئيسية', $invented['data']['known_places']);
    }

    public function test_the_campus_tool_reports_an_empty_directory_honestly(): void
    {
        [$user] = $this->student();

        $result = $this->registry->call($user, 'search_campus_directory', ['query' => 'المكتبة']);

        $this->assertFalse($result['ok']);
        $this->assertSame('data_unavailable', $result['errors'][0]['code']);
    }

    /* ── planning ───────────────────────────────────────────────────────── */

    public function test_the_plan_matches_the_intent(): void
    {
        $this->assertSame(
            ['review_cart'],
            array_column($this->registry->plan(['intent' => 'cart_review', 'entities' => []]), 'tool')
        );

        $gpa = $this->registry->plan(['intent' => 'gpa_goal', 'entities' => ['gpa_target' => 80.0, 'hours' => 15]]);
        $this->assertSame('calculate_gpa_goal', $gpa[0]['tool']);
        $this->assertSame(['target_gpa' => 80.0, 'planned_hours' => 15], $gpa[0]['arguments']);

        $details = $this->registry->plan(['intent' => 'compare_courses', 'entities' => ['course_ids' => [1, 2]]]);
        $this->assertSame(['get_course_details', 'get_course_details'], array_column($details, 'tool'));

        // An intent with nothing safe to run plans nothing.
        $this->assertSame([], $this->registry->plan(['intent' => 'general_question', 'entities' => []]));
        // …and so does a prerequisite question that never named a course.
        $this->assertSame([], $this->registry->plan(['intent' => 'prerequisite_check', 'entities' => []]));
    }

    public function test_tools_are_offered_per_intent(): void
    {
        $this->assertSame(['calculate_gpa_goal'], $this->registry->namesForIntent('gpa_goal'));
        $this->assertSame([], $this->registry->namesForIntent(null));
        $this->assertSame([], $this->registry->namesForIntent('nonexistent_intent'));

        foreach ($this->registry->namesForIntent('semester_planning') as $name) {
            $this->assertTrue($this->registry->has($name));
        }
    }

    public function test_running_a_plan_collects_facts_sources_and_names(): void
    {
        [$user, $major] = $this->student();
        $this->addToCart($user, $this->course($major, ['name' => 'مادة سلة', 'credit_hours' => 3]));
        $this->currentPeriod();

        $run = $this->registry->runPlan($user->fresh(), [['tool' => 'review_cart', 'arguments' => []]]);

        $this->assertSame(['review_cart'], $run['tools_called']);
        $this->assertCount(1, $run['facts']);
        $this->assertStringContainsString('review_cart', $run['facts'][0]);
        $this->assertSame('cart', $run['sources'][0]['type']);
    }

    /** A failing tool becomes an instruction not to guess, not an exception. */
    public function test_a_failing_tool_is_contained(): void
    {
        [$user] = $this->student();

        $run = $this->registry->runPlan($user, [['tool' => 'get_course_details', 'arguments' => []]]);

        $this->assertSame(['get_course_details'], $run['tools_called']);
        $this->assertStringContainsString('⚠️', $run['facts'][0]);
    }
}
