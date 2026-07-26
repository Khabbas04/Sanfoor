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

        // 2. Validate the remove list. The parser normalises it to remove_course_ids;
        // courses_to_remove is still accepted because that is the key documented to
        // the model in config/ai.php.
        $removeKey = !empty($validated['remove_course_ids']) ? 'remove_course_ids' : 'courses_to_remove';
        if (!empty($validated[$removeKey])) {
            $cartIds = array_map('intval', $ragData['cart']['ids'] ?? []);
            $validRemove = [];

            foreach ((array) $validated[$removeKey] as $id) {
                if (in_array((int)$id, $cartIds, true)) {
                    $validRemove[] = (int)$id;
                } else {
                    Log::warning("AI Hallucinated Remove ID: {$id}");
                }
            }
            $validated[$removeKey] = $validRemove;
        }

        // 2.5 Validate courses_to_add. These ids are WRITTEN to the student's cart,
        // so a hallucinated one must never reach the database: keep only courses the
        // student is actually eligible to register, that aren't already in the cart,
        // and only while the resulting cart stays inside the term hour limit.
        if (!empty($validated['courses_to_add'])) {
            $hoursById = [];
            foreach ($ragData['available_courses'] ?? [] as $ac) {
                $hoursById[(int) ($ac['id'] ?? 0)] = (int) ($ac['credit_hours'] ?? 0);
            }

            $cartIds = array_map('intval', $ragData['cart']['ids'] ?? []);
            $projectedHours = (int) ($rules['cart_hours'] ?? 0);
            $limit = (int) ($rules['effective_limit'] ?? 18);
            $validAdd = [];

            foreach ((array) $validated['courses_to_add'] as $id) {
                $id = (int) $id;

                if ($id <= 0 || in_array($id, $cartIds, true)) {
                    continue;
                }
                if (!isset($hoursById[$id])) {
                    Log::warning("AI Hallucinated Add ID: {$id}");
                    continue;
                }
                if ($projectedHours + $hoursById[$id] > $limit) {
                    $validated['warning'] = "تنبيه: ما أضفت كل المواد المطلوبة لأن ذلك كان يتجاوز الحد المسموح لك ({$limit} ساعة).";
                    continue;
                }

                $projectedHours += $hoursById[$id];
                $validAdd[] = $id;
            }
            $validated['courses_to_add'] = $validAdd;
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
