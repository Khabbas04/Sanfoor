<?php

namespace App\AiTools\Concerns;

trait BuildsToolResults
{
    /** @param array<int, array{type: string, label: string, entity_ids: int[]}> $sources */
    protected function ok(array $data, array $sources = [], array $warnings = []): array
    {
        return [
            'ok' => true,
            'data' => $data,
            'errors' => [],
            'warnings' => $warnings,
            'sources' => $sources,
        ];
    }

    protected function fail(string $code, string $message, array $data = []): array
    {
        return [
            'ok' => false,
            'data' => $data,
            'errors' => [['code' => $code, 'message' => $message]],
            'warnings' => [],
            'sources' => [],
        ];
    }

    /**
     * The honest answer when a question needs data this deployment does not hold.
     *
     * There is no academic-calendar table and no sections/instructors table, so a
     * confident answer would be the model's general knowledge dressed up as the
     * student's own record. The referral is the correct output, not a shortfall.
     */
    protected function unavailable(string $what, string $referral): array
    {
        return [
            'ok' => false,
            'data' => ['available' => false, 'referral' => $referral],
            'errors' => [[
                'code' => 'data_unavailable',
                'message' => "لا يوجد مصدر بيانات مربوط لـ{$what} — أَحِل الطالب للجهة المختصة ولا تجب من معرفتك العامة.",
            ]],
            'warnings' => [],
            'sources' => [],
        ];
    }
}
