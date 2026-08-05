<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * What is the student actually asking for?
 *
 * This runs in FRONT of the existing advisor pipeline and hands its result down
 * to it — it does not replace any routing that already exists. The seed rules
 * were lifted from the (unused) regex classifier in
 * AiAdvisorController::buildStudentAdvisingRagContext() and widened to the full
 * intent set.
 *
 * Three layers, cheapest first:
 *   1. local rules  — deterministic, free, handles the overwhelming majority
 *   2. the existing pipeline — anything already understood needs nothing more
 *   3. model classification — only for genuinely ambiguous questions, and only
 *      when ai.features.intent_ai_fallback is on (it costs a request slot)
 */
class AiIntentRouterService
{
    public const INTENTS = [
        'course_question',
        'course_recommendation',
        'semester_planning',
        'graduation_planning',
        'prerequisite_check',
        'gpa_analysis',
        'gpa_goal',
        'calendar_question',
        'instructor_question',
        'section_question',
        'campus_location',
        'compare_courses',
        'cart_review',
        'academic_policy',
        'general_question',
        'unknown',
    ];

    /**
     * Intents whose answer this deployment cannot ground in real data.
     *
     * There is no academic-calendar table beyond current period, so these
     * questions must be answered with an honest referral rather than from
     * the model's general knowledge. Callers use this to set data_completeness.
     */
    public const UNGROUNDED_INTENTS = [
        'calendar_question',
    ];

    /**
     * Ordered so that a tie between two equally scoring intents resolves toward
     * the more specific one. Ties still raise requires_clarification.
     */
    private const PRIORITY = [
        'gpa_goal', 'compare_courses', 'prerequisite_check', 'cart_review',
        'semester_planning', 'graduation_planning', 'academic_policy',
        'section_question', 'instructor_question', 'calendar_question',
        'campus_location', 'gpa_analysis', 'course_recommendation',
        'course_question', 'general_question', 'unknown',
    ];

