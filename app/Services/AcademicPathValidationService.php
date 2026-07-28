<?php

namespace App\Services;

use App\Models\Course;
use App\Models\User;
use App\Support\CourseEligibility;

class AcademicPathValidationService
{
    public function validate(User $user, array $semesters, array $initialPassedIds, int $initialPassedHours): array
    {
        $courseIds = collect($semesters)->pluck('courses')->flatten(1)->pluck('id')->map('intval')->unique()->values();
        $courses = Course::query()
            ->withoutGlobalScopes()
            ->with('prerequisites:id')
            ->whereIn('id', $courseIds)
            ->get()
            ->keyBy('id');

        $passed = array_fill_keys(array_map('intval', $initialPassedIds), true);
        $seen = [];
        $passedHours = $initialPassedHours;
        $errors = [];

        foreach ($semesters as $semesterIndex => $semester) {
            $hours = 0;
            $semesterIds = [];

            foreach ($semester['courses'] ?? [] as $plannedCourse) {
                $id = (int) ($plannedCourse['id'] ?? 0);
                $course = $courses->get($id);

                if (!$course) {
                    $errors[] = ['semester' => $semesterIndex + 1, 'course_id' => $id, 'code' => 'course_not_found'];
                    continue;
                }
                if (!$this->belongsToStudentPlan($course, $user)) {
                    $errors[] = ['semester' => $semesterIndex + 1, 'course_id' => $id, 'code' => 'outside_student_plan'];
                }
                if (isset($passed[$id]) || isset($seen[$id])) {
                    $errors[] = ['semester' => $semesterIndex + 1, 'course_id' => $id, 'code' => 'duplicate_or_passed'];
                }

                $missing = $course->prerequisites
                    ->pluck('id')
                    ->map('intval')
                    ->reject(fn (int $prerequisiteId) => isset($passed[$prerequisiteId]))
                    ->values()
                    ->all();
                if ($missing) {
                    $errors[] = [
                        'semester' => $semesterIndex + 1,
                        'course_id' => $id,
                        'code' => 'missing_prerequisites',
                        'missing_ids' => $missing,
                    ];
                }
                if (CourseEligibility::isLockedByPassedHours($course, $passedHours)) {
                    $errors[] = ['semester' => $semesterIndex + 1, 'course_id' => $id, 'code' => 'minimum_hours_not_met'];
                }

                $hours += (int) $course->credit_hours;
                $semesterIds[] = $id;
            }

            $limit = (int) ($semester['hour_limit'] ?? 18);
            if ($hours > $limit) {
                $errors[] = [
                    'semester' => $semesterIndex + 1,
                    'code' => 'semester_hours_exceeded',
                    'hours' => $hours,
                    'limit' => $limit,
                ];
            }

            if (!collect($errors)->contains(fn (array $error) => ($error['semester'] ?? null) === $semesterIndex + 1)) {
                foreach ($semesterIds as $id) {
                    $seen[$id] = true;
                    $passed[$id] = true;
                    $passedHours += (int) $courses->get($id)->credit_hours;
                }
            }
        }

        return [
            'valid' => $errors === [],
            'checked_rules' => [
                'prerequisites',
                'minimum_passed_hours',
                'semester_hour_limit',
                'plan_membership',
                'duplicate_courses',
            ],
            'errors' => $errors,
            'warnings' => [],
        ];
    }

    private function belongsToStudentPlan(Course $course, User $user): bool
    {
        if ((int) $course->study_plan_version !== (int) $user->study_plan_version) {
            return false;
        }

        return $course->major_id === null || (int) $course->major_id === (int) $user->major_id;
    }
}
