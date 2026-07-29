<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * The richer widgets, built by the application rather than emitted by the model.
 *
 * The six original widgets are asked of the model and then sanitised. Adding nine
 * more shapes to that contract would mean nine more chances for the model to
 * invent a course name, a date or a number — on top of an enforced responseSchema
 * that is already large enough to cost the envelope its widget when it truncates.
 *
 * So these are assembled here from data that has already been validated: tool
 * results, the retrieval context, and the existing planner. The model writes the
 * prose; the application draws the widget. Nothing here can hallucinate.
 *
 * The legacy `interactive_widget` is untouched and still rendered first; these go
 * out alongside it in an additive `widgets` array.
 */
class AiWidgetBuilder
{
    /** Never overwhelm the reply with panels. */
    private const MAX_WIDGETS = 3;

    public function __construct(private AcademicPathPlannerService $planner) {}

    /**
     * @param array $routed        AiIntentRouterService output (may be null-ish)
     * @param array $toolResults   AiToolRegistry::runPlan()['results'], keyed by tool
     * @param array $sources       merged sources for this answer
     * @param array $context       ['rules' => array, 'completeness' => array]
     * @return list<array{type: string}>
     */
    public function build(User $user, ?array $routed, array $toolResults, array $sources = [], array $context = [], ?array $prebuiltPlan = null): array
    {
        if ($routed === null) {
            return [];
        }

        $intent = (string) ($routed['intent'] ?? 'unknown');
        $widgets = [];

        // A question we could not read gets a question back, not a guess.
        if (!empty($routed['requires_clarification'])) {
            $widgets[] = $this->clarification($intent);
        }

        foreach ($this->fromTools($toolResults) as $widget) {
            $widgets[] = $widget;
        }

        // The plan is normally built BEFORE the model is called (so the reply can be
        // written around it instead of proposing a competing list) and handed back
        // here. Building it now is the fallback for callers that did not.
        if ($prebuiltPlan !== null) {
            $widgets[] = $prebuiltPlan;
        } else {
            foreach ($this->planFor($user, $intent, $context) as $widget) {
                $widgets[] = $widget;
            }
        }

        $widgets = array_slice(array_values(array_filter($widgets)), 0, self::MAX_WIDGETS);

        // Citations are a footer, not a panel, so they do not use up a slot.
        if ($sources !== []) {
            $widgets[] = ['type' => 'sources', 'sources' => $sources];
        }

        return $widgets;
    }

    /** Widgets that follow directly from a verified tool result. */
    private function fromTools(array $toolResults): array
    {
        $widgets = [];

        foreach ($toolResults as $name => $result) {
            if (!is_array($result)) {
                continue;
            }

            $data = $result['data'] ?? [];

            switch ($name) {
                case 'get_course_details':
                    if (($result['ok'] ?? false) && !empty($data['id'])) {
                        $widgets[] = $this->courseCard($data);
                    }
                    break;

                case 'calculate_gpa_goal':
                    if (($result['ok'] ?? false) && ($data['grounded'] ?? false)) {
                        $widgets[] = $this->gpaGoal($data);
                    }
                    break;

                case 'search_campus_directory':
                    if (($result['ok'] ?? false) && !empty($data['matched'])) {
                        $widgets[] = $this->campusPlace($data['matched']);
                    }
                    break;

                case 'get_calendar_events':
                    // A timeline is only drawn from real events. With no calendar
                    // source the honest referral belongs in the text, not in a
                    // panel that looks like data.
                    if (($result['ok'] ?? false) && !empty($data['events'])) {
                        $widgets[] = $this->calendarTimeline($data['events']);
                    }
                    break;
            }
        }

        return $widgets;
    }

