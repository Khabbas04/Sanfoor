<?php

namespace Tests\Feature\Ai;

use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use App\Services\AcademicPathPlannerService;
use App\Support\CourseLoad;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Semester load.
 *
 * The planner capped a term at "two hard courses", where hard meant
 * difficulty_level ≥ 4 — and in this database virtually every course carries the
 * default 3, so the cap never once fired and three or four advanced specialisation
 * courses could share a term. The `grade_safety` ranking weight had the same
 * defect: it read `fail_rate`, a column that does not exist.
 *
 * Load is now derived from signals that are actually present.
 */
class SemesterLoadTest extends AdvisorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::forget('course_load_statistics_v1');
    }

    /**
     * An advanced 3-hour course the student can actually register.
     *
     * Its prerequisite is marked as passed: a locked course never reaches the
     * semester at all, and a test built on locked courses would pass while proving
     * nothing about how the planner weighs load.
     */
    private function heavy(User $user, Major $major, string $name, int $planSemester = 6): Course
    {
        $prerequisite = $this->course($major, ['name' => "متطلب {$name}", 'semester' => 1]);
        $this->pass($user, $prerequisite, 80);

        $course = $this->course($major, [
            'name' => $name,
            'type' => 'compulsory',
            'credit_hours' => 3,
            // Deliberately the default: this is what the real data looks like, and
            // the old cap read exactly this field.
            'difficulty_level' => 3,
            'semester' => $planSemester,
        ]);
        $course->prerequisites()->attach($prerequisite->id);

        return $course;
    }

    private function online(Major $major, string $name): Course
    {
        return $this->course($major, [
            'name' => $name,
            'type' => 'university_req',
            'credit_hours' => 3,
            'difficulty_level' => 3,
            'semester' => 1,
        ]);
    }

    /** Record real grades so a course has a measured failure rate. */
    private function withFailures(Course $course, int $attempts, int $failed): void
    {
        for ($i = 0; $i < $attempts; $i++) {
            $student = User::forceCreate([
                'name' => "سجل {$course->id}-{$i}",
                'email' => "history-{$course->id}-{$i}@example.com",
                'password' => 'x',
                'role' => 'student',
            ]);
            DB::table('course_user')->insert([
                'user_id' => $student->id,
                'course_id' => $course->id,
                'grade' => $i < $failed ? 45 : 80,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Cache::forget('course_load_statistics_v1');
    }

    /* ── the load model ─────────────────────────────────────────────────── */

    /** An advanced course must outweigh a first-year one even at the same difficulty. */
    public function test_level_and_prerequisites_make_a_course_heavier(): void
    {
        $firstYear = CourseLoad::intensity(['credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 1]);
        $fourthYear = CourseLoad::intensity(['credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 7, 'prereq_count' => 2]);

        $this->assertGreaterThan($firstYear, $fourthYear);
        $this->assertEqualsWithDelta(1.0, $firstYear, 0.01, 'One ordinary first-year course is the unit.');
    }

    public function test_a_measured_failure_rate_raises_the_load(): void
    {
        $base = ['credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 3];

        $unknown = CourseLoad::intensity($base);
        $risky = CourseLoad::intensity($base, ['fail_rate' => 40.0, 'sample' => 30]);
        $safe = CourseLoad::intensity($base, ['fail_rate' => 4.0, 'sample' => 30]);

        $this->assertGreaterThan($unknown, $risky);
        $this->assertLessThan($unknown, $safe);
    }

    /** A rate measured on three students is noise and must be ignored. */
    public function test_a_tiny_sample_is_ignored(): void
    {
        $base = ['credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 3];

        $this->assertSame(
            CourseLoad::intensity($base),
            CourseLoad::intensity($base, ['fail_rate' => 90.0, 'sample' => 3])
        );
    }

    public function test_light_deliveries_weigh_less(): void
    {
        $onCampus = CourseLoad::intensity(['credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 3]);
        $online = CourseLoad::intensity(['credit_hours' => 3, 'difficulty_level' => 3, 'course_semester' => 3, 'type' => 'university_req']);
        $lab = CourseLoad::intensity(['credit_hours' => 1, 'difficulty_level' => 3, 'course_semester' => 3]);

        $this->assertLessThan($onCampus, $online);
        $this->assertLessThan($onCampus, $lab);
    }

    public function test_the_level_falls_back_to_the_course_code(): void
    {
        $this->assertSame(3, CourseLoad::level(['code' => '0306301']));
        $this->assertSame(1, CourseLoad::level(['code' => 'ABC']));
        // The plan semester wins when both are present.
        $this->assertSame(2, CourseLoad::level(['code' => '0306401', 'course_semester' => 4]));
    }

    /* ── the planner ────────────────────────────────────────────────────── */

    /** The complaint: three demanding specialisation courses in one term. */
    public function test_demanding_courses_are_not_stacked_in_one_term(): void
    {
        [$user, $major] = $this->student();
        foreach (['نظم قواعد البيانات', 'تراكيب البيانات', 'شبكات الحاسوب', 'أساسيات الأمن السيبراني'] as $name) {
            $this->heavy($user, $major, $name);
        }
        $this->online($major, 'متطلب جامعة اختياري 1');
        $this->online($major, 'متطلب جامعة اختياري 2');
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user->fresh(), 'balanced', true);
        $semester = $path['current_semester'];

        $demanding = array_filter($semester['courses'], fn ($c) => $c['load'] >= 1.5);

        $this->assertLessThanOrEqual(2, count($demanding), 'Three demanding courses in one term is the bug.');
        $this->assertLessThanOrEqual($semester['load']['budget'], $semester['load']['score']);
        $this->assertFalse($semester['load']['is_over_budget']);
        $this->assertTrue($path['validation']['valid']);
    }

    /**
     * When only demanding courses remain, the cap holds and the short term is
     * EXPLAINED rather than left looking like a bug.
     *
     * Filling the hours by stacking a third and fourth demanding course is exactly
     * the schedule this work exists to prevent, so `balanced` stops at its cap — and
     * points at the goal that would lift it.
     */
    public function test_a_deliberately_light_term_is_explained(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 6) as $index) {
            $this->heavy($user, $major, "مادة ثقيلة {$index}");
        }
        $this->currentPeriod();

        $semester = app(AcademicPathPlannerService::class)
            ->generate($user->fresh(), 'balanced', true)['current_semester'];

        $this->assertLessThanOrEqual(2, $semester['load']['demanding_courses']);
        $this->assertLessThan($semester['hour_limit'], $semester['total_hours']);

        $note = $semester['load']['note'];
        $this->assertNotNull($note, 'A term well under the limit must say why.');
        $this->assertStringContainsString('خطر التعثّر', $note);
        $this->assertStringContainsString('التخرج بأسرع وقت', $note, 'And name the goal that would push harder.');
    }

    /** The goal built for pushing hard is allowed to push harder. */
    public function test_the_fast_goal_carries_more_demanding_courses(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 6) as $index) {
            $this->heavy($user, $major, "مادة ثقيلة {$index}");
        }
        $this->currentPeriod();

        $planner = app(AcademicPathPlannerService::class);
        $balanced = $planner->generate($user->fresh(), 'balanced', true)['current_semester'];
        $fast = $planner->generate($user->fresh(), 'fastest_graduation', true)['current_semester'];

        $this->assertGreaterThan($balanced['total_hours'], $fast['total_hours']);
        $this->assertGreaterThan($balanced['load']['demanding_courses'], $fast['load']['demanding_courses']);
    }

    /** A term that is full needs no explanation. */
    public function test_a_full_term_carries_no_note(): void
    {
        [$user, $major] = $this->student();
        $this->heavy($user, $major, 'مادة ثقيلة 1');
        $this->heavy($user, $major, 'مادة ثقيلة 2');
        foreach (range(1, 3) as $index) {
            $this->online($major, "متطلب جامعة {$index}");
        }
        $this->currentPeriod();

        $semester = app(AcademicPathPlannerService::class)
            ->generate($user->fresh(), 'balanced', true)['current_semester'];

        $this->assertNull($semester['load']['note']);
    }

    /** A goal that exists to reduce pressure must produce a lighter term. */
    public function test_the_reduce_pressure_goal_carries_less_load(): void
    {
        [$user, $major] = $this->student();
        foreach (['أ', 'ب', 'ج', 'د'] as $name) {
            $this->heavy($user, $major, "مادة {$name}");
        }
        $this->online($major, 'متطلب جامعة 1');
        $this->online($major, 'متطلب جامعة 2');
        $this->currentPeriod();

        $planner = app(AcademicPathPlannerService::class);
        $light = $planner->generate($user->fresh(), 'reduce_pressure', true)['current_semester'];
        $fast = $planner->generate($user->fresh(), 'fastest_graduation', true)['current_semester'];

        $this->assertLessThan($fast['load']['score'], $light['load']['score']);
    }

    /** Real failure history reaches the student as a warning they can act on. */
    public function test_a_course_with_real_failures_warns_the_student(): void
    {
        [$user, $major] = $this->student();
        $risky = $this->heavy($user, $major, 'مادة متعثّرة', 3);
        $this->withFailures($risky, attempts: 20, failed: 9); // 45%
        $this->online($major, 'متطلب جامعة');
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user->fresh(), 'balanced', true);
        $row = collect($path['current_semester']['courses'])->firstWhere('name', 'مادة متعثّرة');

        $this->assertNotNull($row);
        $this->assertEqualsWithDelta(45, $row['fail_rate'], 0.1);

        $warning = collect($row['advantages'])->firstWhere('key', 'heavy');
        $this->assertNotNull($warning, 'A 45% failure rate must be told to the student.');
        $this->assertStringContainsString('45%', $warning['text']);
        $this->assertStringContainsString('من 20 حالة', $warning['text'], 'The sample size makes the number trustworthy.');
    }

    /** A course nobody has failed must not be labelled risky. */
    public function test_a_reliable_course_carries_no_warning(): void
    {
        [$user, $major] = $this->student();
        $safe = $this->heavy($user, $major, 'مادة سهلة التاريخ', 3);
        $this->withFailures($safe, attempts: 20, failed: 0);
        $this->currentPeriod();

        $path = app(AcademicPathPlannerService::class)->generate($user->fresh(), 'balanced', true);
        $row = collect($path['current_semester']['courses'])->firstWhere('name', 'مادة سهلة التاريخ');

        $this->assertNull(collect($row['advantages'])->firstWhere('icon', '📉'));
        $this->assertEqualsWithDelta(0, $row['fail_rate'], 0.1);
    }

    /** The chat panel reports the load too, not only the hours. */
    public function test_the_plan_panel_reports_the_load(): void
    {
        config()->set('ai.features.intent_router', true);
        config()->set('ai.features.enhanced_rag', true);
        config()->set('ai.features.new_widgets', true);

        [$user, $major] = $this->student();
        foreach (['أ', 'ب', 'ج'] as $name) {
            $this->heavy($user, $major, "مادة {$name}");
        }
        $this->online($major, 'متطلب جامعة');
        $this->currentPeriod();
        $this->fakeGemini([$this->envelope()]);

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.chat'), ['message' => 'رتب لي جدول الفصل القادم'])
            ->assertOk();

        $widget = collect($response->json('widgets'))->firstWhere('type', 'semester_plan');

        $this->assertNotNull($widget['workload_level']);
        $this->assertArrayHasKey('score', $widget['load']);
        $this->assertArrayHasKey('is_over_budget', $widget['load']);
    }
}
