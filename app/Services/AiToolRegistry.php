<?php

namespace App\Services;

use App\AiTools\AiTool;
use App\AiTools\CalculateGpaGoalTool;
use App\AiTools\GetCalendarEventsTool;
use App\AiTools\GetCourseDetailsTool;
use App\AiTools\ReviewCartTool;
use App\AiTools\SearchCampusDirectoryTool;
use App\AiTools\SearchCoursesTool;
use App\AiTools\ValidatePrerequisitesTool;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * The tools the advisor is allowed to use, and the only way it may use them.
 *
 * Every tool wraps a service that already owns its rule, so nothing here
 * duplicates business logic. The registry adds what a tool must never be trusted
 * to do for itself:
 *
 *   - an allow-list, so a name the model invented cannot be executed
 *   - a per-student boundary: tools only ever run for the authenticated user
 *   - failure containment: a broken tool returns an error envelope, never an
 *     exception that takes the whole reply down with it
 *   - an audit trail of what was called with what
 */
class AiToolRegistry
{
    /**
     * The allow-list. A tool that is not in this map does not exist as far as the
     * advisor is concerned, whatever the model asks for.
     *
     * @var array<string, class-string<AiTool>>
     */
    private const TOOLS = [
        'search_courses' => SearchCoursesTool::class,
        'get_course_details' => GetCourseDetailsTool::class,
        'validate_prerequisites' => ValidatePrerequisitesTool::class,
        'calculate_gpa_goal' => CalculateGpaGoalTool::class,
        'review_cart' => ReviewCartTool::class,
        'get_calendar_events' => GetCalendarEventsTool::class,
        'search_campus_directory' => SearchCampusDirectoryTool::class,
    ];

    /**
     * Which tools are worth offering for a given intent.
     *
     * Narrowing the list is not cosmetic: a shorter, relevant tool list is what
     * keeps a small model from calling something unrelated.
     */
    private const BY_INTENT = [
        'course_question' => ['get_course_details', 'search_courses'],
        'course_recommendation' => ['search_courses', 'validate_prerequisites'],
        'semester_planning' => ['search_courses', 'validate_prerequisites', 'review_cart'],
        'graduation_planning' => ['search_courses', 'validate_prerequisites'],
        'prerequisite_check' => ['validate_prerequisites', 'get_course_details'],
        'gpa_analysis' => ['calculate_gpa_goal', 'review_cart'],
        'gpa_goal' => ['calculate_gpa_goal'],
        'calendar_question' => ['get_calendar_events'],
        'compare_courses' => ['get_course_details', 'search_courses'],
        'cart_review' => ['review_cart', 'validate_prerequisites'],
        'campus_location' => ['search_campus_directory'],
        // No data source exists for these, and the tool that says so is the point.
        'instructor_question' => ['get_calendar_events'],
        'section_question' => ['get_calendar_events'],
    ];

    /** @var array<int, array{tool: string, ok: bool, arguments: array, error: ?string}> */
    private array $callLog = [];

    /** @return list<string> */
    public function names(): array
    {
        return array_keys(self::TOOLS);
    }

    public function has(string $name): bool
    {
        return array_key_exists($name, self::TOOLS);
    }

    public function get(string $name): ?AiTool
    {
        if (!$this->has($name)) {
            return null;
        }

        return app(self::TOOLS[$name]);
    }

    /** @return list<string> Tool names worth offering for this intent. */
    public function namesForIntent(?string $intent): array
    {
        if ($intent === null) {
            return [];
        }

        return self::BY_INTENT[$intent] ?? [];
    }

    /**
     * Tool declarations in the shape Gemini's function-calling API expects.
     *
     * @param list<string>|null $only limit to these names (already allow-listed)
     */
    public function declarations(?array $only = null): array
    {
        $declarations = [];

        foreach (self::TOOLS as $name => $class) {
            if ($only !== null && !in_array($name, $only, true)) {
                continue;
            }

            $tool = app($class);
            $declarations[] = [
                'name' => $tool->name(),
                'description' => $tool->description(),
                'parameters' => $tool->parameters(),
            ];
        }

        return $declarations;
    }

