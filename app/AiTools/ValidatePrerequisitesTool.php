<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Engines\ValidationEngine;
use App\Models\User;
use App\Services\StudentAcademicContextService;

/**
 * "Can I actually register these?" answered by ValidationEngine, so the advisor
 * and the tree page cannot disagree about the same student.
 */
class ValidatePrerequisitesTool implements AiTool
{
    use BuildsToolResults;

    public function __construct(
        private StudentAcademicContextService $context,
        private ValidationEngine $validator,
    ) {}

    public function name(): string
    {
        return 'validate_prerequisites';
    }

    public function description(): string
    {
        return 'التحقق من أن الطالب مؤهل فعلاً لتسجيل مواد محددة، ومجموع ساعاتها ضمن حدّه.';
    }

    public function parameters(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'course_ids' => ['type' => 'ARRAY', 'items' => ['type' => 'INTEGER'], 'maxItems' => 8],
            ],
            'required' => ['course_ids'],
        ];
    }

    public function run(User $user, array $arguments): array
    {
        $ids = array_map('intval', (array) ($arguments['course_ids'] ?? []));
        if ($ids === []) {
            return $this->fail('no_courses', 'لم تُحدَّد أي مادة للتحقق.');
        }

        $context = $this->context->for($user);
        $available = $context['available_courses'];
        $eligibleIds = array_map(fn ($course) => (int) $course['id'], $available);

        $idCheck = $this->validator->validateAiCourseIds($ids, array_keys($context['course_names']));

        $open = [];
        $blocked = [];

        foreach ($ids as $id) {
            $course = collect($available)->firstWhere('id', $id);
            if ($course !== null) {
                $open[] = ['id' => $id, 'name' => $course['name'], 'credit_hours' => (int) $course['credit_hours']];
                continue;
            }

            $locked = collect($context['locked_courses'])->firstWhere('id', $id);
            $blocked[] = [
                'id' => $id,
                'name' => $locked['name'] ?? ($context['course_names'][$id] ?? null),
                // The locked pool already carries the human-readable reasons.
                'reasons' => $locked['reasons'] ?? ['غير متاحة لك حالياً'],
            ];
        }

        $load = $this->validator->validateCourseRecommendation($open, $context['rules']);

        return $this->ok(
            [
                'open' => $open,
                'blocked' => $blocked,
                'all_open' => $blocked === [] && $idCheck['valid'],
                'hours' => $load['hours'],
                'limit' => $load['limit'],
                'within_limit' => $load['valid'],
                'validation' => [
                    'ids' => $idCheck,
                    'load' => $load,
                ],
            ],
            $eligibleIds === [] ? [] : [[
                'type' => 'study_plan',
                'label' => 'خطتك الدراسية ومتطلباتها',
                'entity_ids' => $ids,
            ]],
            $load['warnings']
        );
    }
}
