<?php

namespace Tests\Feature\Admin;

use App\Models\Course;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Feature\Ai\AdvisorTestCase;

class DemandReportManagementTest extends AdvisorTestCase
{
    public function test_report_uses_only_the_current_period_and_keeps_real_courses_separate(): void
    {
        [$firstStudent, $major] = $this->student('first-demand@example.com');
        $secondStudent = $this->studentInMajor($major->id, 'second-demand@example.com');
        $oldStudent = $this->studentInMajor($major->id, 'old-demand@example.com');
        $admin = $this->admin();
        $this->currentPeriod(1, '2026');

        $firstCourse = $this->course($major, ['name' => 'برمجة متقدمة', 'code' => 'CS401', 'credit_hours' => 3]);
        $secondCourse = $this->course($major, ['name' => 'برمجة متقدمة', 'code' => 'CS402', 'credit_hours' => 4]);

        $this->cartRow($firstStudent, $firstCourse, '2026', 1);
        $this->cartRow($secondStudent, $firstCourse, '2026', 1);
        $this->cartRow($firstStudent, $secondCourse, '2026', 1);
        $this->cartRow($oldStudent, $secondCourse, '2025', 3);

        $this->actingAs($admin)
            ->get(route('admin.reports.demand'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Reports/Demand')
                ->has('courseDemand', 2)
                ->where('courseDemand.0.id', $firstCourse->id)
                ->where('courseDemand.0.cart_users_count', 2)
                ->where('courseDemand.1.id', $secondCourse->id)
                ->where('courseDemand.1.cart_users_count', 1)
                ->where('summary.total_students', 2)
                ->where('summary.total_selections', 3)
                ->where('summary.demanded_courses', 2)
                ->where('summary.average_courses_per_student', 1.5)
                ->where('summary.average_hours_per_student', 5)
                ->where('report.period.academic_term', 1)
                ->where('report.period.max_hours', 18)
            );
    }

    public function test_admin_can_open_the_students_behind_a_course_demand_number(): void
    {
        [$student, $major] = $this->student('listed-demand@example.com', [
            'portal_student_id' => '20261234',
            'portal_gpa' => 84.5,
            'portal_passed_hours' => 72,
        ]);
        $admin = $this->admin('student-list-admin@example.com');
        $this->currentPeriod(1, '2026');
        $course = $this->course($major, ['code' => 'CS311', 'credit_hours' => 3]);
        $otherCourse = $this->course($major, ['code' => 'CS312', 'credit_hours' => 4]);
        $this->cartRow($student, $course, '2026', 1);
        $this->cartRow($student, $otherCourse, '2026', 1);

        $this->actingAs($admin)
            ->getJson(route('admin.reports.demand.students', $course))
            ->assertOk()
            ->assertJsonPath('course.id', $course->id)
            ->assertJsonCount(1, 'students')
            ->assertJsonPath('students.0.id', $student->id)
            ->assertJsonPath('students.0.email', 'listed-demand@example.com')
            ->assertJsonPath('students.0.student_number', '20261234')
            ->assertJsonPath('students.0.cart_courses_count', 2)
            ->assertJsonPath('students.0.cart_hours', 7);
    }

    public function test_removing_a_student_registration_is_period_scoped_and_audited(): void
    {
        [$currentStudent, $major] = $this->student('remove-demand@example.com');
        $oldStudent = $this->studentInMajor($major->id, 'keep-old-demand@example.com');
        $admin = $this->admin('remove-demand-admin@example.com');
        $this->currentPeriod(1, '2026');
        $course = $this->course($major, ['code' => 'CS450']);
        $this->cartRow($currentStudent, $course, '2026', 1);
        $this->cartRow($oldStudent, $course, '2025', 3);

        $this->actingAs($admin)
            ->deleteJson(route('admin.reports.demand.students.destroy', [$course, $currentStudent]))
            ->assertOk()
            ->assertJsonPath('message', 'تمت إزالة تسجيل الطالب من المادة.');

        $this->assertDatabaseMissing('user_carts', [
            'user_id' => $currentStudent->id,
            'course_id' => $course->id,
        ]);
        $this->assertDatabaseHas('user_carts', [
            'user_id' => $oldStudent->id,
            'course_id' => $course->id,
            'academic_year' => '2025',
            'academic_term' => 3,
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'user_id' => $admin->id,
            'action' => 'REMOVE_DEMAND_REGISTRATION',
        ]);

        $this->actingAs($admin)
            ->deleteJson(route('admin.reports.demand.students.destroy', [$course, $oldStudent]))
            ->assertNotFound();

        $this->assertDatabaseHas('user_carts', [
            'user_id' => $oldStudent->id,
            'course_id' => $course->id,
        ]);
    }

    public function test_students_cannot_access_demand_management_endpoints(): void
    {
        [$student, $major] = $this->student('forbidden-demand@example.com');
        $course = $this->course($major);

        $this->actingAs($student)
            ->get(route('admin.reports.demand'))
            ->assertRedirect('/');

        $this->actingAs($student)
            ->get(route('admin.reports.demand.students', $course))
            ->assertRedirect('/');
    }

    private function cartRow(User $student, Course $course, string $year, int $term): void
    {
        DB::table('user_carts')->insert([
            'user_id' => $student->id,
            'course_id' => $course->id,
            'academic_year' => $year,
            'academic_term' => $term,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function studentInMajor(int $majorId, string $email): User
    {
        return User::forceCreate([
            'name' => 'طالب الطلب',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'student',
            'major_id' => $majorId,
            'study_plan_version' => 12,
            'email_verified_at' => now(),
        ]);
    }

    private function admin(string $email = 'demand-admin@example.com'): User
    {
        return User::forceCreate([
            'name' => 'مدير الطلب',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);
    }
}
