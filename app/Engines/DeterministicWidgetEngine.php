<?php

namespace App\Engines;

/**
 * Builds advisor widgets from the student's real record, and reads the intent that
 * decides when one is due.
 *
 * Why not leave this to the model: it treats widgets as optional decoration, so it
 * would describe a chart in prose and send nothing ("الرسم البياني أدناه" with
 * nothing below), announce "تمت إضافتها" without filling courses_to_add, or invent
 * numbers the sanitiser can clamp but never verify. Everything here is arithmetic
 * over hours the database already knows, leaving the model to do what it is good
 * at — explaining the result.
 */
class DeterministicWidgetEngine
{
    /** Grade assumptions for the pessimistic / expected / optimistic bands (%). */
    private const BANDS = ['pessimistic' => 68, 'expected' => 78, 'optimistic' => 88];

    /**
     * Which chart (if any) this question is asking for.
     *
     * Comparison is tested first on purpose: "قارن بين المادتين وأثرهما على المعدل"
     * mentions the GPA but is asking about courses, not about a forecast.
     *
     * @return 'radar'|'gpa_forecast'|null
     */
    public function chooseFor(string $message): ?string
    {
        $m = $this->normalize($message);

        // Only unambiguous comparison markers — a bare "أو" or "بين" appears in
        // almost every question and would hijack everything.
        foreach (['قارن', 'مقارنه', 'ايهما', 'ايهم', 'ايها افضل', 'افضل من', 'محتار', 'احتار', 'مفاضله', 'الفرق بين', 'فرق بين'] as $hint) {
            if (str_contains($m, $hint)) {
                return 'radar';
            }
        }

        $aboutGpa = str_contains($m, 'معدل') || str_contains($m, 'تراكمي') || str_contains($m, 'gpa');
        if (!$aboutGpa) {
            return null;
        }

        foreach (['يتاثر', 'بيتاثر', 'تاثير', 'اثر', 'توقع', 'اتوقع', 'ارفع', 'رفع', 'اوصل', 'يوصل', 'كم فصل', 'هدف', 'مستقبل', 'يصير', 'راح'] as $hint) {
            if (str_contains($m, $hint)) {
                return 'gpa_forecast';
            }
        }

        return null;
    }

    /**
     * Project the cumulative average over the next terms.
     *
     * A cumulative percentage average is (earned points + new points) / total hours,
     * so each term is projected by assuming the student earns the band's grade in the
     * hours they take that term.
     *
     * @return array|null null when there is no record to project from
     */
    public function gpaForecast(array $rules, int $plannedHours, ?float $targetGpa = null, int $terms = 3): ?array
    {
        $currentGpa = round((float) ($rules['gpa_percentage'] ?? 0), 2);
        $passedHours = (int) ($rules['total_passed_hours'] ?? 0);

        // Without completed hours there is no cumulative average to move.
        if ($passedHours <= 0 || $currentGpa <= 0) {
            return null;
        }

        $plannedHours = $plannedHours > 0 ? $plannedHours : (int) ($rules['effective_limit'] ?? 15);
        $remaining = max(0, (int) ($rules['remaining_hours'] ?? 0));

        $points = [['label' => 'الآن', 'expected' => $currentGpa]];
        $running = array_map(fn () => ['hours' => $passedHours, 'points' => $currentGpa * $passedHours], self::BANDS);

        for ($term = 1; $term <= $terms; $term++) {
            // Never project beyond what the student still has left to study.
            $consumed = ($term - 1) * $plannedHours;
            $termHours = min($plannedHours, max(0, $remaining - $consumed));
            if ($termHours <= 0) {
                break;
            }

            $row = ['label' => $term === 1 ? 'الفصل القادم' : "بعد {$term} فصول"];

            foreach (self::BANDS as $band => $assumedGrade) {
                $running[$band]['hours'] += $termHours;
                $running[$band]['points'] += $assumedGrade * $termHours;
                $row[$band] = round($running[$band]['points'] / $running[$band]['hours'], 2);
            }

            $points[] = $row;
        }

        if (count($points) < 2) {
            return null;
        }

        $last = end($points);
        $note = "الحساب مبني على ساعاتك المنجزة ({$passedHours} ساعة) ومعدلك الحالي، بافتراض تسجيل {$plannedHours} ساعة كل فصل وتحصيل "
            . self::BANDS['expected'] . '% في المواد الجديدة (النطاق يوضح أفضل وأسوأ حالة: '
            . self::BANDS['optimistic'] . '% و' . self::BANDS['pessimistic'] . '%).';

        return [
            'type' => 'gpa_forecast',
            'title' => 'توقّع معدلك التراكمي',
            'current_gpa' => $currentGpa,
            'target_gpa' => $targetGpa,
            'note' => $note,
            'points' => $points,
        ];
    }

