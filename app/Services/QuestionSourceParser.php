<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Smalot\PdfParser\Parser as PdfParser;

/**
 * Deterministic, provider-independent parser for structured question banks.
 *
 * It intentionally does not invent distractors or answers. Ambiguous material is
 * left for the optional AI pass instead of silently creating incorrect content.
 */
class QuestionSourceParser
{
    private const MAX_QUESTIONS = 60;

    /** @var array<string, string> */
    private const FIELD_ALIASES = [
        'question' => 'question_text', 'questiontext' => 'question_text', 'السؤال' => 'question_text', 'نصالسؤال' => 'question_text',
        'a' => 'option_a', 'optiona' => 'option_a', 'الخيارا' => 'option_a', 'الخيارأ' => 'option_a',
        'b' => 'option_b', 'optionb' => 'option_b', 'الخيارب' => 'option_b',
        'c' => 'option_c', 'optionc' => 'option_c', 'الخيارج' => 'option_c',
        'd' => 'option_d', 'optiond' => 'option_d', 'الخيار د' => 'option_d', 'الخيارد' => 'option_d',
        'answer' => 'correct_option', 'correctanswer' => 'correct_option', 'correctoption' => 'correct_option', 'الإجابة' => 'correct_option', 'الاجابة' => 'correct_option', 'الإجابةالصحيحة' => 'correct_option', 'الجواب' => 'correct_option',
        'explanation' => 'explanation', 'الشرح' => 'explanation', 'التفسير' => 'explanation',
        'difficulty' => 'difficulty', 'الصعوبة' => 'difficulty',
    ];

