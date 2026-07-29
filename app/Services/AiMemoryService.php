<?php

namespace App\Services;

use App\Models\StudentAiPreference;
use App\Models\User;

/**
 * The advisor's academic memory — five explicit decisions, and nothing else.
 *
 * What this deliberately does NOT do: read past messages. Treating a conversation
 * as memory means a student's offhand remark comes back at them weeks later as a
 * standing preference they never set, and they have no way to correct it. Only
 * things they stated outright are kept, each one is shown back to them with the
 * reason it was used, and one button clears the lot.
 *
 * Everything here is behind ai.features.memory. With the flag off nothing is read
 * and nothing is written.
 */
class AiMemoryService
{
    /** Goals worth remembering, mapped from the detected intent. */
    private const GOALS = [
        'gpa_goal' => 'raise_gpa',
        'gpa_analysis' => 'raise_gpa',
        'graduation_planning' => 'graduate_faster',
        'semester_planning' => 'balanced_semester',
    ];

    private const GOAL_LABELS = [
        'raise_gpa' => 'رفع المعدل التراكمي',
        'graduate_faster' => 'تسريع التخرج',
        'balanced_semester' => 'فصل متوازن',
    ];

    private const LOAD_LABELS = [
        'easy' => 'مواد أخف',
        'balanced' => 'حمل متوازن',
        'hard' => 'مواد أثقل',
    ];

    public function enabled(): bool
    {
        return (bool) config('ai.features.memory');
    }

    public function for(User $user): ?StudentAiPreference
    {
        if (!$this->enabled()) {
            return null;
        }

        return StudentAiPreference::where('user_id', $user->id)->first();
    }

    /**
     * Record what the student stated in this turn.
     *
     * Only fields actually present are written, so one question about the GPA does
     * not wipe the load preference they set last week.
     *
     * @param array $routed  AiIntentRouterService output
     * @param array $request the validated chat request (difficulty, etc.)
     */
    public function remember(User $user, ?array $routed, array $request = []): void
    {
        if (!$this->enabled() || $routed === null) {
            return;
        }

        $updates = [];

        $goal = self::GOALS[$routed['intent'] ?? ''] ?? null;
        if ($goal !== null) {
            $updates['active_goal'] = $goal;
        }

        $entities = $routed['entities'] ?? [];
        if (!empty($entities['gpa_target'])) {
            $updates['gpa_target'] = (float) $entities['gpa_target'];
        }
        if (!empty($entities['hours'])) {
            $updates['preferred_load'] = (int) $entities['hours'];
        }

        // The difficulty toggle is an explicit UI choice, not an inference.
        if (!empty($request['difficulty'])) {
            $updates['difficulty_preference'] = (string) $request['difficulty'];
        }

        if ($updates === []) {
            return;
        }

        StudentAiPreference::updateOrCreate(['user_id' => $user->id], $updates);
    }

    /** Record a plan the student actually applied, so a follow-up can refer to it. */
    public function rememberApprovedPlan(User $user, array $courses): void
    {
        if (!$this->enabled() || $courses === []) {
            return;
        }

        StudentAiPreference::updateOrCreate(['user_id' => $user->id], [
            'last_approved_plan' => [
                'course_ids' => array_values(array_map('intval', array_column($courses, 'id'))),
                'names' => array_values(array_filter(array_column($courses, 'name'))),
                // Stamped by the caller's clock, not the model's.
                'applied_at' => now()->toISOString(),
            ],
        ]);
    }

    public function forget(User $user): void
    {
        StudentAiPreference::where('user_id', $user->id)->delete();
    }

