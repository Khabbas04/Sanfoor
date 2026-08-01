<?php

namespace App\Services;

use App\Models\Chapter;
use App\Models\Question;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class QuestionBulkImportService
{
    private const MAX_QUESTIONS = 60;

    private const OPTION_KEYS = ['a', 'b', 'c', 'd'];

    public function __construct(private readonly GeminiService $gemini) {}

    /**
     * @return array{questions: array<int, array<string, mixed>>, warnings: array<int, string>, summary: array<string, int>}
     */
    public function analyze(Chapter $chapter, ?UploadedFile $file, ?string $sourceText): array
    {
        $chapter->loadMissing('course:id,name,code,is_quiz_only');
        abort_unless($chapter->course && $chapter->course->is_quiz_only, 422, 'الشابتر المحدد لا يتبع مادة مفعلة للاختبارات.');

        $parts = [['text' => $this->analysisPrompt($chapter)]];
        $trimmedText = trim((string) $sourceText);

        if ($trimmedText !== '') {
            $parts[] = ['text' => "\n--- نص مرفق من الأدمن ---\n".mb_substr($trimmedText, 0, 100000)];
        }

        if ($file) {
            $mime = (string) ($file->getMimeType() ?: $file->getClientMimeType());
            $extension = strtolower((string) $file->getClientOriginalExtension());

            if (in_array($extension, ['txt', 'csv', 'json'], true) || str_starts_with($mime, 'text/')) {
                $contents = (string) file_get_contents($file->getRealPath());
                $parts[] = ['text' => "\n--- محتوى الملف {$file->getClientOriginalName()} ---\n".mb_substr($contents, 0, 120000)];
            } else {
                $parts[] = [
                    'inlineData' => [
                        'mimeType' => $mime,
                        'data' => base64_encode((string) file_get_contents($file->getRealPath())),
                    ],
                ];
            }
        }

        try {
            $raw = $this->gemini->callGeminiAPI([
                ['role' => 'user', 'parts' => $parts],
            ], [
                'request_type' => 'question_bulk_import',
                'timeout' => 70,
                'systemInstruction' => [
                    'parts' => [[
                        'text' => 'أنت مدقق بنك أسئلة جامعي. استخرج المعلومات بدقة، لا تغيّر الإجابة الصحيحة، ولا تخمّن سؤالاً غير موجود. أعد JSON فقط حسب المخطط.',
                    ]],
                ],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => 0.15,
                    'maxOutputTokens' => 32768,
                    'responseSchema' => $this->responseSchema(),
                ],
            ]);
        } catch (\Throwable $e) {
            report($e);
            throw new RuntimeException('تعذر تحليل الملف بالذكاء الاصطناعي حالياً. تحقق من مفاتيح Gemini أو جرّب ملفاً أصغر.', previous: $e);
        }

        $parsed = $this->gemini->parseJsonResponse($raw);
        if (! isset($parsed['questions']) || ! is_array($parsed['questions'])) {
            throw new RuntimeException('لم يستطع النظام استخراج أسئلة واضحة. استخدم نموذجاً يحتوي على السؤال والإجابة بشكل صريح.');
        }

        return $this->preparePreview($chapter, $parsed);
    }

    /**
     * @param  array<int, array<string, mixed>>  $questions
     * @return array{created: int, skipped_duplicates: int, ids: array<int, int>}
     */
    public function store(Chapter $chapter, array $questions): array
    {
        $chapter->loadMissing('course:id,is_quiz_only');
        abort_unless($chapter->course && $chapter->course->is_quiz_only, 422, 'الشابتر المحدد لا يتبع مادة مفعلة للاختبارات.');

        return DB::transaction(function () use ($chapter, $questions) {
            $known = Question::query()
                ->where('chapter_id', $chapter->id)
                ->pluck('question_text')
                ->mapWithKeys(fn ($text) => [$this->fingerprint((string) $text) => true])
                ->all();

            $createdIds = [];
            $skipped = 0;

            foreach (array_slice($questions, 0, self::MAX_QUESTIONS) as $question) {
                $fingerprint = $this->fingerprint((string) $question['question_text']);
                if ($fingerprint === '' || isset($known[$fingerprint])) {
                    $skipped++;

                    continue;
                }

                $created = Question::create([
                    'course_id' => $chapter->course_id,
                    'chapter_id' => $chapter->id,
                    'question_text' => $this->limit($question['question_text'], 5000),
                    'option_a' => $this->limit($question['option_a'], 1000),
                    'option_b' => $this->limit($question['option_b'], 1000),
                    'option_c' => $this->limit($question['option_c'], 1000),
                    'option_d' => $this->limit($question['option_d'], 1000),
                    'correct_option' => $question['correct_option'],
                    'explanation' => $this->nullableLimit($question['explanation'] ?? null, 3000),
                    'difficulty' => $question['difficulty'],
                    'is_active' => (bool) ($question['is_active'] ?? true),
                ]);

                $createdIds[] = $created->id;
                $known[$fingerprint] = true;
            }

            return [
                'created' => count($createdIds),
                'skipped_duplicates' => $skipped,
                'ids' => $createdIds,
            ];
        });
    }

    /** @return array<string, mixed> */
    private function responseSchema(): array
    {
        return [
            'type' => 'OBJECT',
            'required' => ['questions', 'warnings'],
            'properties' => [
                'questions' => [
                    'type' => 'ARRAY',
                    'maxItems' => self::MAX_QUESTIONS,
                    'items' => [
                        'type' => 'OBJECT',
                        'required' => ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'difficulty', 'confidence'],
                        'properties' => [
                            'source_ref' => ['type' => 'STRING'],
                            'question_text' => ['type' => 'STRING'],
                            'option_a' => ['type' => 'STRING'],
                            'option_b' => ['type' => 'STRING'],
                            'option_c' => ['type' => 'STRING'],
                            'option_d' => ['type' => 'STRING'],
                            'correct_option' => ['type' => 'STRING', 'enum' => self::OPTION_KEYS],
                            'explanation' => ['type' => 'STRING'],
                            'difficulty' => ['type' => 'STRING', 'enum' => ['easy', 'medium', 'hard']],
                            'confidence' => ['type' => 'NUMBER', 'minimum' => 0, 'maximum' => 1],
                        ],
                    ],
                ],
                'warnings' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING']],
            ],
        ];
    }

    private function analysisPrompt(Chapter $chapter): string
    {
        return <<<PROMPT
حلّل المصدر المرفق وحوّله إلى بنك أسئلة اختيار من متعدد لمادة "{$chapter->course->name}" ({$chapter->course->code})، الشابتر "{$chapter->title}".

قواعد إلزامية:
1. استخرج كل سؤال مستقل مع إجابته. الحد الأقصى 60 سؤالاً.
2. إذا كان السؤال يحتوي خيارات، حافظ عليها وعلى الإجابة الصحيحة كما هي.
3. إذا كان بصيغة سؤال/جواب فقط، اجعل الجواب الصحيح خياراً وأنشئ ثلاثة مشتتات منطقية وقريبة، دون تغيير حقيقة الجواب.
4. لا تنشئ سؤالاً من فقرة لا تحتوي سؤالاً أو جواباً واضحاً، وضع سبب التجاهل في warnings.
5. أزل أرقام الترتيب من بداية نص السؤال والخيارات.
6. اكتب شرحاً موجزاً يوضح سبب صحة الإجابة. إذا لم يسمح المصدر بشرح موثوق، اتركه فارغاً.
7. صنّف الصعوبة: easy للتذكر المباشر، medium للفهم والتطبيق، hard للتحليل أو الخطوات المتعددة.
8. confidence تمثل ثقتك بصحة الاستخراج والإجابة من 0 إلى 1.
9. لا تكرر السؤال نفسه، ولا تضف عبارات مثل "حسب الملف".
10. أعد العربية كما هي والإنجليزية كما هي، ويمكن إبقاء المصطلحات التقنية بلغتها الأصلية.
PROMPT;
    }

    /**
     * @param  array<string, mixed>  $parsed
     * @return array{questions: array<int, array<string, mixed>>, warnings: array<int, string>, summary: array<string, int>}
     */
    private function preparePreview(Chapter $chapter, array $parsed): array
    {
        $warnings = collect($parsed['warnings'] ?? [])->filter(fn ($item) => is_string($item) && trim($item) !== '')->values();
        $existing = Question::query()
            ->where('chapter_id', $chapter->id)
            ->pluck('question_text')
            ->mapWithKeys(fn ($text) => [$this->fingerprint((string) $text) => true])
            ->all();
        $seen = [];
        $questions = [];
        $incomplete = 0;
        $duplicates = 0;

        foreach (array_slice($parsed['questions'], 0, self::MAX_QUESTIONS) as $index => $rawQuestion) {
            if (! is_array($rawQuestion)) {
                $incomplete++;

                continue;
            }

            $question = $this->sanitizeQuestion($rawQuestion, $index);
            if ($question === null) {
                $incomplete++;

                continue;
            }

            $fingerprint = $this->fingerprint($question['question_text']);
            if (isset($existing[$fingerprint]) || isset($seen[$fingerprint])) {
                $duplicates++;

                continue;
            }

            $seen[$fingerprint] = true;
            $questions[] = $this->balanceCorrectOption($question, count($questions));
        }

        if ($incomplete > 0) {
            $warnings->push("تم تجاهل {$incomplete} عناصر لأنها لا تحتوي سؤالاً وأربعة خيارات وإجابة صحيحة مكتملة.");
        }
        if ($duplicates > 0) {
            $warnings->push("تم استبعاد {$duplicates} أسئلة مكررة داخل الملف أو موجودة مسبقاً في الشابتر.");
        }

        $collection = collect($questions);

        return [
            'questions' => $questions,
            'warnings' => $warnings->unique()->values()->all(),
            'summary' => [
                'total' => count($questions),
                'easy' => $collection->where('difficulty', 'easy')->count(),
                'medium' => $collection->where('difficulty', 'medium')->count(),
                'hard' => $collection->where('difficulty', 'hard')->count(),
                'needs_review' => $collection->where('needs_review', true)->count(),
                'duplicates' => $duplicates,
                'incomplete' => $incomplete,
            ],
        ];
    }

    /** @param array<string, mixed> $raw */
    private function sanitizeQuestion(array $raw, int $index): ?array
    {
        $correct = strtolower(trim((string) ($raw['correct_option'] ?? '')));
        $correct = str_replace(['option_', 'الخيار '], '', $correct);
        $correct = substr($correct, 0, 1);
        $difficulty = strtolower(trim((string) ($raw['difficulty'] ?? 'medium')));
        $confidence = max(0, min(1, (float) ($raw['confidence'] ?? 0.5)));

        $question = [
            'preview_id' => (string) Str::uuid(),
            'source_ref' => $this->limit((string) ($raw['source_ref'] ?? ($index + 1)), 100),
            'question_text' => $this->limit((string) ($raw['question_text'] ?? ''), 5000),
            'option_a' => $this->limit((string) ($raw['option_a'] ?? ''), 1000),
            'option_b' => $this->limit((string) ($raw['option_b'] ?? ''), 1000),
            'option_c' => $this->limit((string) ($raw['option_c'] ?? ''), 1000),
            'option_d' => $this->limit((string) ($raw['option_d'] ?? ''), 1000),
            'correct_option' => in_array($correct, self::OPTION_KEYS, true) ? $correct : '',
            'explanation' => $this->nullableLimit($raw['explanation'] ?? null, 3000) ?? '',
            'difficulty' => in_array($difficulty, ['easy', 'medium', 'hard'], true) ? $difficulty : 'medium',
            'confidence' => round($confidence, 2),
            'needs_review' => $confidence < 0.72,
            'is_active' => true,
            'selected' => true,
        ];

        foreach (['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option'] as $required) {
            if (trim((string) $question[$required]) === '') {
                return null;
            }
        }

        return $question;
    }

    /** @param array<string, mixed> $question */
    private function balanceCorrectOption(array $question, int $index): array
    {
        $targets = ['a', 'c', 'b', 'd'];
        $target = $targets[$index % count($targets)];
        $current = $question['correct_option'];

        if ($current !== $target) {
            $currentKey = 'option_'.$current;
            $targetKey = 'option_'.$target;
            [$question[$currentKey], $question[$targetKey]] = [$question[$targetKey], $question[$currentKey]];
            $question['correct_option'] = $target;
        }

        return $question;
    }

    private function fingerprint(string $text): string
    {
        $normalized = mb_strtolower(trim($text));

        return (string) preg_replace('/[\p{P}\p{S}\s]+/u', '', $normalized);
    }

    private function limit(mixed $value, int $length): string
    {
        return trim(mb_substr((string) $value, 0, $length));
    }

    private function nullableLimit(mixed $value, int $length): ?string
    {
        $limited = $this->limit($value, $length);

        return $limited === '' ? null : $limited;
    }
}