    /**
     * The plan panel for this question, if the question calls for one.
     *
     * Plans come from AcademicPathPlannerService, which validates every roadmap it
     * produces against a prerequisite simulation. What is added here is the
     * student's CURRENT cart: the planner proposes a full term from scratch, so
     * without this it would offer a 9-hour summer plan to a student who already has
     * 3 hours registered — and applying it would immediately breach their limit.
     *
     * @return list<array>
     */
    public function planFor(User $user, string $intent, array $context = []): array
    {
        $goal = match ($intent) {
            'semester_planning' => 'balanced',
            'graduation_planning' => 'fastest_graduation',
            default => null,
        };

        if ($goal === null) {
            return [];
        }

        $rules = $context['rules'] ?? [];
        $cartIds = array_map('intval', $context['cart']['ids'] ?? []);
        $cartHours = (int) ($context['cart']['hours'] ?? 0);
        $limit = (int) ($rules['effective_limit'] ?? 18);

        // Nothing left to plan: the student is already at their ceiling.
        $allowance = $limit - $cartHours;
        if ($allowance < 1) {
            return [];
        }

        try {
            // The FULL limit is requested, not the remaining allowance: the planner
            // does not know about the cart, so it may well propose a course the
            // student has already registered. Asking for the whole term and then
            // removing the cart courses (and trimming to the real allowance in
            // semesterPlan()) leaves the student with a full term either way —
            // asking for the allowance alone produced a half-empty plan whenever a
            // cart course happened to be picked.
            $path = $this->planner->generate($user, $goal, false, $limit);
        } catch (\Throwable $e) {
            // A blocked or unvalidatable plan is not shown at all: a wrong roadmap
            // is worse for a student than no roadmap.
            Log::warning('Plan widget skipped: ' . $e->getMessage());

            return [];
        }

        if (($path['status'] ?? '') !== 'ready' || empty($path['current_semester'])) {
            return [];
        }

        $widget = $intent === 'graduation_planning'
            ? $this->graduationRoadmap($path)
            : $this->semesterPlan($path, $cartIds, $cartHours, $limit);

        // Every proposed course was already in the cart, so the panel would repeat
        // the student's own schedule back at them.
        if ($intent === 'semester_planning' && $widget['courses'] === []) {
            return [];
        }

        return [$widget];
    }

    private function courseCard(array $course): array
    {
        $status = $course['student_status'] ?? [];

        return [
            'type' => 'course_card',
            'course_id' => (int) $course['id'],
            'name' => (string) $course['name'],
            'credit_hours' => (int) ($course['credit_hours'] ?? 0),
            'difficulty' => (int) ($course['difficulty_level'] ?? 3),
            'course_type' => $course['type'] ?? null,
            'prerequisites' => array_values((array) ($course['prerequisites'] ?? [])),
            'unlocks' => array_values((array) ($course['unlocks'] ?? [])),
            'state' => match (true) {
                (bool) ($status['is_passed'] ?? false) => 'passed',
                (bool) ($status['is_in_cart'] ?? false) => 'in_cart',
                (bool) ($status['is_open'] ?? false) => 'open',
                default => 'locked',
            },
            'missing_prerequisites' => array_values((array) ($status['missing_prerequisites'] ?? [])),
            'minimum_passed_hours' => $status['minimum_passed_hours'] ?? null,
        ];
    }

    private function gpaGoal(array $data): array
    {
        return [
            'type' => 'gpa_goal',
            'current_gpa' => $data['current_gpa'] ?? null,
            'target_gpa' => $data['target_gpa'] ?? null,
            'planned_hours' => (int) ($data['planned_hours'] ?? 0),
            'passed_hours' => (int) ($data['passed_hours'] ?? 0),
            'required_term_average' => $data['required_term_average'] ?? null,
            'reachable' => (bool) ($data['reachable_this_term'] ?? false),
            'max_possible' => $data['max_possible_this_term'] ?? null,
            // The existing deterministic forecast chart, reused as-is.
            'forecast' => $data['forecast'] ?? null,
        ];
    }

    private function campusPlace(array $place): array
    {
        return [
            'type' => 'campus_place',
            'place_id' => (int) ($place['id'] ?? 0),
            'name' => (string) ($place['name'] ?? ''),
            'place_type' => $place['type'] ?? null,
            'description' => $place['description'] ?? null,
            'building_location' => $place['building_location'] ?? null,
            'maps_url' => $place['maps_url'] ?? null,
        ];
    }

