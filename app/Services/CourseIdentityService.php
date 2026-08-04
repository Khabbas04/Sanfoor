<?php

namespace App\Services;

use App\Models\Course;
use Illuminate\Support\Collection;

/**
 * Resolves catalogue rows that represent the same academic course.
 *
 * A course may legitimately have one row per major/study plan. We keep those
 * rows intact, but use this service whenever the product needs one logical
 * course (demand, trial-cart hours, and duplicate prevention).
 */
class CourseIdentityService
{
    /** @var array<int, string> */
    private const CONNECTOR_WORDS = [
        'في', 'من', 'الى', 'علي', 'عن', 'و',
        'the', 'of', 'and', 'in', 'to',
    ];

    /** @var array<int, string> */
    private const DISTINGUISHING_WORDS = [
        'مختبر', 'عملي', 'مقدمه', 'متقدم', 'متقدمه', 'خاصه', 'مبادئ', 'اساسيات', 'تطبيقات',
    ];

    public function same(Course $first, Course $second): bool
    {
        if ((int) $first->id === (int) $second->id) {
            return true;
        }

        $firstCode = $this->normalizeCode($first->code);
        $secondCode = $this->normalizeCode($second->code);

        if ($firstCode !== '' && $secondCode !== '' && $firstCode === $secondCode) {
            return true;
        }

        $firstName = $this->normalizeName($first->name);
        $secondName = $this->normalizeName($second->name);

        if ($firstName === '' || $secondName === '') {
            return false;
        }

        if ($firstName === $secondName) {
            return true;
        }

        $firstNumberTokens = $this->numberTokens($firstName);
        $secondNumberTokens = $this->numberTokens($secondName);
        if ($firstNumberTokens !== $secondNumberTokens) {
            return false;
        }

        $firstLength = mb_strlen($firstName);
        $secondLength = mb_strlen($secondName);
        
        $lengthRatio = min($firstLength, $secondLength) / max($firstLength, $secondLength);
        $characterSimilarity = $this->characterSimilarity($firstName, $secondName);

        if ($firstLength >= 8 && $secondLength >= 8 && $lengthRatio >= 0.82 && $characterSimilarity >= 0.90) {
            return true;
        }

        $firstTokens = $this->meaningfulTokens($firstName);
        $secondTokens = $this->meaningfulTokens($secondName);

        if ($this->hasConflict($firstTokens, $secondTokens)) {
            return false;
        }

        if (count($firstTokens) === 0 || count($secondTokens) === 0) {
            return false;
        }

        $intersection = count(array_intersect($firstTokens, $secondTokens));
        $overlap = $intersection / min(count($firstTokens), count($secondTokens));

        if ($overlap >= 0.75) {
            return true;
        }

        return false;
    }

    /**
     * @return Collection<int, array{representative: Course, members: Collection<int, Course>}>
     */
    public function group(Collection $courses): Collection
    {
        $groups = collect();

        foreach ($courses->values() as $course) {
            $matchingIndex = $groups->search(function (array $group) use ($course) {
                return $group['members']->contains(fn (Course $member) => $this->same($member, $course));
            });

            if ($matchingIndex === false) {
                $groups->push([
                    'representative' => $course,
                    'members' => collect([$course]),
                ]);

                continue;
            }

            $groups[$matchingIndex]['members']->push($course);
        }

        return $groups;
    }

    /**
     * Keep the first requested catalogue row and discard equivalent later rows.
     * This is intentional: the UI can continue using the id the student clicked.
     *
     * @param  array<int, int|string>  $requestedIds
     * @return array{ids: array<int, int>, duplicates: array<int, array{discarded_id: int, kept_id: int}>}
     */
    public function deduplicateCourseIds(array $requestedIds, Collection $courses): array
    {
        $coursesById = $courses->keyBy(fn (Course $course) => (int) $course->id);
        $kept = [];
        $duplicates = [];

        foreach (array_values(array_unique(array_map('intval', $requestedIds))) as $courseId) {
            /** @var Course|null $course */
            $course = $coursesById->get($courseId);
            if (! $course) {
                continue;
            }

            $equivalentKeptId = collect($kept)->first(function (int $keptId) use ($course, $coursesById) {
                $keptCourse = $coursesById->get($keptId);

                return $keptCourse && $this->same($keptCourse, $course);
            });

            if ($equivalentKeptId !== null) {
                $duplicates[] = ['discarded_id' => $courseId, 'kept_id' => (int) $equivalentKeptId];

                continue;
            }

            $kept[] = $courseId;
        }

        return ['ids' => $kept, 'duplicates' => $duplicates];
    }

