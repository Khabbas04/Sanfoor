<?php

namespace App\Services;

use App\Http\Controllers\TreeController;
use App\Models\Course;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CourseBulkImportService
{
    private const TYPES = ['compulsory', 'elective', 'supporting', 'university_req'];

    /**
     * @return array{created:int,updated:int,skipped:int,errors:array,courses:array}
     */
    public function import(array $rows, int $majorId, int $planVersion, string $mode = 'upsert'): array
    {
        return DB::transaction(function () use ($rows, $majorId, $planVersion, $mode) {
            $normalizedRows = collect($rows)
                ->map(fn (array $row, int $index) => $this->normalizeRow($row, $index + 2))
                ->filter(fn (array $row) => $row['code'] !== '' || $row['name'] !== '')
                ->values();

            $seenCodes = [];
            $errors = [];
            $validRows = [];

            foreach ($normalizedRows as $row) {
                if ($row['code'] === '' || $row['name'] === '') {
                    $errors[] = ['line' => $row['line'], 'message' => 'رمز المادة واسمها مطلوبان.'];

                    continue;
                }

                if (isset($seenCodes[$row['code']])) {
                    $errors[] = ['line' => $row['line'], 'message' => "رمز المادة {$row['code']} مكرر داخل الملف."];

                    continue;
                }

                $seenCodes[$row['code']] = true;
                $validRows[] = $row;
            }

            $created = 0;
            $updated = 0;
            $courseIds = [];
            $prerequisitesByCourse = [];

            foreach ($validRows as $row) {
                $course = Course::query()->firstOrNew([
                    'code' => $row['code'],
                    'major_id' => $majorId,
                    'study_plan_version' => $planVersion,
                ]);

                $wasNew = ! $course->exists;
                $course->fill([
                    'name' => $row['name'],
                    'credit_hours' => $row['credit_hours'],
                    'difficulty_level' => $row['difficulty_level'],
                    'minimum_passed_hours' => $row['minimum_passed_hours'],
                    'type' => $row['type'],
                    'semester' => $row['semester'],
                    'major_id' => $majorId,
                    'study_plan_version' => $planVersion,
                    'description' => $row['description'] ?: null,
                    'is_quiz_only' => false,
                ])->save();

                $wasNew ? $created++ : $updated++;
                $courseIds[] = $course->id;
                $prerequisitesByCourse[$course->id] = $row['prerequisites'];
            }

            $coursesByCode = Course::query()
                ->where('study_plan_version', $planVersion)
                ->where(function ($query) use ($majorId) {
                    $query->where('major_id', $majorId)->orWhereNull('major_id');
                })
                ->get(['id', 'code'])
                ->keyBy(fn (Course $course) => $this->normalizeCode($course->code));

            foreach ($prerequisitesByCourse as $courseId => $codes) {
                $prerequisiteIds = collect($codes)
                    ->map(fn (string $code) => $coursesByCode->get($code)?->id)
                    ->filter(fn ($id) => $id && (int) $id !== (int) $courseId)
                    ->unique()
                    ->values()
                    ->all();

                Course::query()->find($courseId)?->prerequisites()->sync($prerequisiteIds);
            }

            if ($mode === 'replace' && $courseIds !== []) {
                Course::query()
                    ->where('major_id', $majorId)
                    ->where('study_plan_version', $planVersion)
                    ->where('is_quiz_only', false)
                    ->whereNotIn('id', $courseIds)
                    ->delete();
            }

            TreeController::flushCourseTreeCache();

            $courses = Course::query()
                ->whereIn('id', $courseIds)
                ->with(['major', 'prerequisites'])
                ->get()
                ->values()
                ->all();

            return [
                'created' => $created,
                'updated' => $updated,
                'skipped' => count($errors),
                'errors' => array_slice($errors, 0, 100),
                'courses' => $courses,
            ];
        });
    }

    private function normalizeRow(array $row, int $line): array
    {
        $mappedType = trim((string) ($row['mapped_type'] ?? $row['mappedType'] ?? $row['type'] ?? ''));

        return [
            'line' => (int) ($row['line'] ?? $line),
            'code' => $this->normalizeCode((string) ($row['code'] ?? '')),
            'name' => trim((string) ($row['name'] ?? '')),
            'credit_hours' => $this->boundedInteger($row['credit_hours'] ?? 3, 0, 12, 3),
            'difficulty_level' => $this->boundedInteger($row['difficulty_level'] ?? 3, 1, 5, 3),
            'minimum_passed_hours' => $this->nullableBoundedInteger($row['minimum_passed_hours'] ?? null, 1, 200),
            'type' => in_array($mappedType, self::TYPES, true) ? $mappedType : $this->mapType((string) ($row['type'] ?? '')),
            'semester' => $this->boundedInteger($row['semester'] ?? 1, 1, 12, 1),
            'description' => trim((string) ($row['description'] ?? '')),
            'prerequisites' => collect(preg_split('/[,;|،]+/u', (string) ($row['prerequisites'] ?? '')) ?: [])
                ->map(fn ($code) => $this->normalizeCode((string) $code))
                ->filter()
                ->unique()
                ->values()
                ->all(),
        ];
    }

    private function normalizeCode(string $code): string
    {
        return Str::upper(trim($code, " \t\n\r\0\x0B\"'"));
    }

    private function mapType(string $type): string
    {
        $type = Str::lower(trim($type));

        return match (true) {
            str_contains($type, 'اختياري'), str_contains($type, 'elective') => 'elective',
            str_contains($type, 'مساند'), str_contains($type, 'supporting') => 'supporting',
            str_contains($type, 'جامعة'), str_contains($type, 'university') => 'university_req',
            default => 'compulsory',
        };
    }

    private function boundedInteger(mixed $value, int $min, int $max, int $default): int
    {
        $value = filter_var($value, FILTER_VALIDATE_INT);

        return $value !== false && $value >= $min && $value <= $max ? (int) $value : $default;
    }

    private function nullableBoundedInteger(mixed $value, int $min, int $max): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $value = filter_var($value, FILTER_VALIDATE_INT);

        return $value !== false && $value >= $min && $value <= $max ? (int) $value : null;
    }
}
