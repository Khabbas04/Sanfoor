<?php

namespace App\Imports;

use App\Models\Course;
use App\Models\CourseSection;
use App\Models\AcademicPeriod;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Str;

class CourseSectionsImport implements ToCollection, WithHeadingRow
{
    protected ?AcademicPeriod $period;

    public function __construct(?AcademicPeriod $period = null)
    {
        $this->period = $period;
    }

    public function collection(Collection $rows)
    {
        $year = $this->period ? $this->period->academic_year : '2026/2027';
        $term = $this->period ? $this->period->academic_term : 1;

        // Clear existing sections for this term to replace them (optional, but good for fresh imports)
        // CourseSection::where('academic_year', $year)->where('academic_term', $term)->delete();

        foreach ($rows as $row) {
            // Find the course column dynamically
            $courseIdentifier = $row['course_code'] ?? $row['code'] ?? $row['رقم_المادة'] ?? $row['رقم_المساق'] ?? null;
            $courseName = $row['course_name'] ?? $row['name'] ?? $row['اسم_المادة'] ?? $row['اسم_المساق'] ?? $row['المادة'] ?? null;
            
            // Instructor
            $instructor = $row['instructor'] ?? $row['المدرس'] ?? $row['المحاضر'] ?? $row['الدكتور'] ?? null;
            
            // Days
            $days = $row['days'] ?? $row['الأيام'] ?? $row['الايام'] ?? $row['أيام'] ?? null;
            
            // Time
            $time = $row['time'] ?? $row['الوقت'] ?? $row['وقت'] ?? $row['الساعة'] ?? null;
            
            // Hall
            $hall = $row['hall'] ?? $row['room'] ?? $row['القاعة'] ?? $row['قاعة'] ?? null;

            // Capacity
            $capacity = $row['capacity'] ?? $row['السعة'] ?? $row['سعة'] ?? 50;

            if (!$courseIdentifier && !$courseName) {
                continue; // Skip if no course info
            }

            // Find course in DB
            $course = null;
            if ($courseIdentifier) {
                $course = Course::where('code', $courseIdentifier)->first();
            }
            if (!$course && $courseName) {
                // Try fuzzy match on name if code fails
                $cleanName = trim(str_replace(['أ', 'إ', 'آ'], 'ا', $courseName));
                $course = Course::where('name', 'like', "%{$cleanName}%")->first();
            }

            if ($course) {
                CourseSection::create([
                    'course_id' => $course->id,
                    'instructor' => $instructor ? (string)$instructor : null,
                    'days' => $days ? (string)$days : null,
                    'time' => $time ? (string)$time : null,
                    'hall' => $hall ? (string)$hall : null,
                    'capacity' => (int)$capacity,
                    'academic_year' => $year,
                    'academic_term' => $term,
                ]);
            }
        }
    }
}
