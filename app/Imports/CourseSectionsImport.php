<?php

namespace App\Imports;

use App\Models\Course;
use App\Models\CourseSection;
use App\Models\AcademicPeriod;
use OpenSpout\Reader\XLSX\Reader;

class CourseSectionsImport
{
    protected ?AcademicPeriod $period;

    public function __construct(?AcademicPeriod $period = null)
    {
        $this->period = $period;
    }

    public function import(string $filePath): int
    {
        $year = $this->period ? $this->period->academic_year : '2026/2027';
        $term = $this->period ? $this->period->academic_term : 1;

        $reader = new Reader();
        $reader->open($filePath);

        $headers = [];
        $imported = 0;

        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $rowIndex => $row) {
                $cells = $row->getCells();
                $values = array_map(fn($cell) => trim((string) $cell->getValue()), $cells);

                // First row = headers
                if ($rowIndex === 1) {
                    $headers = $this->normalizeHeaders($values);
                    continue;
                }

                if (empty($headers) || empty(array_filter($values))) {
                    continue;
                }

                $rowData = [];
                foreach ($headers as $i => $headerKey) {
                    $rowData[$headerKey] = $values[$i] ?? null;
                }

                $courseIdentifier = $rowData['course_code'] ?? null;
                $courseName = $rowData['course_name'] ?? null;
                $instructor = $rowData['instructor'] ?? null;
                $days = $rowData['days'] ?? null;
                $time = $rowData['time'] ?? null;
                $hall = $rowData['hall'] ?? null;
                $capacity = $rowData['capacity'] ?? 50;

                if (!$courseIdentifier && !$courseName) {
                    continue;
                }

                // Find course in DB
                $course = null;
                if ($courseIdentifier) {
                    $course = Course::where('code', $courseIdentifier)->first();
                }
                if (!$course && $courseName) {
                    $cleanName = trim(str_replace(['أ', 'إ', 'آ'], 'ا', $courseName));
                    $course = Course::where('name', 'like', "%{$cleanName}%")->first();
                    if (!$course) {
                        $course = Course::where('name', $courseName)->first();
                    }
                }

                if ($course) {
                    CourseSection::create([
                        'course_id' => $course->id,
                        'instructor' => $instructor ? (string)$instructor : null,
                        'days' => $days ? (string)$days : null,
                        'time' => $time ? (string)$time : null,
                        'hall' => $hall ? (string)$hall : null,
                        'capacity' => (int)($capacity ?: 50),
                        'academic_year' => $year,
                        'academic_term' => $term,
                    ]);
                    $imported++;
                }
            }
            break; // Only read first sheet
        }

        $reader->close();
        return $imported;
    }

    /**
     * Map various Arabic/English header names to standardized keys.
     */
    private function normalizeHeaders(array $rawHeaders): array
    {
        $mapping = [
            // Course code
            'course_code' => ['course_code', 'code', 'رقم_المادة', 'رقم_المساق', 'رقم المادة', 'رقم المساق', 'رمز المادة', 'رمز_المادة', 'الرقم'],
            // Course name
            'course_name' => ['course_name', 'name', 'اسم_المادة', 'اسم_المساق', 'المادة', 'اسم المادة', 'اسم المساق', 'المساق'],
            // Instructor
            'instructor' => ['instructor', 'المدرس', 'المحاضر', 'الدكتور', 'اسم المدرس', 'اسم_المدرس', 'مدرس المادة', 'مدرس_المادة', 'doctor', 'teacher'],
            // Days
            'days' => ['days', 'الأيام', 'الايام', 'أيام', 'ايام', 'اليوم'],
            // Time
            'time' => ['time', 'الوقت', 'وقت', 'الساعة', 'ساعة', 'من - الى', 'من-الى'],
            // Hall
            'hall' => ['hall', 'room', 'القاعة', 'قاعة', 'الغرفة', 'مكان'],
            // Capacity
            'capacity' => ['capacity', 'السعة', 'سعة', 'عدد الطلاب'],
        ];

        $normalized = [];
        foreach ($rawHeaders as $header) {
            $clean = mb_strtolower(trim($header));
            $found = false;
            foreach ($mapping as $key => $aliases) {
                foreach ($aliases as $alias) {
                    if ($clean === mb_strtolower($alias)) {
                        $normalized[] = $key;
                        $found = true;
                        break 2;
                    }
                }
            }
            if (!$found) {
                $normalized[] = 'unknown_' . count($normalized);
            }
        }
        return $normalized;
    }
}
