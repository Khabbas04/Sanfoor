<?php

namespace App\AiTools;

use App\AiTools\Concerns\BuildsToolResults;
use App\Models\AcademicPeriod;
use App\Models\CourseSection;
use App\Models\User;

/**
 * Look up offered course sections, schedules, instructors, and halls for the current term.
 */
class GetCourseSectionsTool implements AiTool
{
    use BuildsToolResults;

    public function name(): string
    {
        return 'get_course_sections';
    }

    public function description(): string
    {
        return 'البحث في الشُعب الدراسية وأسماء الدكاترة والمدرسين وأوقات المحاضرات والقاعات المطروحة للفصل الحالي.';
    }

    public function parameters(): array
    {
        return [
            'type' => 'OBJECT',
            'properties' => [
                'course_ids' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'INTEGER'],
                    'description' => 'أرقام المواد (IDs) المطلوب معرفة شعبها ودكاترتها',
                ],
                'course_name' => [
                    'type' => 'STRING',
                    'description' => 'اسم المادة للبحث عن شعبها ودكاترتها',
                ],
                'instructor_name' => [
                    'type' => 'STRING',
                    'description' => 'اسم الدكتور أو المدرس للبحث عن المواد والشعب التي يدرسها',
                ],
            ],
        ];
    }

    public function run(User $user, array $arguments): array
    {
        $period = AcademicPeriod::current();
        $year = $period ? $period->academic_year : '2026/2027';
        $term = $period ? (int) $period->academic_term : 1;

        $courseIds = array_filter(array_map('intval', (array) ($arguments['course_ids'] ?? [])));
        $rawCourseName = trim((string) ($arguments['course_name'] ?? ''));
        $instructorName = trim((string) ($arguments['instructor_name'] ?? ''));

        // Clean user conversational phrases from courseName if it was passed from a raw prompt
        $cleanCourseName = $rawCourseName;
        if ($cleanCourseName !== '') {
            $stopWords = ['اعطيني', 'اعطني', 'اسماء', 'أسماء', 'اسامي', 'دكاترة', 'دكاتره', 'دكتور', 'مدرس', 'مدرسين', 'استاذ', 'أستاذ', 'مين', 'بدرس', 'يدرس', 'يعطي', 'مادة', 'ماده', 'مساق', 'شعب', 'شعبة', 'شعبة', 'جدول', 'عن', 'في', 'شو', 'ايش', 'لو سمحت', 'بدي', 'ابي'];
            $pattern = '/\b(' . implode('|', array_map('preg_quote', $stopWords)) . ')\b/u';
            $cleanCourseName = trim(preg_replace($pattern, '', $cleanCourseName));
            $cleanCourseName = trim(preg_replace('/\s+/u', ' ', $cleanCourseName));
        }

        $query = CourseSection::with('course')
            ->where('academic_year', $year)
            ->where('academic_term', $term);

        if (!empty($courseIds)) {
            $query->whereIn('course_id', $courseIds);
        } elseif ($cleanCourseName !== '') {
            $query->whereHas('course', function ($q) use ($cleanCourseName, $rawCourseName) {
                $q->where('name', 'LIKE', "%{$cleanCourseName}%")
                  ->orWhere('name', 'LIKE', "%{$rawCourseName}%");
            });
        }

        if ($instructorName !== '') {
            $query->where('instructor', 'LIKE', "%{$instructorName}%");
        }

        $sections = $query->limit(40)->get();

        if ($sections->isEmpty()) {
            // Fallback: search without academic period if nothing found (e.g. if period in DB doesn't match exactly)
            $fallbackSections = CourseSection::with('course');
            if (!empty($courseIds)) {
                $fallbackSections->whereIn('course_id', $courseIds);
            } elseif ($cleanCourseName !== '') {
                $fallbackSections->whereHas('course', function ($q) use ($cleanCourseName, $rawCourseName) {
                    $q->where('name', 'LIKE', "%{$cleanCourseName}%")
                      ->orWhere('name', 'LIKE', "%{$rawCourseName}%");
                });
            }
            if ($instructorName !== '') {
                $fallbackSections->where('instructor', 'LIKE', "%{$instructorName}%");
            }
            $sections = $fallbackSections->limit(40)->get();
        }

        if ($sections->isEmpty()) {
            $anyCount = CourseSection::count();
            if ($anyCount === 0) {
                return $this->unavailable(
                    'جدول الشُعب وأسماء الدكاترة',
                    'بوابة التسجيل الذاتي للجامعة (لم يتم إدخال جدول الشُعب بعد)'
                );
            }

            return $this->ok([
                'sections' => [],
                'message' => 'لم يتم العثور على شُعب مطروحة تطابق هذا البحث في جدول الفصل الحالي.',
            ]);
        }

        $formatted = [];
        foreach ($sections as $sec) {
            $formatted[] = [
                'course_id' => (int) $sec->course_id,
                'course_name' => $sec->course?->name ?? 'غير محدد',
                'course_code' => $sec->course?->code ?? '',
                'instructor' => $sec->instructor ?: 'غير محدد',
                'days' => $sec->days ?: '',
                'time' => $sec->time ?: '',
                'hall' => $sec->hall ?: '',
                'capacity' => $sec->capacity,
            ];
        }

        return $this->ok([
            'academic_period' => $period?->displayLabel() ?? "{$year} - فصل {$term}",
            'total_sections' => count($formatted),
            'sections' => $formatted,
        ], [[
            'type' => 'course_sections',
            'label' => 'جدول الشُعب والمحاضرات الرسمي',
            'entity_ids' => array_values(array_unique(array_filter(array_column($formatted, 'course_id')))),
        ]]);
    }
}
