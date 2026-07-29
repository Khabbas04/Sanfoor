<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Models\AcademicPeriod;
use App\Models\User;

/**
 * Academic-calendar questions.
 *
 * There is no calendar table in this deployment. Rather than let the model answer
 * exam dates and withdrawal deadlines from its general knowledge — the failure
 * mode that gets a student to the registrar on the wrong day — this tool reports
 * the current term (which IS known) and refers the rest to the official source.
 *
 * When a calendar is added later, only this tool changes.
 */
class GetCalendarEventsTool implements AiTool
{
    use BuildsToolResults;

    public function name(): string
    {
        return 'get_calendar_events';
    }

    public function description(): string
    {
        return 'مواعيد التقويم الأكاديمي. لا يوجد مصدر مربوط حالياً، فيُحال الطالب للمصدر الرسمي.';
    }

    public function parameters(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'event_type' => ['type' => 'STRING', 'description' => 'نوع الحدث: امتحانات، انسحاب، بداية فصل...'],
            ],
        ];
    }

    public function run(User $user, array $arguments): array
    {
        $period = AcademicPeriod::current();

        $result = $this->unavailable(
            'التقويم الأكاديمي',
            'موقع جامعة الزرقاء الرسمي أو دائرة القبول والتسجيل'
        );

        // The current term is real data and worth returning even here: it lets the
        // reply be specific about which semester the student is asking about.
        $result['data']['current_period'] = $period === null ? null : [
            'label' => $period->displayLabel(),
            'academic_year' => $period->academic_year,
            'academic_term' => $period->academic_term,
            'is_summer' => (int) $period->academic_term === 3,
        ];

        return $result;
    }
}
