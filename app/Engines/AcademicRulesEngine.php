<?php

namespace App\Engines;

use App\Models\User;
use App\Models\AcademicPeriod;

class AcademicRulesEngine
{
    // Constants for University Rules
    public const MAX_HOURS_NORMAL = 18;
    public const MAX_HOURS_PROBATION = 12;
    public const MAX_HOURS_SUMMER_NORMAL = 9;
    public const MAX_HOURS_SUMMER_WITH_LAB = 10;
    
    // Graduating student exceptions
    public const MAX_HOURS_GRADUATING_NORMAL = 21;
    public const MAX_HOURS_GRADUATING_SUMMER = 12;
    public const GRADUATING_THRESHOLD_HOURS = 21;
    public const GRADUATING_SUMMER_THRESHOLD_HOURS = 12;

    public function evaluate(User $user, array $passedCoursesData, int $cartHours): array
    {
        $currentPeriod = AcademicPeriod::current();
        
        $isSummer = $currentPeriod ? ((int) $currentPeriod->academic_term === 3) : false;
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
        $isGraduatingNormal = !$isSummer && $remainingHours <= self::GRADUATING_THRESHOLD_HOURS;
        $isGraduatingSummer = $isSummer && $remainingHours <= self::GRADUATING_SUMMER_THRESHOLD_HOURS;
        $isGraduating = $isGraduatingNormal || $isGraduatingSummer;

        // Base Academic Limit
        $academicLimit = $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL;
        
        // Base Term Limit
        $termLimit = $isSummer ? self::MAX_HOURS_SUMMER_NORMAL : self::MAX_HOURS_NORMAL;
        
        // Calculate Effective Limit with Exceptions
        $effectiveLimit = min($academicLimit, $termLimit);
        
        if ($isGraduating) {
            $effectiveLimit = $isSummer ? self::MAX_HOURS_GRADUATING_SUMMER : self::MAX_HOURS_GRADUATING_NORMAL;
        }

        // Summer lab exception (if not graduating)
        if ($isSummer && !$isGraduating && $cartHours == self::MAX_HOURS_SUMMER_WITH_LAB) {
            // NOTE: In a full implementation, we'd check if the cart actually contains a 1-hour lab course
            // For now, if the cart is exactly 10 in summer, we allow the UI to reflect it as a possible exception
            $effectiveLimit = self::MAX_HOURS_SUMMER_WITH_LAB;
        }

        $cartExceedsLimit = $cartHours > $effectiveLimit;
        
        $studentYear = max(1, min(5, (int) ceil($totalPassedHours / 33)));
        $studentYearLabels = [1 => 'أولى', 2 => 'ثانية', 3 => 'ثالثة', 4 => 'رابعة', 5 => 'خامسة'];
        
        $isFirstSemester = $totalPassedHours === 0;

        return [
            'period_label' => $periodLabel,
            'is_summer' => $isSummer,
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
            'student_year_label' => $studentYearLabels[$studentYear] ?? 'أولى',
            'progress_percent' => $totalPlanHours > 0 ? round(($totalPassedHours / $totalPlanHours) * 100) : 0,
        ];
    }
}
