<?php

namespace App\Imports;

use App\Models\Course;
use App\Models\CourseSection;
use App\Models\AcademicPeriod;
use Shuchkin\SimpleXLSX;
use Illuminate\Support\Facades\Log;

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

        $xlsx = SimpleXLSX::parse($filePath);
        if (!$xlsx) {
            throw new \Exception(SimpleXLSX::parseError() ?: 'تعذر قراءة ملف الإكسل.');
        }

        $rows = $xlsx->rows();
        if (empty($rows)) {
            return 0;
        }

        $headers = [];
        $imported = 0;

        foreach ($rows as $rowIndex => $row) {
            $values = array_map(fn($cell) => trim((string) $cell), $row);

            // First row = headers
            if ($rowIndex === 0) {
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
                $rawCode = trim((string) $courseIdentifier);
                $unpaddedCode = ltrim($rawCode, '0');
                $course = Course::where('code', $rawCode)
                    ->orWhere('code', $unpaddedCode)
                    ->orWhere('code', 'LIKE', "%{$rawCode}%")
                    ->first();
            }

            if (!$course && $courseName) {
                $rawName = trim((string) $courseName);
                // Strip common prefixes/suffixes like (نظري), (عملي), (شعبة 1)
                $cleanedName = preg_replace('/\s*[\(\[].*?[\)\]]\s*/u', '', $rawName);
                $cleanedName = trim($cleanedName);

                $normalizedName = str_replace(['أ', 'إ', 'آ'], 'ا', $cleanedName);
                $normalizedName = str_replace(['ة'], 'ه', $normalizedName);
                $normalizedName = str_replace(['ى'], 'ي', $normalizedName);
                $normalizedName = trim(preg_replace('/\s+/u', ' ', $normalizedName));

                $course = Course::where('name', $rawName)
                    ->orWhere('name', $cleanedName)
                    ->orWhere('name', 'LIKE', "%{$cleanedName}%")
                    ->first();

                if (!$course) {
                    // Try searching across all courses using PHP normalization
                    $allCourses = Course::select('id', 'name', 'code')->get();
                    foreach ($allCourses as $c) {
                        $dbNorm = str_replace(['أ', 'إ', 'آ'], 'ا', $c->name);
                        $dbNorm = str_replace(['ة'], 'ه', $dbNorm);
                        $dbNorm = str_replace(['ى'], 'ي', $dbNorm);
                        $dbNorm = trim(preg_replace('/\s+/u', ' ', $dbNorm));

                        if ($dbNorm === $normalizedName || str_contains($dbNorm, $normalizedName) || str_contains($normalizedName, $dbNorm)) {
                            $course = $c;
                            break;
                        }
                    }
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

        return $imported;
    }

    /**
     * Map various Arabic/English header names to standardized keys.
     */
    private function normalizeHeaders(array $rawHeaders): array
    {
        $mapping = [
            // Course code
            'course_code' => ['course_code', 'code', 'course_no', 'courseno', 'course_num', 'رقم_المادة', 'رقم_المساق', 'رقم المادة', 'رقم المساق', 'رمز المادة', 'رمز_المادة', 'رمز المساق', 'رمز_المساق', 'الرقم', 'رقم المقرر', 'رمز المقرر'],
            // Course name
            'course_name' => ['course_name', 'name', 'title', 'course_title', 'اسم_المادة', 'اسم_المساق', 'المادة', 'اسم المادة', 'اسم المساق', 'المساق', 'اسم المقرر', 'المقرر', 'اسم المادة باللغة العربية', 'اسم المادة (عربي)', 'اسم المادة عربي'],
            // Instructor
            'instructor' => ['instructor', 'المدرس', 'المحاضر', 'الدكتور', 'اسم المدرس', 'اسم_المدرس', 'مدرس المادة', 'مدرس_المادة', 'اسم الدكتور', 'اسم_الدكتور', 'عضو هيئة التدريس', 'مدرس الشعبة', 'أستاذ المادة', 'استاذ المادة', 'doctor', 'teacher', 'prof', 'faculty'],
            // Days
            'days' => ['days', 'الأيام', 'الايام', 'أيام', 'ايام', 'اليوم', 'أيام التدريس', 'ايام التدريس', 'أيام المحاضرة', 'ايام المحاضرة', 'days_of_week'],
            // Time
            'time' => ['time', 'الوقت', 'وقت', 'الساعة', 'ساعة', 'من - الى', 'من-الى', 'وقت المحاضرة', 'بداية المحاضرة', 'موعد المحاضرة', 'الفترة'],
            // Hall
            'hall' => ['hall', 'room', 'القاعة', 'قاعة', 'الغرفة', 'مكان', 'رقم القاعة', 'اسم القاعة', 'المبنى والقاعة', 'الموقع'],
            // Capacity
            'capacity' => ['capacity', 'السعة', 'سعة', 'عدد الطلاب', 'الشواغر', 'الحد الأقصى', 'الحد الاقصى'],
        ];

        $normalized = [];
        foreach ($rawHeaders as $header) {
            $clean = mb_strtolower(trim($header));
            $found = false;
            foreach ($mapping as $key => $aliases) {
                foreach ($aliases as $alias) {
                    if ($clean === mb_strtolower($alias) || str_contains($clean, mb_strtolower($alias))) {
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