    /**
     * Compare ranked courses on the axes a student actually decides by.
     *
     * The pool must be every course the student may register (id => row), not a
     * ranked shortlist: they can perfectly well ask about two courses that didn't
     * make the top-N, and resolving against a shortlist silently dropped one of
     * them and killed the chart.
     *
     * @param array $pool  id => ['name','credit_hours','difficulty_level','unlocks','prereq_count']
     * @param array $names course names mentioned in the question (may be empty)
     */
    public function radarFromCourses(array $pool, array $names = [], int $max = 3): ?array
    {
        $courses = [];
        foreach ($pool as $id => $row) {
            $id = (int) ($row['id'] ?? $id);
            if ($id <= 0 || empty($row['name'])) {
                continue;
            }

            $courses[$id] = [
                'id' => $id,
                'name' => (string) $row['name'],
                'credit_hours' => (int) ($row['credit_hours'] ?? 3),
                'difficulty' => min(5, max(1, (int) ($row['difficulty_level'] ?? 3))),
                'unlocks' => (int) ($row['unlocks'] ?? count($row['unlocks_courses'] ?? [])),
                'prereqs' => (int) ($row['prereq_count'] ?? count($row['prereqs'] ?? [])),
            ];
        }

        $picked = [];
        foreach ($names as $name) {
            foreach ($courses as $course) {
                if ($this->sameCourse($course['name'], $name)) {
                    $picked[$course['id']] = $course;
                    break;
                }
            }
        }

        // The student named courses we could not resolve (dropped, renamed, or not
        // theirs): charting whatever ranks highest would answer a question nobody
        // asked, so leave it to the reply text.
        if (!empty($names) && count($picked) < 2) {
            return null;
        }

        // Nothing named ("أيهما أنسب لي؟") — the courses that open the most doors and
        // are easiest to carry are the answer. When the student DID name courses, the
        // chart shows exactly those: padding it with a course they never mentioned
        // muddies the comparison.
        if (empty($picked)) {
            $ordered = $courses;
            uasort($ordered, fn ($a, $b) => [$b['unlocks'], $a['difficulty']] <=> [$a['unlocks'], $b['difficulty']]);
            $picked = array_slice($ordered, 0, $max, true);
        }

        if (count($picked) < 2) {
            return null;
        }

        $series = [];
        foreach (array_slice(array_values($picked), 0, $max) as $course) {
            $difficulty = $course['difficulty'];
            $hours = $course['credit_hours'];
            $unlocks = $course['unlocks'];
            $prereqs = $course['prereqs'];

            $series[] = [
                'name' => $course['name'],
                'values' => [
                    $difficulty,                                   // الصعوبة
                    min(5, round($difficulty * 0.6 + $hours * 0.5, 1)), // الجهد: صعوبة + ساعات
                    min(5, max(1, 6 - $difficulty)),               // فرصة رفع المعدل تقل بالصعوبة
                    min(5, $unlocks),                              // ما تفتحه من مواد
                    min(5, max(1, 5 - $prereqs)),                  // جهوزيتها الآن
                ],
            ];
        }

        return [
            'type' => 'radar',
            'title' => 'مقارنة متعددة الأبعاد',
            'note' => 'المحاور محسوبة من خطتك: الصعوبة الإدارية للمادة، ساعاتها، وعدد المواد التي تفتحها لك (٥ = الأفضل في ذلك المحور).',
            'axes' => ['الصعوبة', 'الجهد المطلوب', 'فرصة رفع المعدل', 'تفتح مواد', 'جهوزيتها الآن'],
            'series' => $series,
        ];
    }

