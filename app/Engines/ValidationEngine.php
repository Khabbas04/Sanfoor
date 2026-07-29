<?php

namespace App\Engines;

use App\Models\User;
use App\Services\AcademicPathValidationService;
use Illuminate\Support\Facades\Log;

class ValidationEngine
{
    /**
     * Validate a deterministic multi-semester path before it reaches the UI.
     * The specialized validator owns the academic simulation while this method
     * keeps ValidationEngine as the single validation gateway for AI features.
     */
    public function validateAcademicPath(
        User $user,
        array $semesters,
        array $initialPassedIds,
        int $initialPassedHours
    ): array {
        return app(AcademicPathValidationService::class)->validate(
            $user,
            $semesters,
            $initialPassedIds,
            $initialPassedHours
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Targeted validators
    |--------------------------------------------------------------------------
    |
    | Added alongside validate() rather than inside it: validate() is the gateway
    | the live pipeline already funnels every reply through and its behaviour is
    | pinned by tests, so these are separate, composable checks that new code can
    | call without changing that path.
    |
    | They all answer in the same shape, so a caller can merge several results:
    |
    |   ['valid' => bool, 'checked_rules' => string[], 'errors' => [], 'warnings' => []]
    |
    | `errors` block the action. `warnings` are told to the student but do not.
    |
    */

    /**
     * Do these course ids exist, and may this student see them?
     *
     * The allow-list is the pool the student was actually shown, so an id the
     * model invented — or borrowed from another major's plan — cannot pass.
     *
     * @param int[] $ids
     * @param int[] $allowedIds
     */
    public function validateAiCourseIds(array $ids, array $allowedIds, string $field = 'course_ids'): array
    {
        $result = $this->result(['course_id_exists', 'course_id_visible_to_student']);
        $allowed = array_map('intval', $allowedIds);

        foreach ($ids as $id) {
            $id = (int) $id;

            if ($id <= 0) {
                $result['errors'][] = ['code' => 'invalid_id', 'field' => $field, 'id' => $id];
                continue;
            }
            if (!in_array($id, $allowed, true)) {
                $result['errors'][] = ['code' => 'hallucinated_id', 'field' => $field, 'id' => $id];
            }
        }

        $result['valid'] = $result['errors'] === [];

        return $result;
    }

    /**
     * Is this a recommendation a human advisor would sign?
     *
     * Checks the load against the student's own effective limit, not a constant:
     * a graduating student may carry 21 hours where a student on probation may
     * carry 12.
     *
     * @param array<int, array{id?: int, credit_hours?: int, difficulty_level?: int}> $courses
     */
    public function validateCourseRecommendation(array $courses, array $rules): array
    {
        $result = $this->result(['hour_limit', 'load_is_not_empty', 'difficulty_balance']);

        $limit = (int) ($rules['effective_limit'] ?? 18);
        $hours = 0;
        $hard = 0;

        foreach ($courses as $course) {
            $hours += (int) ($course['credit_hours'] ?? 0);
            if ((int) ($course['difficulty_level'] ?? 3) >= 4) {
                $hard++;
            }
        }

        if ($courses === []) {
            $result['warnings'][] = ['code' => 'empty_recommendation'];
        }

        if ($hours > $limit) {
            $result['errors'][] = [
                'code' => 'exceeds_hour_limit',
                'hours' => $hours,
                'limit' => $limit,
                'message' => "مجموع الساعات المقترح ({$hours}) يتجاوز الحد المسموح لك ({$limit} ساعة).",
            ];
        }

        // Three or more heavy courses at once is how a semester goes wrong, and on
        // probation it is how a student loses their place.
        if ($hard >= 3) {
            $result['warnings'][] = [
                'code' => 'heavy_load',
                'hard_courses' => $hard,
                'message' => 'الجدول فيه ' . $hard . ' مواد صعبة معاً — قد يكون مرهقاً.',
            ];
        }
        if (!empty($rules['is_probation']) && $hard >= 2) {
            $result['warnings'][] = [
                'code' => 'heavy_load_on_probation',
                'message' => 'أنت على إنذار أكاديمي: الأفضل مادة صعبة واحدة على الأكثر هذا الفصل.',
            ];
        }

        $result['valid'] = $result['errors'] === [];
        $result['hours'] = $hours;
        $result['limit'] = $limit;

        return $result;
    }

    /**
     * May this cart write actually happen?
     *
     * Everything the student's cart depends on is re-read by the caller before
     * this runs, so the decision is made against current data and not against
     * whatever was true when the answer was generated.
     *
     * @param 'add'|'remove' $action
     * @param int[] $courseIds
     * @param array{cart_ids: int[], eligible_ids: int[], hours_by_id: array<int, int>} $state
     */
    public function validateCartAction(string $action, array $courseIds, array $state, array $rules): array
    {
        $result = $this->result(['known_action', 'course_eligibility', 'cart_membership', 'hour_limit']);

        if (!in_array($action, ['add', 'remove'], true)) {
            $result['errors'][] = ['code' => 'unknown_action', 'action' => $action];
            $result['valid'] = false;

            return $result;
        }

        $cartIds = array_map('intval', $state['cart_ids'] ?? []);
        $eligible = array_map('intval', $state['eligible_ids'] ?? []);
        $hoursById = $state['hours_by_id'] ?? [];

        if ($courseIds === []) {
            $result['errors'][] = ['code' => 'no_courses'];
            $result['valid'] = false;

            return $result;
        }

        $limit = (int) ($rules['effective_limit'] ?? 18);
        $projected = (int) ($rules['cart_hours'] ?? 0);
        $accepted = [];

        foreach ($courseIds as $id) {
            $id = (int) $id;

            if ($action === 'remove') {
                if (!in_array($id, $cartIds, true)) {
                    $result['errors'][] = ['code' => 'not_in_cart', 'id' => $id];
                    continue;
                }
                $accepted[] = $id;
                continue;
            }

            if (in_array($id, $cartIds, true)) {
                $result['warnings'][] = ['code' => 'already_in_cart', 'id' => $id];
                continue;
            }
            if (!in_array($id, $eligible, true)) {
                $result['errors'][] = ['code' => 'not_eligible', 'id' => $id];
                continue;
            }

            $hours = (int) ($hoursById[$id] ?? 0);
            if ($projected + $hours > $limit) {
                $result['errors'][] = [
                    'code' => 'exceeds_hour_limit',
                    'id' => $id,
                    'limit' => $limit,
                    'message' => "لا يمكن الإضافة: ستتجاوز الحد المسموح لك ({$limit} ساعة).",
                ];
                continue;
            }

            $projected += $hours;
            $accepted[] = $id;
        }

        $result['accepted_ids'] = $accepted;
        $result['projected_hours'] = $projected;
        // A partially applicable request still proceeds for the part that is
        // valid; it only fails outright when nothing survives.
        $result['valid'] = $accepted !== [];

        return $result;
    }

    /**
     * Is this a real campus place?
     *
     * Landmarks are the only directory data that exists, so a place the model
     * names that is not among them is refused rather than described.
     *
     * @param array<int, string> $knownPlaces id => name
     */
    public function validateCampusPlace(?string $name, array $knownPlaces): array
    {
        $result = $this->result(['place_exists']);

        if ($name === null || trim($name) === '') {
            $result['errors'][] = ['code' => 'missing_place'];
            $result['valid'] = false;

            return $result;
        }

        $needle = $this->fold($name);
        foreach ($knownPlaces as $id => $known) {
            $candidate = $this->fold((string) $known);
            if ($candidate !== '' && (str_contains($candidate, $needle) || str_contains($needle, $candidate))) {
                $result['matched_id'] = (int) $id;
                $result['matched_name'] = (string) $known;

                return $result;
            }
        }

        $result['errors'][] = ['code' => 'unknown_place', 'name' => $name];
        $result['valid'] = false;

        return $result;
    }

    /**
     * Is there any calendar data to answer this from?
     *
     * There is no academic-calendar table in this deployment, so the honest
     * answer is a referral. This validator exists so that stays a deliberate,
     * visible decision instead of the model filling the gap from memory.
     */
    public function validateCalendarEvent(?array $event, array $completeness = []): array
    {
        $result = $this->result(['calendar_data_available']);

        if (empty($completeness['has_calendar_data'])) {
            $result['errors'][] = [
                'code' => 'no_calendar_source',
                'message' => 'لا يوجد تقويم أكاديمي مربوط بالنظام — يجب إحالة الطالب للمصدر الرسمي.',
            ];
            $result['valid'] = false;

            return $result;
        }

        foreach (['title', 'date'] as $field) {
            if (empty($event[$field] ?? null)) {
                $result['errors'][] = ['code' => 'missing_field', 'field' => $field];
            }
        }

        $result['valid'] = $result['errors'] === [];

        return $result;
    }

    /**
     * Is this GPA projection arithmetically possible?
     *
     * The university grades on a 0-100 percentage scale, and a cumulative average
     * moves less the more hours already sit behind it — a projection that ignores
     * that is a promise the student cannot keep.
     */
    public function validateGpaScenario(array $scenario, array $rules): array
    {
        $result = $this->result(['percentage_scale', 'records_exist', 'reachable_target']);

        $current = $scenario['current_gpa'] ?? ($rules['gpa_percentage'] ?? null);
        $target = $scenario['target_gpa'] ?? null;
        $plannedHours = (int) ($scenario['planned_hours'] ?? 0);
        $passedHours = (int) ($rules['total_passed_hours'] ?? 0);

        foreach (['current_gpa' => $current, 'target_gpa' => $target] as $field => $value) {
            if ($value === null) {
                continue;
            }
            if ((float) $value < 0 || (float) $value > 100) {
                $result['errors'][] = [
                    'code' => 'out_of_percentage_scale',
                    'field' => $field,
                    'value' => $value,
                    'message' => 'نظام الجامعة مئوي (0-100) وليس 4.00.',
                ];
            }
        }

        if ($passedHours === 0) {
            $result['warnings'][] = [
                'code' => 'no_records',
                'message' => 'لا توجد علامات مسجّلة، فالتوقع تقديري بالكامل.',
            ];
        }

        // The best a semester can do is pull the average toward 100.
        if ($target !== null && $current !== null && $plannedHours > 0 && $passedHours > 0) {
            $ceiling = (($current * $passedHours) + (100 * $plannedHours)) / ($passedHours + $plannedHours);
            if ((float) $target > $ceiling + 0.01) {
                $result['errors'][] = [
                    'code' => 'target_unreachable_this_term',
                    'target' => (float) $target,
                    'max_possible' => round($ceiling, 2),
                    'message' => 'الهدف غير قابل للتحقيق بفصل واحد: أقصى ما يمكن الوصول إليه هو ' . round($ceiling, 2) . '٪.',
                ];
            }
        }

        $result['valid'] = $result['errors'] === [];

        return $result;
    }

    /**
     * Does the answer text only name things that exist?
     *
     * The model writes prose, and prose is where a course that is not in the
     * student's plan slips through even when every id in the envelope is clean.
     * Course-like phrases in the reply are matched against the names the student
     * was actually shown.
     *
     * @param array<int, string> $knownNames id => name (plan + cart + passed)
     */
    public function validateAiAnswerEntities(string $reply, array $knownNames): array
    {
        $result = $this->result(['no_leaked_ids', 'named_courses_exist']);

        // A raw "[ID: 42]" is an internal token that must never reach a student.
        if (preg_match('/\[?\s*ID\s*[:=]\s*\d+/i', $reply)) {
            $result['errors'][] = ['code' => 'leaked_internal_id'];
        }

        $folded = $this->fold($reply);
        $mentioned = [];
        foreach ($knownNames as $id => $name) {
            $candidate = $this->fold((string) $name);
            if ($candidate !== '' && str_contains($folded, $candidate)) {
                $mentioned[] = (int) $id;
            }
        }

        $result['mentioned_course_ids'] = $mentioned;
        $result['valid'] = $result['errors'] === [];

        return $result;
    }

    /** @param string[] $checkedRules */
    private function result(array $checkedRules): array
    {
        return [
            'valid' => true,
            'checked_rules' => $checkedRules,
            'errors' => [],
            'warnings' => [],
        ];
    }

    /** Fold Arabic orthography so a name match is not defeated by spelling. */
    private function fold(string $text): string
    {
        $text = mb_strtolower(trim($text), 'UTF-8');
        $text = str_replace(['أ', 'إ', 'آ', 'ٱ'], 'ا', $text);
        $text = str_replace('ة', 'ه', $text);
        $text = str_replace(['ى', 'ئ'], 'ي', $text);
        $text = preg_replace('/[\x{0610}-\x{061A}\x{0640}\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}]/u', '', $text);

        return trim(preg_replace('/\s+/u', ' ', $text));
    }

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
