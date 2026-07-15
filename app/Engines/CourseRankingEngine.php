<?php

namespace App\Engines;

class CourseRankingEngine
{
    /**
     * Rank available courses based on student state and intent.
     * 
     * Weights:
     * - unlocks: 25% (Strategic value)
     * - difficulty_fit: 20% (Matches intent)
     * - type_priority: 20% (Compulsory > Elective)
     * - year_proximity: 15% (Appropriate for student level)
     * - prereq_weight: 10% (Fewer prereqs = easier to take now)
     * - credit_efficiency: 10% (Standard 3hr courses preferred over 1hr labs unless needed)
     */
    public function rank(array $availableDetails, array $academicRules, string $intent = 'عام', int $limit = 8): array
    {
        $studentYear = $academicRules['student_year'] ?? 1;
        $studentSemester = $academicRules['student_semester'] ?? 1;
        
        $scoredCourses = [];

        foreach ($availableDetails as $course) {
            $score = 0;
            
            // 1. Unlocks (Strategic Value) - Max 25 points
            // Assuming max unlocks is around 5. Each unlock gives 5 points.
            $unlocks = (int) ($course['unlocks'] ?? 0);
            $score += min(25, $unlocks * 5);
            
            // 2. Difficulty Fit - Max 20 points
            $difficulty = (int) ($course['difficulty_level'] ?? 3);
            if ($intent === 'رفع_المعدل' || $intent === 'تخفيف_العبء') {
                // Prefers Easy (1, 2)
                $score += (6 - $difficulty) * 4; // Diff 1 -> 20, Diff 5 -> 4
            } elseif ($intent === 'تسريع_التخرج') {
                // Diff doesn't matter much, but prefers balanced (3, 4)
                $score += $difficulty === 3 || $difficulty === 4 ? 20 : 10;
            } else {
                // Default: balanced is best
                $score += $difficulty === 3 ? 20 : ($difficulty === 2 || $difficulty === 4 ? 15 : 5);
            }
            
            // 3. Type Priority - Max 20 points
            $type = $course['type'] ?? '';
            $score += match($type) {
                'compulsory' => 20,
                'supporting' => 15,
                'university_req' => 10,
                'elective' => 5,
                default => 5,
            };
            
            // 4. Semester Proximity - Max 15 points
            $courseSemester = $course['course_semester'] ?? null;
            if ($courseSemester !== null) {
                // If it's the exact recommended semester, give max points (15)
                // If it's a past semester course (student should have taken it already), give high priority (15) so they catch up!
                if ($courseSemester <= $studentSemester) {
                    $score += 15;
                } else {
                    $semesterDiff = $courseSemester - $studentSemester;
                    $score += max(0, 15 - ($semesterDiff * 3));
                }
            } else {
                // Fallback to year if no specific semester
                $courseYear = (int) ($course['course_year'] ?? 1);
                $yearDiff = abs($courseYear - $studentYear);
                $score += max(0, 10 - ($yearDiff * 5)); // Lower max points if we only know the year
            }
            
            // 5. Prereq Weight - Max 10 points
            // Courses with 0 prereqs get 10, 1 prereq gets 5, more gets 0
            $prereqs = (int) ($course['prereq_count'] ?? 0);
            $score += max(0, 10 - ($prereqs * 5));
            
            // 6. Credit Efficiency - Max 10 points
            $credits = (int) ($course['credit_hours'] ?? 3);
            $score += $credits >= 3 ? 10 : 5; // Standard courses get bonus over 1hr labs
            
            $scoredCourses[] = [
                'id' => $course['id'],
                'name' => $course['name'],
                'score' => $score,
                'course' => $course, // Keep original data
                'reason' => $this->generateRankingReason($score, $unlocks, $type)
            ];
        }

        // Sort by score descending
        usort($scoredCourses, fn($a, $b) => $b['score'] <=> $a['score']);
        
        // Return top N
        return array_slice($scoredCourses, 0, $limit);
    }
    
    private function generateRankingReason(int $score, int $unlocks, string $type): string
    {
        if ($score >= 80) return "خيار استراتيجي وممتاز (يفتح {$unlocks} مواد)";
        if ($score >= 60) return "خيار جيد جداً ومناسب لخطتك";
        return "خيار متاح ضمن الخطة";
    }
}
