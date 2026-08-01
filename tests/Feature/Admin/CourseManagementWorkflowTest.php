<?php

namespace Tests\Feature\Admin;

use App\Models\Course;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\Feature\Ai\AdvisorTestCase;

class CourseManagementWorkflowTest extends AdvisorTestCase
{
    public function test_admin_can_create_a_course_through_json_without_reloading_the_page(): void
    {
        [, $major] = $this->student('course-workflow-student@example.com');
        $admin = $this->admin('course-workflow-admin@example.com');
        $prerequisite = $this->course($major, ['code' => 'CS100', 'study_plan_version' => 12]);

        $this->actingAs($admin)
            ->postJson(route('admin.courses.store'), [
                'name' => 'هندسة البرمجيات',
                'code' => 'CS200',
                'credit_hours' => 3,
                'difficulty_level' => 3,
                'minimum_passed_hours' => null,
                'type' => 'compulsory',
                'major_id' => $major->id,
                'study_plan_version' => 12,
                'semester' => 4,
                'prerequisite_ids' => [$prerequisite->id],
                'description' => 'مادة تطبيقية.',
            ])
            ->assertCreated()
            ->assertJsonPath('course.code', 'CS200')
            ->assertJsonPath('course.major_id', $major->id)
            ->assertJsonCount(1, 'course.prerequisites');

        $course = Course::query()->where('code', 'CS200')->firstOrFail();
        $this->assertDatabaseHas('course_prerequisites', [
            'course_id' => $course->id,
            'prerequisite_id' => $prerequisite->id,
        ]);
    }

    public function test_bulk_upsert_returns_an_immediate_report_and_preserves_courses_missing_from_the_file(): void
    {
        [, $major] = $this->student('bulk-course-student@example.com');
        $admin = $this->admin('bulk-course-admin@example.com');
        $existing = $this->course($major, ['code' => 'CS101', 'name' => 'الاسم القديم', 'study_plan_version' => 12]);
        $untouched = $this->course($major, ['code' => 'CS999', 'name' => 'مادة لا تظهر في الملف', 'study_plan_version' => 12]);

        $this->actingAs($admin)
            ->postJson(route('admin.courses.import'), [
                'major_id' => $major->id,
                'study_plan_version' => 12,
                'import_mode' => 'upsert',
                'rows_payload' => [
                    [
                        'code' => 'CS101',
                        'name' => 'مقدمة البرمجة',
                        'credit_hours' => 3,
                        'mappedType' => 'compulsory',
                        'semester' => 1,
                    ],
                    [
                        'code' => 'CS201',
                        'name' => 'البرمجة المتقدمة',
                        'credit_hours' => 3,
                        'mappedType' => 'compulsory',
                        'semester' => 2,
                        'prerequisites' => 'CS101',
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('result.created', 1)
            ->assertJsonPath('result.updated', 1)
            ->assertJsonPath('result.skipped', 0)
            ->assertJsonCount(2, 'result.courses');

        $newCourse = Course::query()->where('code', 'CS201')->where('major_id', $major->id)->firstOrFail();
        $this->assertDatabaseHas('courses', ['id' => $existing->id, 'name' => 'مقدمة البرمجة']);
        $this->assertDatabaseHas('courses', ['id' => $untouched->id]);
        $this->assertDatabaseHas('course_prerequisites', [
            'course_id' => $newCourse->id,
            'prerequisite_id' => $existing->id,
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'user_id' => $admin->id,
            'action' => 'IMPORT_COURSES',
        ]);
    }

    public function test_bulk_import_reports_duplicate_codes_instead_of_writing_them_twice(): void
    {
        [, $major] = $this->student('duplicate-course-student@example.com');
        $admin = $this->admin('duplicate-course-admin@example.com');

        $this->actingAs($admin)
            ->postJson(route('admin.courses.import'), [
                'major_id' => $major->id,
                'study_plan_version' => 12,
                'rows_payload' => [
                    ['code' => 'CS301', 'name' => 'المادة الأولى'],
                    ['code' => 'cs301', 'name' => 'المادة المكررة'],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('result.created', 1)
            ->assertJsonPath('result.skipped', 1)
            ->assertJsonPath('result.errors.0.line', 3);

        $this->assertSame(1, Course::query()->where('code', 'CS301')->where('major_id', $major->id)->count());
    }

    private function admin(string $email): User
    {
        return User::forceCreate([
            'name' => 'مدير المواد',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);
    }
}