    /**
     * Keyword rules, as [needle => weight]. Weight 2 is a phrase that means one
     * thing only; weight 1 is a keyword that also shows up in other intents, so
     * it only decides the reading when nothing stronger matched.
     *
     * Needles are written in ordinary Arabic and normalised on both sides, so
     * "إضافة"/"اضافه" and "على"/"علي" do not need separate entries.
     */
    private function rules(): array
    {
        return [
            'gpa_goal' => [
                'ارفع معدلي' => 2, 'رفع معدلي' => 2, 'أوصل معدل' => 2, 'اوصل ل' => 1,
                'هدفي' => 1, 'أطلع من الإنذار' => 2, 'كم فصل بحتاج' => 2, 'كم فصل احتاج' => 2,
                'يصير معدلي' => 2, 'أبي معدلي' => 2, 'بدي معدلي' => 2, 'أقدر أوصل' => 2,
            ],
            'gpa_analysis' => [
                'معدلي' => 1, 'المعدل التراكمي' => 2, 'معدل تراكمي' => 2, 'كم معدلي' => 2,
                'تحليل معدلي' => 2, 'وضعي الأكاديمي' => 2, 'gpa' => 1, 'علاماتي' => 1,
                'يتأثر معدلي' => 2,
            ],
            'course_recommendation' => [
                'شو أسجل' => 2, 'شو بسجل' => 2, 'وش أسجل' => 2, 'ايش أسجل' => 2,
                'اقترح' => 2, 'انصحني' => 2, 'مواد مناسبة' => 2, 'أفضل مواد' => 2,
                'شو الأفضل' => 1, 'مواد متاحة' => 1, 'شو آخذ' => 1, 'شو أدرس' => 1,
                'مواد هذا الفصل' => 1, 'أي مواد' => 1,
            ],
            'semester_planning' => [
                'خطة الفصل' => 2, 'خطط لي' => 2, 'رتب لي' => 2, 'جدول الفصل' => 2,
                'اعملي جدول' => 2, 'اعمل لي جدول' => 2, 'سوي لي جدول' => 2, 'ابني لي جدول' => 2,
                'جدول ح ث خ' => 2, 'جدول ن ر' => 2, 'جدول 18 ساعة' => 2, 'جدول 15 ساعة' => 2, 'جدول 12 ساعة' => 2,
                'الفصل القادم' => 1, 'توزيع الساعات' => 2, 'كم ساعة أسجل' => 2,
                'كم ساعة' => 1, 'جدولي القادم' => 2, 'عدد الساعات المناسب' => 2,
            ],
            'graduation_planning' => [
                'أتخرج' => 2, 'التخرج' => 1, 'تخرجي' => 2, 'كم باقي لي' => 2,
                'متى بتخرج' => 2, 'خطة التخرج' => 2, 'الساعات المتبقية' => 2,
                'أسرّع تخرجي' => 2, 'شروط التخرج' => 2,
            ],
            'prerequisite_check' => [
                'متطلب' => 2, 'المتطلب السابق' => 2, 'يسبقها' => 2, 'شرط المادة' => 2,
                'أقدر آخذ' => 2, 'مفتوحة لي' => 2, 'مسموح لي آخذ' => 2, 'ليش مغلقة' => 2,
                'ما هي متطلبات' => 2,
            ],
            'compare_courses' => [
                'قارن' => 2, 'مقارنة' => 2, 'أيهم أفضل' => 2, 'أيهما أفضل' => 2,
                'الفرق بين' => 2, 'أيهم أنسب' => 2, 'أفضل ولا' => 2,
            ],
            'cart_review' => [
                'سلتي' => 2, 'السلة' => 1, 'تسجيلي التجريبي' => 2, 'راجع جدولي' => 2,
                'قيّم جدولي' => 2, 'مواد سلتي' => 2, 'شو أحذف' => 2, 'احذف من سلتي' => 2,
            ],
            'course_question' => [
                'كم ساعة معتمدة' => 2, 'صعبة' => 1, 'شو بتحكي' => 1, 'وصف المادة' => 2,
                'شو بندرس فيها' => 2, 'تفتح' => 1, 'معلومات عن مادة' => 2, 'هذه المادة' => 1,
            ],
            'academic_policy' => [
                'قانون' => 2, 'الغياب' => 2, 'حرمان' => 2, 'الرسوب' => 2, 'الإنذار' => 1,
                'الانسحاب' => 2, 'تأجيل' => 2, 'عقوبة' => 2, 'الغش' => 2, 'التعليمات' => 1,
                'كم غياب' => 2, 'المادة رقم' => 2,
            ],
            'calendar_question' => [
                'التقويم الأكاديمي' => 2, 'موعد' => 1, 'الامتحان' => 1, 'بداية الفصل' => 2,
                'آخر يوم' => 2, 'متى يبدأ' => 2, 'متى ينتهي' => 2, 'الامتحانات النهائية' => 2,
                'فترة السحب والإضافة' => 2,
            ],
            'instructor_question' => [
                'الدكتور' => 2, 'دكتور' => 1, 'المدرس' => 2, 'الأستاذ' => 2,
                'مين يعطي' => 2, 'مين يدرّس' => 2, 'اسم المحاضر' => 2,
            ],
            'section_question' => [
                'الشعبة' => 2, 'شعب' => 1, 'وقت المحاضرة' => 2, 'أوقات المحاضرات' => 2,
                'القاعة' => 1, 'جدول الشعب' => 2, 'أي شعبة' => 2,
            ],
            'campus_location' => [
                'وين مبنى' => 2, 'المبنى' => 1, 'موقع' => 1, 'العمادة' => 2, 'الدائرة' => 1,
                'وين مكتب' => 2, 'كيف أوصل' => 2, 'المكتبة' => 2, 'دائرة القبول والتسجيل' => 2,
            ],
            'general_question' => [
                'مرحبا' => 2, 'السلام عليكم' => 2, 'كيفك' => 2, 'شكرا' => 2,
                'شو بتقدر تعمل' => 2, 'مين أنت' => 2, 'أهلا' => 1,
            ],
        ];
    }