    /**
     * Which tools to run for this question, and with what arguments.
     *
     * The advisor grounds its answer by running the relevant tools BEFORE the
     * model call and handing it the results as facts, rather than letting the
     * model drive a function-calling loop. That is deliberate:
     *
     *   - the reply contract is an enforced responseSchema, which does not
     *     combine with tool calls on this model
     *   - the streaming path could not survive a mid-generation round trip
     *   - a plan derived from the intent costs no extra request
     *
     * Only tools that can be called safely without the model choosing arguments
     * are planned here; anything needing a judgement call is left out.
     *
     * @param array{intent: string, entities: array} $routed AiIntentRouterService output
     * @return list<array{tool: string, arguments: array}>
     */
    public function plan(array $routed, string $message = ''): array
    {
        $intent = (string) ($routed['intent'] ?? 'unknown');
        $entities = $routed['entities'] ?? [];
        $courseIds = array_map('intval', $entities['course_ids'] ?? []);
        $plan = [];

        switch ($intent) {
            case 'cart_review':
            case 'gpa_analysis':
                $plan[] = ['tool' => 'review_cart', 'arguments' => []];
                break;

            case 'gpa_goal':
                $plan[] = ['tool' => 'calculate_gpa_goal', 'arguments' => array_filter([
                    'target_gpa' => $entities['gpa_target'] ?? null,
                    'planned_hours' => $entities['hours'] ?? null,
                ], fn ($value) => $value !== null)];
                break;

            case 'campus_location':
                $plan[] = ['tool' => 'search_campus_directory', 'arguments' => ['query' => $message]];
                break;

            case 'calendar_question':
            case 'instructor_question':
            case 'section_question':
                // Returns the honest "no source" answer, which is the instruction
                // the model needs in order not to invent a date or a lecturer.
                $plan[] = ['tool' => 'get_calendar_events', 'arguments' => []];
                break;

            case 'prerequisite_check':
                if ($courseIds !== []) {
                    $plan[] = ['tool' => 'validate_prerequisites', 'arguments' => ['course_ids' => $courseIds]];
                    // "What does this need?" is answered best by the course itself:
                    // its prerequisites, what it unlocks, and why it is closed.
                    foreach (array_slice($courseIds, 0, 2) as $courseId) {
                        $plan[] = ['tool' => 'get_course_details', 'arguments' => ['course_id' => $courseId]];
                    }
                }
                break;

            case 'course_question':
            case 'compare_courses':
                foreach (array_slice($courseIds, 0, 3) as $courseId) {
                    $plan[] = ['tool' => 'get_course_details', 'arguments' => ['course_id' => $courseId]];
                }
                break;

            case 'semester_planning':
                $plan[] = ['tool' => 'review_cart', 'arguments' => []];
                if ($courseIds !== []) {
                    $plan[] = ['tool' => 'validate_prerequisites', 'arguments' => ['course_ids' => $courseIds]];
                }
                break;
        }

        return $plan;
    }

    /**
     * Run a plan and turn the results into prompt-ready facts.
     *
     * @return array{facts: list<string>, sources: array, tools_called: list<string>, results: array}
     */
    public function runPlan(User $user, array $plan): array
    {
        $facts = [];
        $sources = [];
        $toolsCalled = [];
        $results = [];

        foreach ($plan as $step) {
            $name = (string) ($step['tool'] ?? '');
            $result = $this->call($user, $name, (array) ($step['arguments'] ?? []));

            $toolsCalled[] = $name;
            $results[$name] = $result;

            foreach ($result['sources'] as $source) {
                $sources[] = $source;
            }

            $facts[] = $this->describe($name, $result);
        }

        return [
            'facts' => $facts,
            'sources' => $sources,
            'tools_called' => $toolsCalled,
            'results' => $results,
        ];
    }

