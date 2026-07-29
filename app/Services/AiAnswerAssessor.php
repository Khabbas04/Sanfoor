<?php

namespace App\Services;

/**
 * How much should this answer be trusted, and what is it based on?
 *
 * Confidence is computed HERE, from things the application can actually observe —
 * how complete the student's record is, whether the courses they named were
 * resolved, whether validation had to drop anything, how large the sample behind
 * a statistic is, how clearly the question read. It is never taken from the
 * model: a language model's stated confidence is a fluent guess, and showing it
 * to a student as a number would be worse than showing nothing.
 */
class AiAnswerAssessor
{
    /**
     * @param array{
     *     intent?: ?array,
     *     completeness?: array,
     *     validation?: array,
     *     asked_course_ids?: int[],
     *     resolved_course_ids?: int[],
     *     available_course_count?: int,
     *     passed_hours?: int,
     *     used_fallback?: bool
     * } $signals
     * @return array{score: float, level: string, reasons: list<array{code: string, weight: float, detail?: string}>}
     */
    public function confidence(array $signals): array
    {
        // A locally generated fallback answer is a holding reply, not advice.
        if (!empty($signals['used_fallback'])) {
            return [
                'score' => 0.3,
                'level' => 'low',
                'reasons' => [['code' => 'fallback_answer', 'weight' => 1.0]],
            ];
        }

        $factors = [];

        // 1. How clearly the question read (0.25).
        $intent = $signals['intent'] ?? null;
        $clarity = $intent === null ? 0.6 : (float) ($intent['confidence'] ?? 0.6);
        if (!empty($intent['requires_clarification'])) {
            $clarity = min($clarity, 0.45);
        }
        $factors[] = ['code' => 'intent_clarity', 'value' => $clarity, 'weight' => 0.25];

        // 2. Whether the data needed actually exists (0.30) — the heaviest factor,
        //    because a confident answer over missing data is the worst outcome.
        $completeness = $signals['completeness'] ?? [];
        $grounded = $completeness['grounded'] ?? true;
        $dataValue = $grounded ? 1.0 : 0.2;
        if (($completeness['has_academic_records'] ?? true) === false) {
            $dataValue = min($dataValue, 0.5);
        }
        $factors[] = ['code' => 'data_completeness', 'value' => $dataValue, 'weight' => 0.30];

        // 3. Did we find what the student named (0.15)?
        $asked = array_map('intval', $signals['asked_course_ids'] ?? []);
        $resolved = array_map('intval', $signals['resolved_course_ids'] ?? []);
        if ($asked === []) {
            $entityValue = 1.0;
        } else {
            $found = count(array_intersect($asked, $resolved));
            $entityValue = $found === 0 ? 0.3 : $found / count($asked);
        }
        $factors[] = ['code' => 'entity_match', 'value' => $entityValue, 'weight' => 0.15];

        // 4. Did validation have to throw anything away (0.20)?
        $validation = $signals['validation'] ?? [];
        $dropped = (int) ($validation['dropped_ids'] ?? 0);
        $validationValue = match (true) {
            ($validation['valid'] ?? true) === false => 0.25,
            $dropped > 2 => 0.4,
            $dropped > 0 => 0.7,
            default => 1.0,
        };
        $factors[] = ['code' => 'validation', 'value' => $validationValue, 'weight' => 0.20];

        // 5. Is there enough behind the numbers to say anything (0.10)?
        $sample = min(1.0, ((int) ($signals['available_course_count'] ?? 0)) / 8);
        $factors[] = ['code' => 'sample_size', 'value' => max(0.2, $sample), 'weight' => 0.10];

        $score = 0.0;
        foreach ($factors as $factor) {
            $score += $factor['value'] * $factor['weight'];
        }

        // A weighted average is not enough on its own: a clearly phrased question
        // over data that does not exist still scored "medium", which is exactly the
        // answer a student should not trust. Missing grounding caps the result.
        if (!$grounded) {
            $score = min($score, 0.45);
        }

        $score = round(min(0.97, max(0.05, $score)), 2);

        // Only the factors that actually held the score down are worth reporting:
        // "why is this uncertain" is useful, "why is this fine" is noise.
        $reasons = [];
        foreach ($factors as $factor) {
            if ($factor['value'] < 0.8) {
                $reasons[] = [
                    'code' => $factor['code'],
                    'weight' => $factor['weight'],
                    'detail' => $this->explain($factor['code']),
                ];
            }
        }

        return [
            'score' => $score,
            'level' => $score >= 0.75 ? 'high' : ($score >= 0.5 ? 'medium' : 'low'),
            'reasons' => $reasons,
        ];
    }

    /**
     * Merge source lists into one citable set.
     *
     * Sources arrive from retrieval, from tools and from the regulations index,
     * often overlapping. They are merged by type so the student sees "your study
     * plan" once, covering every entity that contributed to it.
     */
    public function mergeSources(array ...$lists): array
    {
        $byType = [];

        foreach ($lists as $list) {
            foreach ($list as $source) {
                if (!is_array($source) || empty($source['type'])) {
                    continue;
                }

                $type = (string) $source['type'];
                if (!isset($byType[$type])) {
                    $byType[$type] = [
                        'type' => $type,
                        'label' => (string) ($source['label'] ?? $type),
                        'entity_ids' => [],
                    ];
                }

                foreach (($source['entity_ids'] ?? []) as $id) {
                    $byType[$type]['entity_ids'][] = (int) $id;
                }
            }
        }

        return array_values(array_map(function (array $source) {
            $source['entity_ids'] = array_values(array_unique($source['entity_ids']));

            return $source;
        }, $byType));
    }

    /** Sources built from the regulation chunks DocumentRagEngine returned. */
    public function documentSources(array $documentContext): array
    {
        if ($documentContext === []) {
            return [];
        }

        $articles = [];
        foreach ($documentContext as $chunk) {
            // Chunks are split on "**المادة", so the article number is right there.
            if (preg_match('/الماد[ةه]\s*\(?\s*(\d{1,3})/u', (string) ($chunk['text'] ?? ''), $matches)) {
                $articles[] = (int) $matches[1];
            }
        }

        return [[
            'type' => 'regulations',
            'label' => 'القوانين والتعليمات الجامعية',
            'entity_ids' => array_values(array_unique($articles)),
        ]];
    }

    private function explain(string $code): string
    {
        return match ($code) {
            'intent_clarity' => 'السؤال يحتمل أكثر من قراءة.',
            'data_completeness' => 'بيانات هذا الموضوع غير مكتملة أو غير مربوطة بالنظام.',
            'entity_match' => 'لم يتم التعرّف على كل ما ذُكر من مواد.',
            'validation' => 'بعض ما اقترحه المساعد لم يجتز التحقق وتم استبعاده.',
            'sample_size' => 'عدد المواد المتاحة للمقارنة قليل.',
            default => '',
        };
    }
}