    /**
     * @return array{questions: array<int, array<string, mixed>>, warnings: array<int, string>, attempted: bool, source_type: string}
     */
    public function parse(?UploadedFile $file, ?string $sourceText): array
    {
        $questions = [];
        $warnings = [];
        $attempted = false;
        $sourceTypes = [];

        if (trim((string) $sourceText) !== '') {
            $attempted = true;
            $sourceTypes[] = 'text';
            $questions = array_merge($questions, $this->parseText((string) $sourceText, $warnings));
        }

        if ($file) {
            $extension = mb_strtolower((string) $file->getClientOriginalExtension());
            $sourceTypes[] = $extension ?: 'file';

            try {
                if ($extension === 'json') {
                    $attempted = true;
                    $questions = array_merge($questions, $this->parseJson((string) file_get_contents($file->getRealPath()), $warnings));
                } elseif ($extension === 'csv') {
                    $attempted = true;
                    $questions = array_merge($questions, $this->parseCsv((string) file_get_contents($file->getRealPath()), $warnings));
                } elseif ($extension === 'txt' || str_starts_with((string) $file->getMimeType(), 'text/')) {
                    $attempted = true;
                    $questions = array_merge($questions, $this->parseText((string) file_get_contents($file->getRealPath()), $warnings));
                } elseif ($extension === 'pdf') {
                    $attempted = true;
                    $text = (new PdfParser)->parseFile($file->getRealPath())->getText();
                    if (trim($text) === '') {
                        $warnings[] = 'ملف PDF لا يحتوي طبقة نص قابلة للقراءة محلياً؛ سيُجرّب التحليل البصري.';
                    } else {
                        $questions = array_merge($questions, $this->parseText($text, $warnings));
                    }
                }
            } catch (\Throwable $e) {
                report($e);
                $warnings[] = 'تعذرت القراءة المحلية للملف، لذلك سيُستخدم التحليل الذكي عند توفره.';
            }
        }

        return [
            'questions' => array_slice($questions, 0, self::MAX_QUESTIONS),
            'warnings' => array_values(array_unique($warnings)),
            'attempted' => $attempted,
            'source_type' => implode('+', array_unique($sourceTypes)) ?: 'unknown',
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function parseJson(string $contents, array &$warnings): array
    {
        $decoded = json_decode($this->stripBom($contents), true);
        $rows = is_array($decoded) ? ($decoded['questions'] ?? $decoded) : null;
        if (! is_array($rows)) {
            $warnings[] = 'ملف JSON غير صالح أو لا يحتوي مصفوفة questions.';

            return [];
        }

        return $this->normalizeRows($rows, $warnings, 'JSON');
    }

    /** @return array<int, array<string, mixed>> */
    private function parseCsv(string $contents, array &$warnings): array
    {
        $contents = $this->stripBom($contents);
        $lines = preg_split('/\R/u', trim($contents)) ?: [];
        if (count($lines) < 2) {
            $warnings[] = 'ملف CSV لا يحتوي صفوفاً كافية.';

            return [];
        }

        $delimiter = $this->detectDelimiter($lines[0]);
        $header = array_map(fn ($value) => $this->canonicalField((string) $value), str_getcsv($lines[0], $delimiter, '"', '\\'));
        $knownHeaderCount = count(array_filter($header));
        $rows = [];

        if ($knownHeaderCount >= 5) {
            foreach (array_slice($lines, 1) as $line) {
                if (trim($line) === '') {
                    continue;
                }
                $values = str_getcsv($line, $delimiter, '"', '\\');
                $row = [];
                foreach ($header as $index => $field) {
                    if ($field !== null) {
                        $row[$field] = $values[$index] ?? '';
                    }
                }
                $rows[] = $row;
            }
        } else {
            foreach ($lines as $line) {
                $values = str_getcsv($line, $delimiter, '"', '\\');
                if (count($values) >= 6) {
                    $rows[] = array_combine(
                        ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation', 'difficulty'],
                        array_pad(array_slice($values, 0, 8), 8, '')
                    );
                }
            }
        }

        return $this->normalizeRows($rows, $warnings, 'CSV');
    }

    /** @return array<int, array<string, mixed>> */
    private function parseText(string $contents, array &$warnings): array
    {
        $contents = str_replace(["\r\n", "\r", "\u{00A0}"], ["\n", "\n", ' '], $this->stripBom($contents));
        $lines = explode("\n", $contents);
        $questions = [];
        $current = null;
        $lastOption = null;
        $skipped = 0;

        $flush = function () use (&$current, &$questions, &$skipped, &$lastOption): void {
            if ($current === null) {
                return;
            }
            $normalized = $this->normalizeQuestion($current, count($questions) + 1);
            if ($normalized) {
                $questions[] = $normalized;
            } elseif (trim((string) ($current['question_text'] ?? '')) !== '') {
                $skipped++;
            }
            $current = null;
            $lastOption = null;
        };

        foreach ($lines as $rawLine) {
            $line = trim((string) preg_replace('/\s+/u', ' ', $rawLine));
            if ($line === '') {
                continue;
            }

            if ($this->matchAnswer($line, $answer)) {
                $current ??= ['question_text' => ''];
                $current['correct_option'] = $answer;
                $lastOption = null;

                continue;
            }
            if ($this->matchExplanation($line, $explanation)) {
                $current ??= ['question_text' => ''];
                $current['explanation'] = $explanation;
                $lastOption = null;

                continue;
            }
            if ($this->matchDifficulty($line, $difficulty)) {
                $current ??= ['question_text' => ''];
                $current['difficulty'] = $difficulty;

                continue;
            }

            $questionText = $this->questionStart($line);
            $hasOptions = $current && count(array_filter([
                $current['option_a'] ?? null, $current['option_b'] ?? null,
                $current['option_c'] ?? null, $current['option_d'] ?? null,
            ])) >= 2;
            if ($questionText !== null && ($current === null || $hasOptions || isset($current['correct_option']))) {
                $flush();
                $current = ['question_text' => $questionText];
                $lastOption = null;

                continue;
            }

            if ($this->matchOption($line, $option, $optionText, $markedCorrect)) {
                $current ??= ['question_text' => ''];
                $current['option_'.$option] = $optionText;
                if ($markedCorrect) {
                    $current['correct_option'] = $option;
                }
                $lastOption = $option;

                continue;
            }

            $current ??= ['question_text' => ''];
            if ($lastOption) {
                $current['option_'.$lastOption] = trim(($current['option_'.$lastOption] ?? '').' '.$line);
            } else {
                $current['question_text'] = trim(($current['question_text'] ?? '').' '.($questionText ?? $line));
            }
        }

        $flush();
        if ($skipped > 0) {
            $warnings[] = "تم تجاهل {$skipped} سؤال غير مكتمل محلياً (يلزم أربعة خيارات وإجابة محددة).";
        }

        return $questions;
    }

    /** @param array<int|string, mixed> $rows
     * @return array<int, array<string, mixed>>
     */
    private function normalizeRows(array $rows, array &$warnings, string $source): array
    {
        $questions = [];
        $skipped = 0;
        foreach ($rows as $index => $row) {
            if (! is_array($row)) {
                $skipped++;

                continue;
            }
            $canonical = [];
            foreach ($row as $key => $value) {
                $field = $this->canonicalField((string) $key) ?? (is_string($key) ? $key : null);
                if ($field) {
                    $canonical[$field] = $value;
                }
            }
            $question = $this->normalizeQuestion($canonical, (int) $index + 1);
            if ($question) {
                $questions[] = $question;
            } else {
                $skipped++;
            }
        }
        if ($skipped > 0) {
            $warnings[] = "تم تجاهل {$skipped} صف غير مكتمل من ملف {$source}.";
        }

        return $questions;
    }

    /** @param array<string, mixed> $row
     * @return array<string, mixed>|null
     */
    private function normalizeQuestion(array $row, int $index): ?array
    {
        $question = trim((string) ($row['question_text'] ?? ''));
        $options = [];
        foreach (['a', 'b', 'c', 'd'] as $key) {
            $options[$key] = trim((string) ($row['option_'.$key] ?? ''));
        }
        $correct = $this->normalizeAnswer((string) ($row['correct_option'] ?? ''), $options);

        if ($question === '' || in_array('', $options, true) || $correct === null) {
            return null;
        }

        return [
            'source_ref' => (string) ($row['source_ref'] ?? $index),
            'question_text' => $this->stripQuestionPrefix($question),
            'option_a' => $this->stripOptionPrefix($options['a']),
            'option_b' => $this->stripOptionPrefix($options['b']),
            'option_c' => $this->stripOptionPrefix($options['c']),
            'option_d' => $this->stripOptionPrefix($options['d']),
            'correct_option' => $correct,
            'explanation' => trim((string) ($row['explanation'] ?? '')),
            'difficulty' => $this->normalizeDifficulty((string) ($row['difficulty'] ?? ''), $question),
            'confidence' => 0.94,
        ];
    }

    private function matchAnswer(string $line, ?string &$answer): bool
    {
        if (! preg_match('/^(?:الإجابة(?:\s+الصحيحة)?|الاجابة(?:\s+الصحيحة)?|الجواب|الصحيح|answer|correct(?:\s+answer)?)\s*[:：\-]\s*(.+)$/iu', $line, $matches)) {
            return false;
        }
        $answer = trim($matches[1]);

        return true;
    }

    private function matchExplanation(string $line, ?string &$explanation): bool
    {
        if (! preg_match('/^(?:الشرح|التفسير|التوضيح|explanation|rationale)\s*[:：\-]\s*(.+)$/iu', $line, $matches)) {
            return false;
        }
        $explanation = trim($matches[1]);

        return true;
    }

    private function matchDifficulty(string $line, ?string &$difficulty): bool
    {
        if (! preg_match('/^(?:الصعوبة|difficulty)\s*[:：\-]\s*(.+)$/iu', $line, $matches)) {
            return false;
        }
        $difficulty = trim($matches[1]);

        return true;
    }

    private function matchOption(string $line, ?string &$option, ?string &$text, ?bool &$markedCorrect): bool
    {
        if (! preg_match('/^(\*|✓|✔)?\s*[\(\[]?\s*([A-Da-dأإابججدد1-4١-٤])\s*[\)\]\.\-:،]\s*(.+?)(?:\s*(\*|✓|✔))?$/u', $line, $matches)) {
            return false;
        }
        $option = $this->optionKey($matches[2]);
        if ($option === null) {
            return false;
        }
        $text = trim($matches[3]);
        $markedCorrect = trim((string) ($matches[1] ?? '')) !== '' || trim((string) ($matches[4] ?? '')) !== '';

        return $text !== '';
    }

    private function questionStart(string $line): ?string
    {
        if (preg_match('/^(?:س(?:ؤال)?|q(?:uestion)?)(?:\s*[0-9٠-٩]+)?(?:\s*[\)\.\-:،]\s*|\s+)(.+)$/iu', $line, $matches)) {
            return trim($matches[1]);
        }
        if (preg_match('/^[0-9٠-٩]+\s*[\)\.\-:،]\s*(.+)$/u', $line, $matches)) {
            return trim($matches[1]);
        }

        return null;
    }

    /** @param array<string, string> $options */
    private function normalizeAnswer(string $answer, array $options): ?string
    {
        $answer = trim((string) preg_replace('/^(?:الخيار|option)\s*/iu', '', $answer));
        $first = mb_substr($answer, 0, 1);
        if (($key = $this->optionKey($first)) !== null && (mb_strlen($answer) === 1 || preg_match('/^[A-Da-dأإابججدد1-4١-٤]\s*[\)\.\-:،]/u', $answer))) {
            return $key;
        }
        $fingerprint = fn ($value) => mb_strtolower((string) preg_replace('/[\p{P}\p{S}\s]+/u', '', trim($value)));
        $needle = $fingerprint($answer);
        foreach ($options as $key => $value) {
            if ($needle !== '' && $fingerprint($value) === $needle) {
                return $key;
            }
        }

        return null;
    }

    private function optionKey(string $value): ?string
    {
        return match (mb_strtolower(trim($value))) {
            'a', 'أ', 'إ', 'ا', '1', '١' => 'a',
            'b', 'ب', '2', '٢' => 'b',
            'c', 'ج', '3', '٣' => 'c',
            'd', 'د', '4', '٤' => 'd',
            default => null,
        };
    }

    private function normalizeDifficulty(string $difficulty, string $question): string
    {
        $value = mb_strtolower(trim($difficulty));
        if (in_array($value, ['easy', 'سهل', 'بسيط'], true)) {
            return 'easy';
        }
        if (in_array($value, ['hard', 'صعب', 'متقدم'], true)) {
            return 'hard';
        }
        if (in_array($value, ['medium', 'متوسط'], true)) {
            return 'medium';
        }
        if (preg_match('/\b(?:analy[sz]e|calculate|compare|evaluate|why)\b|(?:حلل|احسب|قارن|قيّم|علل|استنتج)/iu', $question)) {
            return 'hard';
        }
        if (preg_match('/\b(?:what|who|when|define|name)\b|(?:ما هو|ما هي|من هو|عرّف|اذكر)/iu', $question)) {
            return 'easy';
        }

        return 'medium';
    }

    private function canonicalField(string $field): ?string
    {
        $normalized = mb_strtolower(trim($this->stripBom($field)));
        $normalized = (string) preg_replace('/[_\-\s]+/u', '', $normalized);

        return self::FIELD_ALIASES[$normalized] ?? null;
    }

    private function detectDelimiter(string $header): string
    {
        $counts = [',' => substr_count($header, ','), ';' => substr_count($header, ';'), "\t" => substr_count($header, "\t")];
        arsort($counts);

        return (string) array_key_first($counts);
    }

    private function stripQuestionPrefix(string $value): string
    {
        return trim((string) preg_replace('/^(?:(?:س(?:ؤال)?|q(?:uestion)?)\s*)?[0-9٠-٩]+\s*[\)\.\-:،]\s*/iu', '', $value));
    }

    private function stripOptionPrefix(string $value): string
    {
        return trim((string) preg_replace('/^(?:\*|✓|✔)?\s*[\(\[]?[A-Da-dأإابججدد1-4١-٤]\s*[\)\]\.\-:،]\s*/u', '', $value));
    }

    private function stripBom(string $value): string
    {
        return preg_replace('/^\xEF\xBB\xBF/', '', $value) ?? $value;
    }
}
