<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Engines\DeterministicWidgetEngine;
use App\Engines\ValidationEngine;
use App\Models\User;
use App\Services\StudentAcademicContextService;

/**
 * What would it take to reach a target GPA?
 *
 * Arithmetic belongs here rather than in the model: a cumulative average moves
 * less the more hours already sit behind it, and a projection that ignores that
 * is a promise the student cannot keep. The forecast itself is the existing
 * deterministic widget.
 */
class CalculateGpaGoalTool implements AiTool
{
    use BuildsToolResults;

    public function __construct(
        private StudentAcademicContextService $context,
        private ValidationEngine $validator,
        private DeterministicWidgetEngine $widgets,
    ) {}

    public function name(): string
    {
        return 'calculate_gpa_goal';
    }

    public function description(): string
    {
        return 'حساب ما يحتاجه الطالب للوصول إلى معدل تراكمي مستهدف، وهل هو ممكن هذا الفصل.';
    }

    public function parameters(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'target_gpa' => ['type' => 'NUMBER', 'description' => 'المعدل المستهدف من 0 إلى 100'],
                'planned_hours' => ['type' => 'INTEGER', 'description' => 'ساعات الفصل المخطط لها'],
            ],
            'required' => ['target_gpa'],
        ];
    }

    public function run(User $user, array $arguments): array
    {
        $context = $this->context->for($user);
        $rules = $context['rules'];

        $target = isset($arguments['target_gpa']) ? (float) $arguments['target_gpa'] : null;
        $plannedHours = (int) ($arguments['planned_hours'] ?? 0)
            ?: (int) ($context['cart']['hours'] ?? 0)
            ?: (int) ($rules['effective_limit'] ?? 15);

        $current = (float) ($rules['gpa_percentage'] ?? 0);
        $passedHours = (int) ($rules['total_passed_hours'] ?? 0);

        $validation = $this->validator->validateGpaScenario([
            'current_gpa' => $current,
            'target_gpa' => $target,
            'planned_hours' => $plannedHours,
        ], $rules);

        // Without recorded grades there is no cumulative average to move.
        if (!($context['completeness']['has_academic_records'] ?? false)) {
            return $this->ok([
                'current_gpa' => null,
                'target_gpa' => $target,
                'grounded' => false,
                'message' => 'لا توجد علامات مسجّلة بعد، فلا يمكن حساب معدل تراكمي — على الطالب إدخال علاماته في شجرة المواد أولاً.',
                'validation' => $validation,
            ], [], $validation['warnings']);
        }

        $requiredAverage = null;
        if ($target !== null && $plannedHours > 0) {
            // ((current × passed) + (x × planned)) / (passed + planned) = target
            $requiredAverage = (($target * ($passedHours + $plannedHours)) - ($current * $passedHours)) / $plannedHours;
            $requiredAverage = round($requiredAverage, 2);
        }

        $forecast = $this->widgets->gpaForecast($rules, $plannedHours, $target);

        return $this->ok([
            'current_gpa' => round($current, 2),
            'target_gpa' => $target,
            'passed_hours' => $passedHours,
            'planned_hours' => $plannedHours,
            'required_term_average' => $requiredAverage,
            'reachable_this_term' => $validation['valid'],
            'max_possible_this_term' => $validation['errors'][0]['max_possible'] ?? null,
            'forecast' => $forecast,
            'grounded' => true,
            'validation' => $validation,
        ], [
            ['type' => 'transcript', 'label' => 'سجلك الأكاديمي وعلاماتك', 'entity_ids' => []],
            ['type' => 'academic_rules', 'label' => 'أنظمة الساعات والحدود', 'entity_ids' => []],
        ], $validation['warnings']);
    }
}
