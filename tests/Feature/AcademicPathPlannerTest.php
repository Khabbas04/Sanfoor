<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use App\Services\AcademicPathPlannerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AcademicPathPlannerTest extends TestCase
{
    use RefreshDatabase;

    public function test_fastest_path_prioritizes_available_bottleneck_and_validates_the_roadmap(): void
    {
        [$user, $major] = $this->student();
        $bottleneck = $this->course($major, ['name' => 'هياكل البيانات', 'difficulty_level' => 4]);
        foreach (range(1, 4) as $index) {
            $child = $this->course($major, ['name' => "خوارزمية {$index}", 'semester' => 2]);
            $child->prerequisites()->attach($bottleneck->id);
        }
        $this->course($major, ['name' => 'مادة سهلة', 'difficulty_level' => 1, 'type' => 'elective']);

        $path = app(AcademicPathPlannerService::class)->generate($user, 'fastest_graduation', true);

        $this->assertSame('ready', $path['status']);
        $this->assertTrue($path['validation']['valid']);
        $this->assertSame($bottleneck->id, $path['current_semester']['courses'][0]['id']);
        $this->assertGreaterThanOrEqual(4, $path['summary']['unlocks_count']);
    }

    public function test_planner_never_suggests_a_course_with_unmet_prerequisites(): void
    {
        [$user, $major] = $this->student();
        $prerequisite = $this->course($major, ['name' => 'البرمجة الأولى']);
        $locked = $this->course($major, ['name' => 'البرمجة المتقدمة', 'semester' => 2]);
        $locked->prerequisites()->attach($prerequisite->id);

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);
        $firstIds = collect($path['current_semester']['courses'])->pluck('id')->all();

        $this->assertContains($prerequisite->id, $firstIds);
        $this->assertNotContains($locked->id, $firstIds);
        $this->assertTrue($path['validation']['valid']);
    }

    public function test_reduce_pressure_limits_hard_courses_and_load(): void
    {
        [$user, $major] = $this->student();
        foreach (range(1, 5) as $index) {
            $this->course($major, [
                'name' => "مادة صعبة {$index}",
                'difficulty_level' => 5,
                'credit_hours' => 3,
            ]);
        }
        $this->course($major, ['name' => 'مادة خفيفة', 'difficulty_level' => 1, 'credit_hours' => 3]);

        $path = app(AcademicPathPlannerService::class)->generate($user, 'reduce_pressure', true);
        $courses = collect($path['current_semester']['courses']);

        $this->assertLessThanOrEqual(12, $path['current_semester']['total_hours']);
        $this->assertLessThanOrEqual(1, $courses->where('difficulty_level', '>=', 4)->count());
    }

    public function test_api_uses_authenticated_student_and_rejects_invalid_goal(): void
    {
        [$user] = $this->student();

        $this->actingAs($user)
            ->postJson(route('academic-path-planner.generate'), ['goal' => 'balanced', 'student_id' => 9999])
            ->assertOk()
            ->assertJsonPath('path.goal.id', 'balanced')
            ->assertJsonPath('path.validation.valid', true);

        $this->actingAs($user)
            ->postJson(route('academic-path-planner.generate'), ['goal' => 'invented'])
            ->assertUnprocessable();
    }

    public function test_course_from_another_major_is_never_included(): void
    {
        [$user, $major] = $this->student();
        [, $otherMajor] = $this->student('other@example.com');
        $own = $this->course($major, ['name' => 'مادة التخصص']);
        $other = $this->course($otherMajor, ['name' => 'مادة تخصص آخر']);

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);
        $allIds = collect([$path['current_semester'], ...$path['roadmap']])->pluck('courses')->flatten(1)->pluck('id');

        $this->assertContains($own->id, $allIds);
        $this->assertNotContains($other->id, $allIds);
    }

    public function test_circular_prerequisites_return_a_controlled_blocked_state(): void
    {
        [$user, $major] = $this->student();
        $first = $this->course($major, ['name' => 'دورة أ']);
        $second = $this->course($major, ['name' => 'دورة ب']);
        $first->prerequisites()->attach($second->id);
        $second->prerequisites()->attach($first->id);

        $path = app(AcademicPathPlannerService::class)->generate($user, 'balanced', true);

        $this->assertSame('blocked', $path['status']);
        $this->assertFalse($path['validation']['valid']);
        $this->assertNull($path['current_semester']);
    }

    private function student(string $email = 'planner@example.com'): array
    {
        $college = College::create(['name' => 'كلية '.uniqid()]);
        $major = Major::withoutEvents(fn () => Major::create([
            'college_id' => $college->id,
            'name' => 'تخصص '.uniqid(),
            'code' => strtoupper(substr(md5($email), 0, 5)),
        ]));
        $user = User::forceCreate([
            'name' => 'Planner Student',
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