    private function calendarTimeline(array $events): array
    {
        return [
            'type' => 'calendar_timeline',
            'events' => array_values(array_map(fn ($event) => [
                'title' => (string) ($event['title'] ?? ''),
                'date' => (string) ($event['date'] ?? ''),
                'note' => $event['note'] ?? null,
            ], array_slice($events, 0, 8))),
        ];
    }

    private function semesterPlan(array $path, array $cartIds, int $cartHours, int $limit): array
    {
        $semester = $path['current_semester'];

        $courses = [];
        $proposedHours = 0;

        foreach ($semester['courses'] ?? [] as $course) {
            $id = (int) $course['id'];
            $hours = (int) $course['credit_hours'];

            // Already registered, so it is not a proposal.
            if (in_array($id, $cartIds, true)) {
                continue;
            }
            // A zero-hour entry adds nothing and only makes the panel noisier.
            if ($hours < 1) {
                continue;
            }
            // Never propose past the student's real remaining allowance.
            if ($cartHours + $proposedHours + $hours > $limit) {
                continue;
            }

            $proposedHours += $hours;
            $courses[] = [
                'course_id' => $id,
                'name' => (string) $course['name'],
                'credit_hours' => $hours,
                'difficulty' => (int) ($course['difficulty_level'] ?? 3),
                'priority' => $course['priority'] ?? null,
                'reason' => $course['reason'] ?? null,
                // What sets this course apart, so the student can compare the rows
                // instead of trusting the order they are in.
                'advantages' => $course['advantages'] ?? [],
            ];
        }

        return [
            'type' => 'semester_plan',
            'title' => (string) ($semester['label'] ?? 'خطة الفصل المقترحة'),
            'proposed_hours' => $proposedHours,
            'cart_hours' => $cartHours,
            // The total the student would end up on, which is the number that has to
            // sit under the limit — not the proposal in isolation.
            'total_hours' => $cartHours + $proposedHours,
            'hour_limit' => $limit,
            'workload_level' => $semester['workload_level'] ?? null,
            'courses' => $courses,
            'summary' => $path['summary']['message'] ?? null,
            // The action the student may take on this plan; execution still goes
            // through confirmation and re-validation against fresh data.
            'apply_action' => [
                'action' => 'apply_semester_plan',
                'course_ids' => array_column($courses, 'course_id'),
            ],
        ];
    }

    private function graduationRoadmap(array $path): array
    {
        $semesters = array_merge([$path['current_semester']], $path['roadmap'] ?? []);

        return [
            'type' => 'graduation_roadmap',
            'title' => 'مسارك حتى التخرج',
            'semesters' => array_values(array_map(fn ($semester) => [
                'label' => (string) ($semester['label'] ?? ''),
                'is_prediction' => (bool) ($semester['is_prediction'] ?? false),
                'total_hours' => (int) ($semester['total_hours'] ?? 0),
                'courses' => array_values(array_map(fn ($course) => [
                    'course_id' => (int) $course['id'],
                    'name' => (string) $course['name'],
                    'credit_hours' => (int) $course['credit_hours'],
                ], $semester['courses'] ?? [])),
            ], $semesters)),
            'summary' => $path['summary']['message'] ?? null,
        ];
    }

    private function clarification(string $intent): array
    {
        return [
            'type' => 'clarification',
            'question' => 'حتى أعطيك جواباً دقيقاً، أي واحد تقصد؟',
            // First person: the student presses one and it is sent as their message.
            'options' => match ($intent) {
                'unknown', 'general_question' => [
                    ['label' => 'شو المواد المناسبة لي هذا الفصل؟', 'value' => 'course_recommendation'],
                    ['label' => 'كيف أرفع معدلي؟', 'value' => 'gpa_goal'],
                    ['label' => 'راجع تسجيلي التجريبي', 'value' => 'cart_review'],
                    ['label' => 'كم باقي لي حتى التخرج؟', 'value' => 'graduation_planning'],
                ],
                default => [
                    ['label' => 'أقصد وضعي الحالي هذا الفصل', 'value' => 'current_term'],
                    ['label' => 'أقصد خطتي حتى التخرج', 'value' => 'graduation'],
                ],
            },
        ];
    }
}
