<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Models\Course;
use App\Models\User;
use App\Services\StudentAcademicContextService;
use App\Support\CourseEligibility;

/**
 * Everything about one course, from the student's own point of view: whether it
 * is open to them, what is missing if not, and what it unlocks.
 */
class GetCourseDetailsTool implements AiTool
{
    use BuildsToolResults;

    public function __construct(private StudentAcademicContextService $context) {}

    public function name(): string
    {
        return 'get_course_details';
    }

    public function description(): string
    {
        return 'تفاصيل مادة واحدة: ساعاتها، متطلباتها، ما تفتحه، وحالتها لهذا الطالب.';
    }

    public function parameters(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => ['course_id' => ['type' => 'INTEGER']],
            'required' => ['course_id'],
        ];
    }

    public function run(User $user, array $arguments): array
    {
        $courseId = (int) ($arguments['course_id'] ?? 0);
        if ($courseId <= 0) {
            return $this->fail('missing_course_id', 'يجب تحديد رقم المادة.');
        }

        $context = $this->context->for($user);

        // Visibility check before the read: the course must belong to this
        // student's plan (available, locked or already in their cart/record).
        if (!array_key_exists($courseId, $context['course_names'])
            && !in_array($courseId, array_column($context['locked_courses'], 'id'), true)
            && !in_array($courseId, array_map('intval', $context['profile']['passed_course_ids'] ?? []), true)) {
            return $this->fail('course_not_visible', 'هذه المادة ليست ضمن خطة الطالب.');
        }

        $course = Course::with(['prerequisites:id,name', 'children:id,name'])->find($courseId);
        if (!$course) {
            return $this->fail('course_not_found', 'لا توجد مادة بهذا الرقم.');
        }

        $passedIds = array_map('intval', $context['profile']['passed_course_ids'] ?? []);
        $passedHours = (int) ($context['profile']['total_passed_hours'] ?? 0);

        $missingPrerequisites = $course->prerequisites
            ->reject(fn ($prerequisite) => in_array($prerequisite->id, $passedIds, true))
            ->pluck('name')
            ->values()
            ->all();

        $minimumHours = CourseEligibility::minimumPassedHoursForCourse($course);
        $lockedByHours = $minimumHours !== null && $passedHours < $minimumHours;

        return $this->ok([
            'id' => $course->id,
            'name' => $course->name,
            'code' => $course->code,
            'credit_hours' => (int) $course->credit_hours,
            'type' => $course->type,
            'difficulty_level' => (int) ($course->difficulty_level ?? 3),
            'description' => $course->description,
            'prerequisites' => $course->prerequisites->pluck('name')->all(),
            'unlocks' => $course->children->pluck('name')->all(),
            'student_status' => [
                'is_passed' => in_array($course->id, $passedIds, true),
                'is_in_cart' => in_array($course->id, array_map('intval', $context['cart']['ids'] ?? []), true),
                'is_open' => $missingPrerequisites === [] && !$lockedByHours,
                'missing_prerequisites' => $missingPrerequisites,
                'minimum_passed_hours' => $minimumHours,
                'locked_by_hours' => $lockedByHours,
            ],
        ], [[
            'type' => 'study_plan',
            'label' => 'خطتك الدراسية',
            'entity_ids' => [$course->id],
        ]]);
    }
}
