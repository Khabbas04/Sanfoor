<?php

namespace App\Engines;

use App\Models\User;

class RiskPredictionEngine
{
    /**
     * Evaluate the academic risk of the current cart.
     *
     * @param User $user
     * @param array $cartCourses The courses currently in the cart
     * @param array $academicRules The student's academic data (GPA, limits, etc.)
     * @return array Array of risk warnings (strings)
     */
    public function evaluate(User $user, array $cartCourses, array $academicRules): array
    {
        $warnings = [];
        $gpaPercentage = $academicRules['gpa_percentage'] ?? 0;
        $totalPassedHours = $academicRules['total_passed_hours'] ?? 0;
        $cartHours = $academicRules['cart_hours'] ?? 0;

        // Rule 1: High load for lower GPA
        if ($gpaPercentage > 0 && $gpaPercentage < 65 && $cartHours > 12) {
            $warnings[] = "⚠️ **خطر أكاديمي:** الطالب معدله منخفض (" . round($gpaPercentage, 1) . "%)، وتنزيل {$cartHours} ساعة سيزيد من احتمالية الرسوب وانخفاض المعدل. ينصح بتخفيف العبء إلى 12 ساعة كحد أقصى.";
        }

        // Rule 2: High difficulty concentration
        $highDifficultyCount = 0;
        $programmingMathCount = 0;
        $courseNames = [];

        foreach ($cartCourses as $course) {
            $courseNames[] = $course['name'] ?? 'مادة';
            $difficulty = (int) ($course['difficulty_level'] ?? 3);
            if ($difficulty >= 4) {
                $highDifficultyCount++;
            }

            // Simple heuristic to detect heavy logic courses
            $name = $course['name'] ?? '';
            if (str_contains($name, 'برمج') || str_contains($name, 'رياضي') || str_contains($name, 'خوارزم') || str_contains($name, 'بيانات')) {
                $programmingMathCount++;
            }
        }

        if ($highDifficultyCount >= 2) {
            $warnings[] = "⚠️ **خطر أكاديمي:** السلة تحتوي على {$highDifficultyCount} مواد ذات مستوى صعوبة مرتفع جداً (4 أو أكثر). هذا المزيج يتطلب جهداً خرافياً ويشكل عبئاً ذهنياً قد يؤدي لتدني العلامات.";
        }

        if ($programmingMathCount >= 3) {
            $warnings[] = "⚠️ **خطر أكاديمي:** تنزيل {$programmingMathCount} مواد برمجية ورياضية في نفس الفصل يرفع العبء المنطقي والعملي بشكل هائل. ينصح بتبديل إحداها بمادة اختيارية أو متطلب جامعة.";
        }

        // Rule 3: Probation risk
        if ($academicRules['is_probation'] ?? false) {
            $warnings[] = "🚨 **إنذار أكاديمي:** الطالب حالياً تحت الإنذار الأكاديمي. يجب توجيهه لاختيار أسهل المواد المتاحة، ويفضل إعادة المواد التي رسب بها لرفع المعدل وتجنب الفصل.";
        }

        // Return empty if no risks found, otherwise prefix with context
        if (empty($warnings)) {
            return [];
        }

        return $warnings;
    }
}