    /**
     * Review of the cart as it actually stands right now.
     *
     * Built from the database rather than the model so the hours, the names and the
     * verdicts always match reality — the model used to announce "سأراجع جدولك"
     * and then send no widget at all.
     *
     * @param \Illuminate\Support\Collection|array $cartCourses course rows in the cart
     */
    public function cartReview($cartCourses, array $rules): ?array
    {
        $courses = collect($cartCourses)->map(fn ($c) => is_array($c) ? $c : $c->toArray())->values();
        if ($courses->isEmpty()) {
            return null;
        }

        $limit = (int) ($rules['effective_limit'] ?? 18);
        $totalHours = (int) $courses->sum('credit_hours');
        $overBy = max(0, $totalHours - $limit);

        // Shedding load starts with the hardest courses, since that is what actually
        // relieves the term.
        $dropIds = [];
        if ($overBy > 0) {
            $shed = 0;
            foreach ($courses->sortByDesc(fn ($c) => [(int) ($c['difficulty_level'] ?? 3), (int) ($c['credit_hours'] ?? 3)]) as $course) {
                if ($shed >= $overBy) {
                    break;
                }
                $dropIds[] = (int) $course['id'];
                $shed += (int) ($course['credit_hours'] ?? 3);
            }
        }

        $hardCount = $courses->filter(fn ($c) => (int) ($c['difficulty_level'] ?? 3) >= 4)->count();

        $rows = [];
        foreach ($courses as $course) {
            $difficulty = min(5, max(1, (int) ($course['difficulty_level'] ?? 3)));
            $id = (int) $course['id'];

            if (in_array($id, $dropIds, true)) {
                $verdict = 'remove';
                $reason = "حذفها يرجّعك للحد المسموح ({$limit} ساعة) وهي من أصعب مواد جدولك.";
            } elseif ($difficulty >= 4 && $hardCount >= 3) {
                $verdict = 'warning';
                $reason = 'مادة صعبة وجدولك فيه ' . $hardCount . ' مواد صعبة — وزّع وقتك لها من أول أسبوع.';
            } elseif ($difficulty >= 4) {
                $verdict = 'warning';
                $reason = 'من المواد الصعبة نسبياً، تحتاج متابعة أسبوعية منتظمة.';
            } else {
                $verdict = 'keep';
                $reason = 'مناسبة لمستواك وتوازن صعوبة جدولك.';
            }

            $rows[] = [
                'id' => $id,
                'name' => (string) ($course['name'] ?? ''),
                'code' => (string) ($course['code'] ?? ''),
                'credit_hours' => (int) ($course['credit_hours'] ?? 0),
                'difficulty' => $difficulty,
                'verdict' => $verdict,
                'reason' => $reason,
            ];
        }

        $avgDifficulty = round($courses->avg(fn ($c) => (int) ($c['difficulty_level'] ?? 3)), 1);

        return [
            'type' => 'cart_review',
            'title' => 'مراجعة تسجيلك التجريبي',
            'courses' => $rows,
            'summary' => [
                'total_hours' => $totalHours,
                'max_hours' => $limit,
                'overall_difficulty' => $avgDifficulty >= 4 ? 'مرتفع' : ($avgDifficulty >= 3 ? 'متوسط' : 'خفيف'),
                'recommendation' => $overBy > 0
                    ? "جدولك يتجاوز الحد بـ {$overBy} ساعة — أزل المواد المعلّمة بالأحمر."
                    : ($hardCount >= 3
                        ? 'الساعات داخل الحد لكن العبء صعب؛ فكّر باستبدال مادة صعبة بأخرى أخف.'
                        : 'جدول متوازن وداخل الحد المسموح ✅'),
            ],
        ];
    }

    /** Course names the student named in their question. */
    public function courseNamesInMessage(string $message, array $availableNamesById): array
    {
        $haystack = $this->normalize($message);
        $found = [];

        foreach ($availableNamesById as $name) {
            if ($this->messageNamesCourse($haystack, (string) $name)) {
                $found[] = $name;
            }
        }

        return $found;
    }

    /**
     * Does this message name that course?
     *
     * Substring matching fails the common case: a student writes "أضف مادة الذكاء
     * الاصطناعي" for a course registered as "مقدمة في الذكاء الاصطناعي". So the
     * course's *significant* words (ignoring filler like مقدمة/في/مادة) must all
     * appear in the message, in any order.
     */
    private function messageNamesCourse(string $normalizedMessage, string $courseName): bool
    {
        $words = $this->significantWords($courseName);
        if (empty($words)) {
            return false;
        }

        // Guard against a one-short-word course name matching half the catalogue.
        if (count($words) === 1 && mb_strlen($words[0], 'UTF-8') < 5) {
            return false;
        }

        foreach ($words as $word) {
            if (!str_contains($normalizedMessage, $word)) {
                return false;
            }
        }

        return true;
    }

