<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Engines\DeterministicWidgetEngine;
use App\Engines\RiskPredictionEngine;
use App\Engines\ValidationEngine;
use App\Models\Course;
use App\Models\User;
use App\Services\StudentAcademicContextService;

/**
 * Read-only review of the student's trial registration.
 *
 * Nothing here writes: the cart review is a judgement, and changing the cart is
 * a separate, confirmed action.
 */
class ReviewCartTool implements AiTool
{
    use BuildsToolResults;

    public function __construct(
        private StudentAcademicContextService $context,
        private DeterministicWidgetEngine $widgets,
        private ValidationEngine $validator,
        private RiskPredictionEngine $risk,
    ) {}

    public function name(): string
    {
        return 'review_cart';
    }

    public function description(): string
    {
        return 'مراجعة التسجيل التجريبي الحالي: الساعات، التوازن، والمخاطر الأكاديمية فيه.';
    }

    public function parameters(): array
    {
        return ['type' => 'OBJECT', 'properties' => []];
    }

    public function run(User $user, array $arguments): array
    {
        $context = $this->context->for($user);
        $rules = $context['rules'];
        $cartIds = array_map('intval', $context['cart']['ids'] ?? []);

        if ($cartIds === []) {
            return $this->ok([
                'is_empty' => true,
                'hours' => 0,
                'limit' => (int) ($rules['effective_limit'] ?? 18),
                'message' => 'التسجيل التجريبي فارغ حالياً.',
            ]);
        }

        $courses = Course::whereIn('id', $cartIds)->get(['id', 'name', 'code', 'credit_hours', 'difficulty_level']);

        $load = $this->validator->validateCourseRecommendation(
            $courses->map(fn ($course) => [
                'id' => $course->id,
                'credit_hours' => (int) $course->credit_hours,
                'difficulty_level' => (int) ($course->difficulty_level ?? 3),
            ])->all(),
            $rules
        );

        $risks = $this->risk->evaluate($user, $courses->map->toArray()->all(), $rules);

        return $this->ok(
            [
                'is_empty' => false,
                'courses' => $courses->map(fn ($course) => [
                    'id' => $course->id,
                    'name' => $course->name,
                    'credit_hours' => (int) $course->credit_hours,
                    'difficulty_level' => (int) ($course->difficulty_level ?? 3),
                ])->all(),
                'hours' => $load['hours'],
                'limit' => $load['limit'],
                'within_limit' => $load['valid'],
                'exceeds_by' => max(0, $load['hours'] - $load['limit']),
                'risks' => $risks,
                'widget' => $this->widgets->cartReview($courses, $rules),
                'validation' => $load,
            ],
            [['type' => 'cart', 'label' => 'تسجيلك التجريبي', 'entity_ids' => $cartIds]],
            $load['warnings']
        );
    }
}
