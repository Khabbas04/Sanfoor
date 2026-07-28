<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use App\Services\StudentDashboardInsightService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AcademicInsightTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_returns_one_available_pivotal_course(): void
    {
        [$user, $major] = $this->student();
        $pivotal = $this->course($major, ['name' => 'هياكل البيانات']);
        foreach (range(1, 4) as $index) {
            $child = $this->course($major, ['name' => "مادة لاحقة {$index}"]);
            $child->prerequisites()->attach($pivotal->id);
        }

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('academic_insight.type', 'critical_course')
                ->where('academic_insight.subject_id', $pivotal->id)
                ->where('academic_insight.impact.unlocks_courses_count', 4)
            );
    }

    public function test_course_with_unmet_prerequisite_is_never_recommended(): void
    {
        [$user, $major] = $this->student();
        $prerequisite = $this->course($major, ['name' => 'متطلب سابق']);
        $locked = $this->course($major, ['name' => 'مادة مفصلية مغلقة']);
        $locked->prerequisites()->attach($prerequisite->id);
        foreach (range(1, 5) as $index) {
            $child = $this->course($major, ['name' => "لاحقة مغلقة {$index}"]);
            $child->prerequisites()->attach($locked->id);
        }

        $insight = app(StudentDashboardInsightService::class)->for($user, true);

        $this->assertNotSame($locked->id, $insight['subject_id'] ?? null);
        $this->assertNotSame('critical_course', $insight['type']);
    }

    public function test_risky_cart_is_selected_when_academic_limit_is_exceeded(): void
    {
        [$user, $major] = $this->student();
        $courses = collect(range(1, 7))->map(fn ($index) => $this->course($major, [
            'name' => "مادة سلة {$index}",
            'credit_hours' => 3,
            'difficulty_level' => $index <= 2 ? 5 : 3,
        ]));
        $user->cartCourses()->attach($courses->pluck('id')->all());

        $insight = app(StudentDashboardInsightService::class)->for($user, true);

        $this->assertSame('risky_cart', $insight['type']);
        $this->assertSame('critical', $insight['priority']);
        $this->assertCount(2, $insight['reasons']);
    }

    public function test_missing_data_and_positive_states_are_supported(): void
    {
        [$stable] = $this->student();
        $missing = User::forceCreate([
            'name' => 'Missing Student',
            'email' => 'missing@example.com',
            'password' => Hash::make('password'),
            'role' => 'student',
            'major_id' => null,
            'study_plan_version' => 12,
            'email_verified_at' => now(),
        ]);

        $missingInsight = app(StudentDashboardInsightService::class)->for($missing, true);
        $stableInsight = app(StudentDashboardInsightService::class)->for($stable, true);

        $this->assertSame('missing_data', $missingInsight['type']);
        $this->assertSame('missing_data', $missingInsight['state']);
        $this->assertSame('positive_status', $stableInsight['type']);
    }

    public function test_dismiss_is_scoped_to_authenticated_student_and_invalidates_cache(): void
    {
        [$user] = $this->student();
        [$other] = $this->student('other@example.com');
        $insight = app(StudentDashboardInsightService::class)->for($user, true);

        $this->actingAs($user)->postJson(route('dashboard.academic-insight.dismiss'), [
            'fingerprint' => $insight['fingerprint'],
            'type' => $insight['type'],
            'priority' => $insight['priority'],
            'version' => $insight['version'],
        ])->assertOk();

        $this->assertDatabaseHas('academic_insight_states', [
            'user_id' => $user->id,
            'fingerprint' => $insight['fingerprint'],
        ]);
        $this->assertDatabaseMissing('academic_insight_states', [
            'user_id' => $other->id,
            'fingerprint' => $insight['fingerprint'],
        ]);

        $fresh = app(StudentDashboardInsightService::class)->for($user, true);
        $this->assertTrue($fresh['dismissed']);
    }

    public function test_tracking_rejects_a_forged_insight_fingerprint(): void
    {
        [$user] = $this->student();

        $this->actingAs($user)->postJson(route('dashboard.academic-insight.track'), [
            'fingerprint' => str_repeat('a', 64),
            'type' => 'positive_status',
            'priority' => 'low',
            'version' => (string) config('academic_insights.version'),
            'event' => 'insight_action_clicked',
        ])->assertConflict();

        $this->assertDatabaseMissing('student_activity_logs', [
            'user_id' => $user->id,
            'action' => 'insight_action_clicked',
        ]);
    }

    public function test_cart_sync_invalidates_cached_insight(): void
    {
        Cache::setDefaultDriver('array');
        [$user, $major] = $this->student();
        $service = app(StudentDashboardInsightService::class);
        $before = $service->for($user, true);
        $course = $this->course($major);

        $this->actingAs($user)->postJson(route('cart.sync'), [
            'course_ids' => [$course->id],
        ])->assertOk();

        $user->unsetRelation('cartCourses');
        $after = $service->for($user);

        $this->assertNotSame($before['generated_at'], $after['generated_at']);
    }

    private function student(string $email = 'student@example.com'): array
    {
        $college = College::create(['name' => 'كلية الاختبار '.uniqid()]);
        $major = Major::withoutEvents(fn () => Major::create([
            'college_id' => $college->id,
            'name' => 'تخصص الاختبار '.uniqid(),
            'code' => strtoupper(substr(md5($email), 0, 5)),
        ]));
        $user = User::forceCreate([
            'name' => 'Test Student',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'student',
            'major_id' => $major->id,
            'study_plan_version' => 12,
            'email_verified_at' => now(),
        ]);

        return [$user, $major];
    }

    private function course(Major $major, array $overrides = []): Course
    {
        return Course::withoutEvents(fn () => Course::create(array_merge([
            'name' => 'مادة '.uniqid(),
            'code' => strtoupper(substr(uniqid(), -6)),
            'credit_hours' => 3,
            'difficulty_level' => 3,
            'type' => 'compulsory',
            'semester' => 1,
            'major_id' => $major->id,
            'college_id' => $major->college_id,
            'study_plan_version' => 12,
        ], $overrides)));
    }
}