    /** Course-name words that actually identify it. */
    private function significantWords(string $courseName): array
    {
        $filler = ['مادة', 'ماده', 'مقدمة', 'مقدمه', 'في', 'الى', 'على', 'من', 'مع', 'و', 'ال', 'اساسيات', 'مبادئ', 'عملي', 'نظري', 'الجامعة', 'الجامعه', '1', '2', '3'];

        $words = preg_split('/\s+/u', $this->normalize($courseName), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_values(array_filter(
            $words,
            fn ($w) => mb_strlen($w, 'UTF-8') >= 3 && !in_array($w, $filler, true)
        ));
    }

    /**
     * Does this reply tell the student a course was added?
     *
     * The cart write is aligned with this claim, never with the raw request: when the
     * advisor declines on academic grounds ("مادة متقدمة ولا تناسب سنتك الأولى") that
     * judgement must stand, otherwise the course lands in the cart while the text in
     * front of the student refuses it.
     */
    public function claimsAdded(string $reply): bool
    {
        $r = $this->normalize($reply);

        // A refusal wins even when the same sentence contains "إضافة".
        foreach (['لا استطيع اضافه', 'لم اضف', 'ما اضفت', 'غير متوفره', 'غير متاحه', 'لا يمكن اضافتها', 'لم يتم اضافتها', 'للاسف'] as $refusal) {
            if (str_contains($r, $refusal)) {
                return false;
            }
        }

        foreach (['تمت اضافتها', 'تمت الاضافه', 'قمت باضافه', 'قمت باضافتها', 'اضفت لك', 'اضفتها لك', 'اضفتها', 'تم اضافه', 'اضفت مادة', 'اضفت ماده'] as $claim) {
            if (str_contains($r, $claim)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Course ids from an explicit "add this to my cart" request.
     *
     * The model regularly tells the student "تمت إضافتها بنجاح" while leaving
     * courses_to_add empty, so the cart write cannot depend on it complying. Both an
     * add verb AND a course name the student themselves wrote are required, and the
     * caller still runs the ids through ValidationEngine.
     *
     * @param array $availableNamesById id => course name (eligible courses only)
     * @return int[]
     */
    public function explicitAddRequest(string $message, array $availableNamesById): array
    {
        $m = $this->normalize($message);

        $asksToAdd = false;
        foreach (['اضف', 'ضيف', 'اضافه', 'حط', 'سجل لي', 'سجلي', 'نزل لي', 'ادخل'] as $verb) {
            if (str_contains($m, $verb)) {
                $asksToAdd = true;
                break;
            }
        }
        if (!$asksToAdd) {
            return [];
        }

        // "لا تضف" / "ما بدي أضيف" is the opposite request.
        foreach (['لا تضف', 'ما بدي اضيف', 'مش بدي اضيف', 'بدون اضافه', 'لا تضيف'] as $negation) {
            if (str_contains($m, $negation)) {
                return [];
            }
        }

        $ids = [];
        foreach ($availableNamesById as $id => $name) {
            if ($this->messageNamesCourse($m, (string) $name)) {
                $ids[] = (int) $id;
            }
        }

        // More than a couple of hits means the phrase was generic enough to match
        // several courses ("الذكاء الاصطناعي" vs "الذكاء الاصطناعي المتقدم"). Adding
        // the wrong course is worse than letting the model answer, so bail out.
        return count($ids) <= 2 ? array_values(array_unique($ids)) : [];
    }

    private function sameCourse(string $a, string $b): bool
    {
        $a = $this->normalize($a);
        $b = $this->normalize($b);

        return $a === $b || str_contains($a, $b) || str_contains($b, $a);
    }

    /** Fold Arabic orthography variants so matching isn't defeated by spelling. */
    private function normalize(string $text): string
    {
        $text = mb_strtolower(trim($text), 'UTF-8');
        $text = str_replace(['أ', 'إ', 'آ', 'ٱ'], 'ا', $text);
        $text = str_replace(['ة'], 'ه', $text);
        $text = str_replace(['ى'], 'ي', $text);
        $text = preg_replace('/[\x{0610}-\x{061A}\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}]/u', '', $text);
        $text = preg_replace('/\s+/u', ' ', $text);

        return $text;
    }
}