    /** @return Collection<int, Course> */
    public function deduplicateCourses(Collection $courses): Collection
    {
        $ids = $this->deduplicateCourseIds($courses->pluck('id')->all(), $courses)['ids'];

        return collect($ids)
            ->map(fn (int $id) => $courses->firstWhere('id', $id))
            ->filter()
            ->values();
    }

    /** @return array<int, int> */
    public function equivalentCourseIds(Course $reference, ?Collection $catalogue = null): array
    {
        $catalogue ??= Course::query()
            ->where('is_quiz_only', false)
            ->get(['id', 'name', 'code']);

        $group = $this->group($catalogue)->first(
            fn (array $candidate) => $candidate['members']->contains('id', $reference->id)
        );

        if (! $group) {
            return [(int) $reference->id];
        }

        return $group['members']->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
    }

    public function normalizeName(?string $value): string
    {
        $value = mb_strtolower(trim((string) $value));
        $value = preg_replace('/[\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}\x{0640}]/u', '', $value) ?? $value;
        $value = strtr($value, [
            'أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ٱ' => 'ا',
            'ى' => 'ي', 'ؤ' => 'و', 'ئ' => 'ي', 'ة' => 'ه',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
        $value = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $value) ?? $value;

        return trim(preg_replace('/\s+/u', ' ', $value) ?? $value);
    }

    private function normalizeCode(?string $value): string
    {
        $value = mb_strtoupper(trim((string) $value));

        return preg_replace('/[^\p{L}\p{N}]+/u', '', $value) ?? $value;
    }

    private function normalizeToken(string $token): string
    {
        return preg_replace('/^(وال|فال|بال|كال|للال|ال|لل|و)(?=\p{L}{3,})/u', '', $token) ?? $token;
    }

    /** @return array<int, string> */
    private function meaningfulTokens(string $value): array
    {
        return collect(preg_split('/\s+/u', $value) ?: [])
            ->reject(fn (string $token) => in_array($token, self::CONNECTOR_WORDS, true))
            ->map(fn (string $token) => $this->normalizeToken($token))
            ->unique()
            ->values()
            ->all();
    }

    /** @return array<int, string> */
    private function numberTokens(string $value): array
    {
        return collect(preg_split('/\s+/u', $value) ?: [])
            ->filter(fn (string $token) => preg_match('/\d/u', $token) === 1)
            ->values()
            ->all();
    }

    /** @param array<int, string> $firstTokens @param array<int, string> $secondTokens */
    private function hasConflict(array $firstTokens, array $secondTokens): bool
    {
        foreach (self::DISTINGUISHING_WORDS as $word) {
            $inFirst = in_array($word, $firstTokens, true);
            $inSecond = in_array($word, $secondTokens, true);

            if ($inFirst !== $inSecond) {
                return true;
            }
        }

        return false;
    }

    private function characterSimilarity(string $first, string $second): float
    {
        $firstChars = preg_split('//u', $first, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $secondChars = preg_split('//u', $second, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $maxLength = max(count($firstChars), count($secondChars));

        if ($maxLength === 0) {
            return 1.0;
        }

        $previous = range(0, count($secondChars));
        foreach ($firstChars as $firstIndex => $firstCharacter) {
            $current = [$firstIndex + 1];
            foreach ($secondChars as $secondIndex => $secondCharacter) {
                $current[] = min(
                    $current[$secondIndex] + 1,
                    $previous[$secondIndex + 1] + 1,
                    $previous[$secondIndex] + ($firstCharacter === $secondCharacter ? 0 : 1),
                );
            }
            $previous = $current;
        }

        return 1 - ($previous[count($secondChars)] / $maxLength);
    }
}
