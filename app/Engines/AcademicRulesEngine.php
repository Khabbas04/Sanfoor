<?php

namespace App\Engines;

use App\Models\User;
use App\Models\AcademicPeriod;

class AcademicRulesEngine
{
    /*
     * The numbers themselves now live in config/academic_terms.php — one place for a
     * regulation that used to be duplicated here, in AiAdvisorController, in the
     * planner config, in the advisor prompt and as a literal in the frontend. The
     * accessors below are kept so existing callers keep working.
     */
    public static function maxHoursNormal(): int
    {
        return (int) config('academic_terms.limits.regular', 18);
    }

    public static function maxHoursProbation(): int
    {
        return (int) config('academic_terms.limits.probation', 12);
    }

    public static function maxHoursSummer(): int
    {
        return (int) config('academic_terms.limits.summer', 10);
    }

    /** @deprecated Read config('academic_terms.limits') instead. */
    public const MAX_HOURS_NORMAL = 18;
    /** @deprecated */
    public const MAX_HOURS_PROBATION = 12;
    /** @deprecated */
    public const MAX_HOURS_SUMMER_NORMAL = 9;
    /** @deprecated */
    public const MAX_HOURS_SUMMER_WITH_LAB = 10;
    /** @deprecated */
    public const MAX_HOURS_GRADUATING_NORMAL = 21;
    /** @deprecated */
    public const MAX_HOURS_GRADUATING_SUMMER = 12;
    /** @deprecated */
    public const GRADUATING_THRESHOLD_HOURS = 21;
    /** @deprecated */
    public const GRADUATING_SUMMER_THRESHOLD_HOURS = 12;

    public function evaluate(User $user, array $passedCoursesData, int $cartHours): array
    {
        $currentPeriod = AcademicPeriod::current();
        
        $isSummer = $currentPeriod?->isSummer() ?? false;
        $periodLabel = $currentPeriod ? "{$currentPeriod->academic_year} - الفصل {$currentPeriod->academic_term}" : 'غير محدد';
        
        $gpaData = $user->calculateGPA();
        $totalPassedHours = $passedCoursesData['total_passed_hours'] ?? 0;
        $totalPlanHours = $user->major && method_exists($user->major, 'getTotalHours') ? $user->major->getTotalHours() : 132;
        
        // Check Academic Probation (GPA < 60%)
        $hasAcademicRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
        $isProbation = $hasAcademicRecords && isset($gpaData['percentage']) && (float) $gpaData['percentage'] < 60;
        
        // Calculate remaining hours
        $remainingHours = max(0, $totalPlanHours - $totalPassedHours);
        
        // Graduation Status Check
        $thresholds = (array) config('academic_terms.graduating_threshold');
        $isGraduating = $remainingHours <= (int) ($isSummer ? $thresholds['summer'] : $thresholds['regular']);

        $limits = (array) config('academic_terms.limits');
        $academicLimit = $isProbation ? (int) $limits['probation'] : (int) $limits['regular'];
        $termLimit = (int) ($isSummer ? $limits['summer'] : $limits['regular']);

        // One authority for the ceiling, so the engine, the controller, the planner
        // and the prompt can never disagree about it again.
        $effectiveLimit = AcademicPeriod::maxHoursFor(
            $currentPeriod?->academic_term,
            $isProbation,
            $isGraduating
        );

        $cartExceedsLimit = $cartHours > $effectiveLimit;
        
        $studentYear = max(1, min(5, (int) ceil($totalPassedHours / 33)));
        $studentSemester = max(1, min(10, (int) floor($totalPassedHours / 16) + 1));
        $studentYearLabels = [1 => 'أولى', 2 => 'ثانية', 3 => 'ثالثة', 4 => 'رابعة', 5 => 'خامسة'];
        
        $isFirstSemester = $totalPassedHours === 0;

        // What comes next, so the advisor can plan beyond this term without guessing
        // the order — and knows the next term may carry a different ceiling.
        $nextTerm = $currentPeriod?->nextTerm();
        $nextLimit = $nextTerm === null
            ? null
            : AcademicPeriod::maxHoursFor($nextTerm['academic_term'], $isProbation, $isGraduating);

        return [
            'period_label' => $periodLabel,
            'is_summer' => $isSummer,
            'next_term' => $nextTerm,
            'next_term_limit' => $nextLimit,
            'term_sequence_note' => $nextTerm === null
                ? 'الفصل الحالي غير محدد في النظام.'
                : "الفصل الحالي {$periodLabel}، والذي يليه {$nextTerm['label']} {$nextTerm['academic_year']} وحده الأقصى {$nextLimit} ساعة.",
            'gpa_percentage' => $gpaData['percentage'] ?? 0,
            'total_passed_hours' => $totalPassedHours,
            'total_plan_hours' => $totalPlanHours,
            'remaining_hours' => $remainingHours,
            'is_probation' => $isProbation,
            'is_graduating' => $isGraduating,
            'is_first_semester' => $isFirstSemester,
            'academic_limit' => $academicLimit,
            'term_limit' => $termLimit,
            'effective_limit' => $effectiveLimit,
            'cart_hours' => $cartHours,
            'cart_exceeds_limit' => $cartExceedsLimit,
            'excess_hours' => $cartExceedsLimit ? ($cartHours - $effectiveLimit) : 0,
            'student_year' => $studentYear,
            'student_semester' => $studentSemester,
            'student_year_label' => $studentYearLabels[$studentYear] ?? 'أولى',
            'progress_percent' => $totalPlanHours > 0 ? round(($totalPassedHours / $totalPlanHours) * 100) : 0,
        ];
    }
}
