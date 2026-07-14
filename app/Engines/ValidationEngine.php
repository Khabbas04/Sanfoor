<?php

namespace App\Engines;

use Illuminate\Support\Facades\Log;

class ValidationEngine
{
    /**
     * Validate and sanitize Gemini's response.
     */
    public function validate(array $geminiResponse, array $ragData, array $rules): array
    {
        $validated = $geminiResponse;
        
        // Ensure format is safe
        if (!isset($validated['reply'])) {
            $validated['reply'] = 'عذراً، حدث خطأ في معالجة الرد.';
        }

        // 1. Validate suggested_course_ids
        if (!empty($validated['suggested_course_ids'])) {
            $availableIds = array_column($ragData['available_courses'] ?? [], 'id');
            $validSuggested = [];
            
            foreach ((array) $validated['suggested_course_ids'] as $id) {
                if (in_array((int)$id, $availableIds)) {
                    $validSuggested[] = (int)$id;
                } else {
                    Log::warning("AI Hallucinated Suggestion ID: {$id}");
                }
            }
            $validated['suggested_course_ids'] = $validSuggested;
        }

        // 2. Validate courses_to_remove
        if (!empty($validated['courses_to_remove'])) {
            $cartIds = $ragData['cart']['ids'] ?? [];
            $validRemove = [];
            
            foreach ((array) $validated['courses_to_remove'] as $id) {
                if (in_array((int)$id, $cartIds)) {
                    $validRemove[] = (int)$id;
                } else {
                    Log::warning("AI Hallucinated Remove ID: {$id}");
                }
            }
            $validated['courses_to_remove'] = $validRemove;
        }

        // 3. Overflow check
        $currentCartHours = $rules['cart_hours'] ?? 0;
        $effectiveLimit = $rules['effective_limit'] ?? 18;
        
        $addedHours = 0;
        if (!empty($validated['suggested_course_ids'])) {
            // Find hours for suggested courses
            foreach ($ragData['available_courses'] as $ac) {
                if (in_array($ac['id'], $validated['suggested_course_ids'])) {
                    $addedHours += $ac['credit_hours'];
                }
            }
        }
        
        $removedHours = 0;
        if (!empty($validated['courses_to_remove'])) {
            // Can't easily find hours of removed courses here without querying, 
            // but we can at least warn if strictly adding exceeds.
        }

        if (($currentCartHours + $addedHours - $removedHours) > $effectiveLimit) {
            $validated['warning'] = "تنبيه: تطبيق هذه التعديلات قد يتجاوز الحد المسموح لك ({$effectiveLimit} ساعة).";
        }

        return $validated;
    }
}