    public function route(string $message, array $context = []): array
    {
        $normalised = $this->normalise($message);

        [$intent, $score, $runnerUpScore] = $this->scoreRules($normalised);

        $entities = $this->extractEntities($message, $normalised, $context);

        // Nothing recognised: a short message is a pleasantry, a long one is a
        // real question this router could not read — which is what `unknown` and
        // clarification are for.
        $unreadable = $score === 0 && mb_strlen(trim($message), 'UTF-8') > 25;
        if ($unreadable) {
            $intent = 'unknown';
        }

        // A tie between two equally well-scoring intents is also ambiguous.
        $ambiguous = $unreadable || ($score > 0 && $score === $runnerUpScore);
        $confidence = $this->confidenceFor($score, $runnerUpScore);

        if ($ambiguous && config('ai.features.intent_ai_fallback')) {
            $classified = $this->classifyWithModel($message);
            if ($classified !== null) {
                return [
                    'intent' => $classified,
                    'confidence' => 0.7,
                    'entities' => $entities,
                    'requires_clarification' => false,
                    'source' => 'model',
                ];
            }
        }

        return [
            'intent' => $intent,
            'confidence' => $confidence,
            'entities' => $entities,
            'requires_clarification' => $ambiguous,
            'source' => 'rules',
        ];
    }

    /** True when this deployment has no data to ground the intent in. */
    public function isGrounded(string $intent): bool
    {
        return !in_array($intent, self::UNGROUNDED_INTENTS, true);
    }

    /**
     * The intent vocabulary CourseRankingEngine already understands.
     *
     * The engine's difficulty-fit dimension compares against these three Arabic
     * literals; anything else falls to its balanced default. The controller used
     * to hand it the raw student message here, which never matched.
     */
    public function legacyRankingIntent(string $intent): string
    {
        return match ($intent) {
            'gpa_goal', 'gpa_analysis' => 'رفع_المعدل',
            'graduation_planning' => 'تسريع_التخرج',
            default => 'عام',
        };
    }

    /** @return array{0: string, 1: int, 2: int} [intent, best score, runner-up score] */
    private function scoreRules(string $normalised): array
    {
        $scores = [];

        foreach ($this->rules() as $intent => $needles) {
            $score = 0;
            foreach ($needles as $needle => $weight) {
                if (str_contains($normalised, $this->normalise($needle))) {
                    $score += $weight;
                }
            }
            if ($score > 0) {
                $scores[$intent] = $score;
            }
        }

        if ($scores === []) {
            return ['general_question', 0, 0];
        }

        // Highest score wins; the priority list breaks ties deterministically.
        $best = null;
        foreach (self::PRIORITY as $intent) {
            if (!isset($scores[$intent])) {
                continue;
            }
            if ($best === null || $scores[$intent] > $scores[$best]) {
                $best = $intent;
            }
        }

        $others = $scores;
        unset($others[$best]);

        return [$best, $scores[$best], $others === [] ? 0 : max($others)];
    }

    private function confidenceFor(int $score, int $runnerUp): float
    {
        if ($score === 0) {
            return 0.35;
        }

        $base = match (true) {
            $score >= 4 => 0.95,
            $score === 3 => 0.9,
            $score === 2 => 0.78,
            default => 0.62,
        };

        // A close runner-up means the reading is not clean.
        if ($runnerUp > 0 && $score - $runnerUp <= 1) {
            $base -= 0.12;
        }

        return round(max(0.3, min(0.97, $base)), 2);
    }

