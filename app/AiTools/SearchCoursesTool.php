<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Models\User;
use App\Services\StudentAcademicContextService;

/**
 * Find courses inside the student's own plan.
 *
 * The pool comes from StudentAcademicContextService, which is scoped to the
 * student's major and study-plan version, so a search can never return a course
 * from another plan however the query is phrased.
 */
class SearchCoursesTool implements AiTool
{
    use BuildsToolResults;

    public function __construct(private StudentAcademicContextService $context) {}

    public function name(): string
    {
        return 'search_courses';
    }

    public function description(): string
    {
        return 'البحث في المواد المتاحة للطالب حسب الاسم أو النوع أو الصعوبة.';
    }

    public function parameters(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'query' => ['type' => 'STRING', 'description' => 'جزء من اسم المادة'],
                'type' => ['type' => 'STRING', 'enum' => ['compulsory', 'elective', 'university_req', 'supporting']],
                'max_difficulty' => ['type' => 'INTEGER', 'description' => 'أقصى صعوبة من 1 إلى 5'],
                'unlocks_at_least' => ['type' => 'INTEGER', 'description' => 'أقل عدد مواد تفتحها'],
                'limit' => ['type' => 'INTEGER'],
            ],
        ];
    }

    public function run(User $user, array $arguments): array
    {
        $context = $this->context->for($user);
        $courses = $context['available_courses'];

        $query = trim((string) ($arguments['query'] ?? ''));
        $type = $arguments['type'] ?? null;
        $maxDifficulty = isset($arguments['max_difficulty']) ? (int) $arguments['max_difficulty'] : null;
        $unlocksAtLeast = isset($arguments['unlocks_at_least']) ? (int) $arguments['unlocks_at_least'] : null;
        $limit = max(1, min(20, (int) ($arguments['limit'] ?? 10)));

        $matches = array_values(array_filter($courses, function ($course) use ($query, $type, $maxDifficulty, $unlocksAtLeast) {
            if ($query !== '' && !$this->nameMatches((string) $course['name'], $query)) {
                return false;
            }
            if ($type !== null && ($course['type'] ?? null) !== $type) {
                return false;
            }
            if ($maxDifficulty !== null && (int) $course['difficulty_level'] > $maxDifficulty) {
                return false;
            }
            if ($unlocksAtLeast !== null && (int) $course['unlocks'] < $unlocksAtLeast) {
                return false;
            }

            return true;
        }));

        // Strategic value first: a course that unlocks more of the plan is the
        // more useful answer to "what can I take?".
        usort($matches, fn ($a, $b) => ($b['unlocks'] <=> $a['unlocks']) ?: ($a['prereq_count'] <=> $b['prereq_count']));

        $results = array_map(fn ($course) => [
            'id' => (int) $course['id'],
            'name' => (string) $course['name'],
            'credit_hours' => (int) $course['credit_hours'],
            'type' => $course['type'] ?? null,
            'difficulty_level' => (int) $course['difficulty_level'],
            'unlocks' => (int) $course['unlocks'],
            'prereq_count' => (int) $course['prereq_count'],
        ], array_slice($matches, 0, $limit));

        return $this->ok(
            [
                'courses' => $results,
                'total_matches' => count($matches),
                'truncated' => count($matches) > count($results),
            ],
            $results === [] ? [] : [[
                'type' => 'study_plan',
                'label' => 'خطتك الدراسية',
                'entity_ids' => array_column($results, 'id'),
            ]]
        );
    }

    private function nameMatches(string $name, string $query): bool
    {
        $name = $this->fold($name);
        $query = $this->fold($query);

        if ($query === '') {
            return true;
        }
        if (str_contains($name, $query)) {
            return true;
        }

        // Every distinctive word of the query must appear, so "هياكل بيانات"
        // finds "هياكل البيانات" without matching every course with "بيانات".
        $words = array_filter(preg_split('/\s+/u', $query) ?: [], fn ($w) => mb_strlen($w, 'UTF-8') > 2);
        if ($words === []) {
            return false;
        }
        foreach ($words as $word) {
            if (!str_contains($name, $word)) {
                return false;
            }
        }

        return true;
    }

    private function fold(string $text): string
    {
        $text = mb_strtolower(trim($text), 'UTF-8');
        $text = str_replace(['أ', 'إ', 'آ', 'ٱ'], 'ا', $text);
        $text = str_replace('ة', 'ه', $text);
        $text = str_replace(['ى', 'ئ'], 'ي', $text);
        $text = preg_replace('/[\x{0640}\x{064B}-\x{065F}]/u', '', $text);
        // "ال" is the definite article, not part of the title.
        $text = str_replace('ال', '', $text);

        return trim(preg_replace('/\s+/u', ' ', $text));
    }
}