    /**
     * One tool result as a line the model can rely on.
     *
     * Compact on purpose: this competes with the course catalogue for the prompt
     * budget, and a failed tool has to read as an instruction ("do not answer
     * this from memory") rather than as noise.
     */
    private function describe(string $name, array $result): string
    {
        if (!$result['ok']) {
            $message = $result['errors'][0]['message'] ?? 'تعذّر التحقق.';
            $referral = $result['data']['referral'] ?? null;
            $known = $result['data']['known_places'] ?? null;

            $line = "- [{$name}] ⚠️ {$message}";
            if ($referral !== null) {
                $line .= " المصدر الرسمي: {$referral}.";
            }
            if (is_array($known) && $known !== []) {
                $line .= ' الأماكن المسجّلة فعلاً: ' . implode('، ', array_slice($known, 0, 8)) . '.';
            }

            return $line;
        }

        return "- [{$name}] " . json_encode(
            $this->summarise($name, $result['data']),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }

    /** Keep only the fields of a tool result that belong in a prompt. */
    private function summarise(string $name, array $data): array
    {
        return match ($name) {
            'review_cart' => array_intersect_key($data, array_flip([
                'is_empty', 'hours', 'limit', 'within_limit', 'exceeds_by', 'risks', 'courses',
            ])),
            'calculate_gpa_goal' => array_intersect_key($data, array_flip([
                'current_gpa', 'target_gpa', 'passed_hours', 'planned_hours',
                'required_term_average', 'reachable_this_term', 'max_possible_this_term', 'grounded', 'message',
            ])),
            'validate_prerequisites' => array_intersect_key($data, array_flip([
                'open', 'blocked', 'all_open', 'hours', 'limit', 'within_limit',
            ])),
            'get_course_details' => array_intersect_key($data, array_flip([
                'id', 'name', 'credit_hours', 'type', 'difficulty_level', 'prerequisites', 'unlocks', 'student_status',
            ])),
            'search_courses' => array_intersect_key($data, array_flip(['courses', 'total_matches'])),
            'search_campus_directory' => array_intersect_key($data, array_flip(['matched'])),
            'get_calendar_events' => array_intersect_key($data, array_flip(['current_period'])),
            default => $data,
        };
    }

    /**
     * Run a tool for a student.
     *
     * $user is the authenticated student, passed by the caller — never taken from
     * the arguments, so no argument the model produces can select a different
     * student's data.
     *
     * @return array{ok: bool, data: array, errors: array, warnings: array, sources: array, tool: string}
     */
    public function call(User $user, string $name, array $arguments = []): array
    {
        $tool = $this->get($name);

        if ($tool === null) {
            Log::warning('AI requested a tool that is not allow-listed', ['tool' => $name]);
            $this->callLog[] = ['tool' => $name, 'ok' => false, 'arguments' => $arguments, 'error' => 'not_allowed'];

            return [
                'ok' => false,
                'data' => [],
                'errors' => [['code' => 'tool_not_allowed', 'message' => "الأداة «{$name}» غير مسموح بها."]],
                'warnings' => [],
                'sources' => [],
                'tool' => $name,
            ];
        }

        try {
            $result = $tool->run($user, $arguments);
            $this->callLog[] = ['tool' => $name, 'ok' => (bool) $result['ok'], 'arguments' => $arguments, 'error' => null];

            return array_merge(['warnings' => []], $result, ['tool' => $name]);
        } catch (\Throwable $e) {
            // A tool failure degrades that one fact, not the whole consultation.
            Log::error("AI tool «{$name}» failed: " . $e->getMessage(), [
                'exception' => get_class($e),
                'line' => $e->getLine(),
            ]);
            $this->callLog[] = ['tool' => $name, 'ok' => false, 'arguments' => $arguments, 'error' => get_class($e)];

            return [
                'ok' => false,
                'data' => [],
                'errors' => [['code' => 'tool_failed', 'message' => 'تعذّر تنفيذ هذه الخطوة الآن.']],
                'warnings' => [],
                'sources' => [],
                'tool' => $name,
            ];
        }
    }

    /**
     * What this registry ran during the current request.
     *
     * Arguments are kept because a wrong answer is usually a wrong argument, and
     * without them a tool trace cannot be debugged. They only ever contain course
     * ids, hour counts and search terms — no credentials pass through here.
     *
     * @return array<int, array{tool: string, ok: bool, arguments: array, error: ?string}>
     */
    public function callLog(): array
    {
        return $this->callLog;
    }
}
