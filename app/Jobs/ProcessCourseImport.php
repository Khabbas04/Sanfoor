<?php

namespace App\Jobs;

use App\Models\Course;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessCourseImport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 300;

    public $tries = 1;

    protected $filePath;

    protected $rowsPayload;

    protected $majorId;

    protected $studyPlanVersion;

    protected $adminId;

    protected $replaceMissing;

    public function __construct($filePath, $rowsPayload, $majorId, $studyPlanVersion, $adminId, bool $replaceMissing = false)
    {
        $this->filePath = $filePath;
        $this->rowsPayload = $rowsPayload;
        $this->majorId = $majorId;
        $this->studyPlanVersion = $studyPlanVersion;
        $this->adminId = $adminId;
        $this->replaceMissing = $replaceMissing;
    }

    public function handle(): void
    {
        Log::info('Starting Course Import Job', [
            'admin_id' => $this->adminId,
            'major_id' => $this->majorId,
        ]);

        $normalizedRows = [];
        $count = 0;

        if ($this->rowsPayload && is_array($this->rowsPayload) && count($this->rowsPayload) > 0) {
            foreach ($this->rowsPayload as $idx => $row) {
                if (is_array($row)) {
                    $normalizedRows[] = $this->formatRow($row, $idx + 1);
                }
            }
        } elseif ($this->filePath && file_exists(storage_path('app/'.$this->filePath))) {
            $handle = fopen(storage_path('app/'.$this->filePath), 'r');
            if ($handle) {
                $headers = fgetcsv($handle);
                if ($headers && count($headers) > 0) {
                    $columnIndexes = $this->detectCsvColumns($headers);
                    if ($columnIndexes['code'] !== -1 && $columnIndexes['name'] !== -1) {
                        while (($row = fgetcsv($handle)) !== false) {
                            $normalizedRows[] = [
                                'line' => (int) ($count + 2),
                                'code' => $this->cleanCourseCode($this->getCsvCell($row, $columnIndexes['code'])),
                                'name' => $this->getCsvCell($row, $columnIndexes['name']),
                                'credit_hours' => $this->parseCsvInteger($this->getCsvCell($row, $columnIndexes['credit_hours']), 3, 0, 12) ?? 3,
                                'raw_type' => $this->getCsvCell($row, $columnIndexes['type']),
                                'raw_category' => $this->getCsvCell($row, $columnIndexes['category']),
                                'raw_delivery_mode' => $this->getCsvCell($row, $columnIndexes['delivery_mode']),
                                'mapped_type' => '',
                                'prerequisites' => $this->getCsvCell($row, $columnIndexes['prerequisites']),
                                'semester' => $this->parseCsvInteger($this->getCsvCell($row, $columnIndexes['semester']), 1, 1, 12) ?? 1,
                                'description' => $this->getCsvCell($row, $columnIndexes['description']),
                                'minimum_passed_hours' => $this->parseCsvInteger($this->getCsvCell($row, $columnIndexes['minimum_passed_hours']), null, 1, 200),
                            ];
                            $count++;
                        }
                    }
                }
                fclose($handle);
            }
        }

        if (empty($normalizedRows)) {
            Log::warning('No valid rows found in course import.');

            return;
        }

        $importedCourseIds = [];
        $prerequisitesMap = [];
        $skippedRows = [];
        $successCount = 0;

        foreach ($normalizedRows as $rowData) {
            try {
                $code = $rowData['code'];
                $name = $rowData['name'];

                if ($code === '' || $name === '') {
                    $skippedRows[] = ['line' => $rowData['line'] ?? null, 'reason' => 'Missing code or name.'];

                    continue;
                }

                $mappedType = $rowData['mapped_type'] ?? '';
                $type = in_array($mappedType, ['compulsory', 'elective', 'supporting', 'university_req'], true)
                    ? $mappedType
                    : $this->mapImportedCourseType($rowData['raw_type'], $rowData['raw_category'], $rowData['raw_delivery_mode']);

                $updatePayload = [
                    'name' => $name,
                    'credit_hours' => $rowData['credit_hours'],
                    'semester' => $rowData['semester'],
                    'type' => $type,
                    'major_id' => $this->majorId,
                    'study_plan_version' => $this->studyPlanVersion,
                    'description' => $rowData['description'] ?: null,
                    'minimum_passed_hours' => $rowData['minimum_passed_hours'],
                ];

                $course = Course::updateOrCreate(
                    [
                        'code' => $code,
                        'major_id' => $this->majorId,
                        'study_plan_version' => $this->studyPlanVersion,
                    ],
                    $updatePayload
                );

                $importedCourseIds[] = $course->id;
                $successCount++;

                if (! empty($rowData['prerequisites'])) {
                    $prerequisitesMap[$course->id] = $rowData['prerequisites'];
                }
            } catch (\Exception $e) {
                $skippedRows[] = ['line' => $rowData['line'] ?? null, 'reason' => substr($e->getMessage(), 0, 100)];
            }
        }

        // Handle prerequisites
        foreach ($prerequisitesMap as $courseId => $prereqString) {
            try {
                $codes = collect(explode(',', $prereqString))
                    ->map(fn ($c) => $this->cleanCourseCode($c))
                    ->filter()
                    ->unique();

                if ($codes->isNotEmpty()) {
                    $prereqIds = Course::whereIn('code', $codes)
                        ->where(function ($q) {
                            $q->where('major_id', $this->majorId)->orWhereNull('major_id');
                        })
                        ->where('study_plan_version', $this->studyPlanVersion)
                        ->pluck('id')
                        ->toArray();

                    if (! empty($prereqIds)) {
                        $course = Course::find($courseId);
                        if ($course) {
                            $course->prerequisites()->sync($prereqIds);
                        }
                    }
                }
            } catch (\Exception $e) {
                Log::error("Failed attaching prerequisites for course ID {$courseId}: ".$e->getMessage());
            }
        }

        // Missing rows are preserved by default. Replacement is destructive and
        // must be selected explicitly by the administrator.
        if ($this->replaceMissing && $successCount > 0 && ! empty($importedCourseIds)) {
            Course::where('major_id', $this->majorId)
                ->where('study_plan_version', $this->studyPlanVersion)
                ->whereNotIn('id', $importedCourseIds)
                ->delete();
        }

        DB::table('admin_logs')->insert([
            'admin_id' => $this->adminId,
            'action' => 'IMPORT_COURSES_JOB',
            'details' => "Job completed. {$successCount} imported. ".count($skippedRows).' skipped.',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($this->filePath && file_exists(storage_path('app/'.$this->filePath))) {
            unlink(storage_path('app/'.$this->filePath));
        }
    }

    private function formatRow($row, $line)
    {
        return [
            'line' => $line,
            'code' => $this->cleanCourseCode($this->normalizeCsvText((string) ($row['code'] ?? ''))),
            'name' => $this->normalizeCsvText((string) ($row['name'] ?? '')),
            'credit_hours' => $this->parseCsvInteger((string) ($row['credit_hours'] ?? ''), 3, 0, 12) ?? 3,
            'raw_type' => $this->normalizeCsvText((string) ($row['type'] ?? '')),
            'raw_category' => $this->normalizeCsvText((string) ($row['category'] ?? '')),
            'raw_delivery_mode' => $this->normalizeCsvText((string) ($row['delivery_mode'] ?? '')),
            'mapped_type' => $this->normalizeCsvText((string) ($row['mappedType'] ?? '')),
            'prerequisites' => $this->normalizeCsvText((string) ($row['prerequisites'] ?? '')),
            'semester' => $this->parseCsvInteger((string) ($row['semester'] ?? ''), 1, 1, 12) ?? 1,
            'description' => $this->normalizeCsvText((string) ($row['description'] ?? '')),
            'minimum_passed_hours' => $this->parseCsvInteger((string) ($row['minimum_passed_hours'] ?? ''), null, 1, 200),
        ];
    }

    private function normalizeCsvText($text)
    {
        return trim($text);
    }

    private function cleanCourseCode($code)
    {
        return trim(strtoupper($code));
    }

    private function parseCsvInteger($val, $default, $min, $max)
    {
        $val = filter_var($val, FILTER_VALIDATE_INT);

        return ($val !== false && $val >= $min && $val <= $max) ? $val : $default;
    }

    private function getCsvCell($row, $idx)
    {
        return isset($row[$idx]) ? trim($row[$idx]) : '';
    }

    private function detectCsvColumns(array $headers): array
    {
        $headers = array_map(fn ($h) => strtolower(trim($h)), $headers);

        return [
            'code' => $this->findIndex($headers, ['رمز', 'code', 'رمز المادة', 'رقم المادة', 'course code', 'course_code']),
            'name' => $this->findIndex($headers, ['اسم', 'name', 'اسم المادة', 'course name', 'course_name', 'title']),
            'credit_hours' => $this->findIndex($headers, ['ساعات', 'credits', 'credit hours', 'ساعات معتمدة', 'الساعات المعتمدة', 'ch', 'credit_hours']),
            'type' => $this->findIndex($headers, ['نوع', 'type', 'course type', 'course_type']),
            'category' => $this->findIndex($headers, ['فئة', 'category']),
            'delivery_mode' => $this->findIndex($headers, ['طريقة التقديم', 'delivery mode', 'delivery_mode']),
            'prerequisites' => $this->findIndex($headers, ['متطلب', 'prerequisites', 'متطلبات سابقة', 'prerequisite']),
            'semester' => $this->findIndex($headers, ['فصل', 'semester', 'الفصل', 'level', 'مستوى']),
            'description' => $this->findIndex($headers, ['وصف', 'description', 'ملاحظات', 'notes']),
            'minimum_passed_hours' => $this->findIndex($headers, ['ساعات النجاح', 'min_passed_hours', 'minimum_passed_hours', 'ساعات مجتازة']),
        ];
    }

    private function findIndex(array $haystack, array $needles): int
    {
        foreach ($haystack as $idx => $header) {
            foreach ($needles as $needle) {
                if (str_contains($header, $needle)) {
                    return $idx;
                }
            }
        }

        return -1;
    }

    private function mapImportedCourseType($type, $category, $deliveryMode): string
    {
        $combined = strtolower($type.' '.$category.' '.$deliveryMode);
        if (str_contains($combined, 'اجباري') || str_contains($combined, 'إجباري') || str_contains($combined, 'compulsory')) {
            return 'compulsory';
        }
        if (str_contains($combined, 'اختياري') || str_contains($combined, 'إختياري') || str_contains($combined, 'elective')) {
            return 'elective';
        }
        if (str_contains($combined, 'مساند') || str_contains($combined, 'supporting')) {
            return 'supporting';
        }
        if (str_contains($combined, 'جامعة') || str_contains($combined, 'university')) {
            return 'university_req';
        }

        return 'compulsory';
    }
}