    /**
     * Entities the student named. Course names are matched only against courses
     * they may actually see, so this can never surface a foreign course.
     *
     * @param array{course_names?: array<int, string>} $context id => course name
     */
    private function extractEntities(string $message, string $normalised, array $context): array
    {
        $entities = [
            'course_ids' => [],
            'course_names' => [],
            'gpa_target' => null,
            'hours' => null,
            'article_number' => null,
        ];

        foreach (($context['course_names'] ?? []) as $id => $name) {
            if ($this->mentions($normalised, (string) $name)) {
                $entities['course_ids'][] = (int) $id;
                $entities['course_names'][] = (string) $name;
            }
        }

        $latin = $this->latinDigits($message);

        // A GPA target lives in the 60-100 percentage band (the university does
        // not use the 4.00 scale).
        if (preg_match_all('/\d{2,3}(?:[.,]\d{1,2})?/', $latin, $matches)) {
            foreach ($matches[0] as $candidate) {
                $value = (float) str_replace(',', '.', $candidate);
                if ($value >= 60 && $value <= 100) {
                    $entities['gpa_target'] = $value;
                    break;
                }
            }
        }

        // "١٥ ساعة" / "15 ساعات" — a credit-hour count, not a GPA.
        if (preg_match('/(\d{1,2})\s*(?:ساع)/u', $latin, $matches)) {
            $hours = (int) $matches[1];
            if ($hours >= 1 && $hours <= 21) {
                $entities['hours'] = $hours;
            }
        }

        // "المادة 25" in a regulations question is a legal article, not a course.
        if (preg_match('/الماده?\s*(?:رقم\s*)?(\d{1,3})/u', $this->normalise($latin), $matches)) {
            $entities['article_number'] = (int) $matches[1];
        }

        return $entities;
    }

    /**
     * Last-resort classification by the model.
     *
     * Deliberately tiny: plain text out, one word in, short timeout, and any
     * failure returns null so the local reading stands.
     */
    private function classifyWithModel(string $message): ?string
    {
        try {
            $list = implode(', ', self::INTENTS);
            $raw = app(GeminiService::class)->callGeminiAPI(
                [['role' => 'user', 'parts' => [['text' =>
                    "Classify this Arabic university student question into exactly one intent.\n" .
                    "Allowed intents: {$list}\n" .
                    "Answer with the intent name only, no punctuation.\nQuestion: {$message}",
                ]]]],
                [
                    'generationConfig' => [
                        'maxOutputTokens' => 12,
                        'temperature' => 0.0,
                        'responseMimeType' => 'text/plain',
                    ],
                    'timeout' => 5,
                ]
            );

            $candidate = strtolower(trim(preg_replace('/[^a-z_]/i', '', $raw)));

            return in_array($candidate, self::INTENTS, true) ? $candidate : null;
        } catch (\Throwable $e) {
            Log::debug('Intent classification fell back to local rules: ' . $e->getMessage());

            return null;
        }
    }

    /** Does the message name this course? Requires a distinctive token, not one shared word. */
    private function mentions(string $normalisedMessage, string $courseName): bool
    {
        $name = $this->normalise($courseName);
        if ($name === '') {
            return false;
        }

        if (str_contains($normalisedMessage, $name)) {
            return true;
        }

        // Fall back to the distinctive words of the title, so "هياكل البيانات"
        // is still found in "بدي اسال عن هياكل بيانات".
        $words = array_values(array_filter(
            preg_split('/\s+/u', $name) ?: [],
            fn ($word) => mb_strlen($word, 'UTF-8') > 3
        ));

        if ($words === []) {
            return false;
        }

        foreach ($words as $word) {
            if (!str_contains($normalisedMessage, $word)) {
                return false;
            }
        }

        return true;
    }

    private function latinDigits(string $text): string
    {
        return strtr($text, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);
    }

    /** Fold Arabic orthography so matching is not defeated by spelling. */
    private function normalise(string $text): string
    {
        $text = mb_strtolower(trim($text), 'UTF-8');
        $text = str_replace(['أ', 'إ', 'آ', 'ٱ'], 'ا', $text);
        $text = str_replace('ة', 'ه', $text);
        $text = str_replace(['ى', 'ئ'], 'ي', $text);
        // Diacritics and the tatweel (ـ) are decoration: "أرفـع" is "أرفع".
        $text = preg_replace('/[\x{0610}-\x{061A}\x{0640}\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}]/u', '', $text);
        $text = preg_replace('/[^\p{Arabic}\p{L}\p{N}\s]/u', ' ', $text);

        return trim(preg_replace('/\s+/u', ' ', $text));
    }
}