    /**
     * The memory block for the system prompt.
     *
     * Framed as preferences the student stated, with an explicit instruction that
     * current academic data still wins — a remembered 15-hour preference must not
     * override a 9-hour summer cap.
     */
    public function promptBlock(User $user): string
    {
        $preference = $this->for($user);
        if ($preference === null) {
            return '';
        }

        $lines = [];

        if ($preference->active_goal) {
            $lines[] = '- هدفه المعلن: ' . (self::GOAL_LABELS[$preference->active_goal] ?? $preference->active_goal);
        }
        if ($preference->gpa_target) {
            $lines[] = '- المعدل الذي يستهدفه: ' . rtrim(rtrim(number_format($preference->gpa_target, 2), '0'), '.') . '٪';
        }
        if ($preference->preferred_load) {
            $lines[] = '- عدد الساعات الذي يفضّله: ' . $preference->preferred_load . ' ساعة';
        }
        if ($preference->difficulty_preference) {
            $lines[] = '- تفضيله للصعوبة: ' . (self::LOAD_LABELS[$preference->difficulty_preference] ?? $preference->difficulty_preference);
        }
        if (!empty($preference->last_approved_plan['names'])) {
            $lines[] = '- آخر خطة وافق عليها فعلاً: ' . implode('، ', array_slice($preference->last_approved_plan['names'], 0, 6));
        }

        if ($lines === []) {
            return '';
        }

        return "=== 🧠 تفضيلات الطالب المحفوظة ===\n"
            . "هذه تفضيلات صرّح بها الطالب سابقاً — راعِها في نصيحتك دون أن تفترض أنها لا تزال دقيقة، واسأله إن بدا أنها تغيّرت.\n"
            . "⛔ قواعد الجامعة وبيانات الطالب الحالية في هذا السياق تسبق هذه التفضيلات دائماً: لا تتجاوز حد الساعات ولا تقترح مادة غير متاحة لمجرد أنها تناسب تفضيلاً محفوظاً.\n"
            . implode("\n", $lines) . "\n\n";
    }

    /**
     * What the student sees: exactly what is stored, and why it was used.
     *
     * @return array{enabled: bool, has_memory: bool, items: list<array{key: string, label: string, value: string, why: string}>, updated_at: ?string}
     */
    public function disclosure(User $user): array
    {
        if (!$this->enabled()) {
            return ['enabled' => false, 'has_memory' => false, 'items' => [], 'updated_at' => null];
        }

        $preference = $this->for($user);
        if ($preference === null) {
            return ['enabled' => true, 'has_memory' => false, 'items' => [], 'updated_at' => null];
        }

        $items = [];

        if ($preference->active_goal) {
            $items[] = [
                'key' => 'active_goal',
                'label' => 'هدفك الحالي',
                'value' => self::GOAL_LABELS[$preference->active_goal] ?? $preference->active_goal,
                'why' => 'يُستخدم لترتيب المواد المقترحة حسب هدفك.',
            ];
        }
        if ($preference->gpa_target) {
            $items[] = [
                'key' => 'gpa_target',
                'label' => 'المعدل المستهدف',
                'value' => rtrim(rtrim(number_format($preference->gpa_target, 2), '0'), '.') . '٪',
                'why' => 'يُستخدم لحساب ما تحتاجه كل فصل للوصول إليه.',
            ];
        }
        if ($preference->preferred_load) {
            $items[] = [
                'key' => 'preferred_load',
                'label' => 'الساعات المفضّلة',
                'value' => $preference->preferred_load . ' ساعة',
                'why' => 'يُستخدم كنقطة بداية عند اقتراح جدولك.',
            ];
        }
        if ($preference->difficulty_preference) {
            $items[] = [
                'key' => 'difficulty_preference',
                'label' => 'تفضيل الصعوبة',
                'value' => self::LOAD_LABELS[$preference->difficulty_preference] ?? $preference->difficulty_preference,
                'why' => 'يُستخدم لموازنة صعوبة المواد المقترحة.',
            ];
        }
        if (!empty($preference->last_approved_plan['names'])) {
            $items[] = [
                'key' => 'last_approved_plan',
                'label' => 'آخر خطة طبّقتها',
                'value' => implode('، ', array_slice($preference->last_approved_plan['names'], 0, 4)),
                'why' => 'يُستخدم حتى لا يعيد اقتراح ما طبّقته فعلاً.',
            ];
        }

        return [
            'enabled' => true,
            'has_memory' => $items !== [],
            'items' => $items,
            'updated_at' => $preference->updated_at?->toISOString(),
        ];
    }
}
