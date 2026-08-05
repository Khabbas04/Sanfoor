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
    public function rank(array $availableDetails, array $academicRules, string $intent = 'عام', int $limit = 8, array $preferences = []): array
    {
        $studentYear = $academicRules['student_year'] ?? 1;
        $studentSemester = $academicRules['student_semester'] ?? 1;
        
        $scoredCourses = [];

        $userFilters = $preferences['filters'] ?? [];
        $hasFilters = !empty($userFilters) && is_array($userFilters);
        $criticalPathPref = !empty($preferences['critical_path']);
        $difficultyPref = $preferences['difficulty'] ?? null;

        foreach ($availableDetails as $course) {
            $score = 0;
            
            // 1. Unlocks (Strategic Value) - Max 25 points (boosted if critical_path is active)
            $unlocks = (int) ($course['unlocks'] ?? 0);
            $unlockScore = min(25, $unlocks * 5);
            if ($criticalPathPref) {
                $unlockScore += min(35, $unlocks * 8); // Extra massive boost for critical path
            }
            $score += $unlockScore;
            
            // 2. Difficulty Fit - Max 20 points (or customized by difficulty preference)
            $difficulty = (int) ($course['difficulty_level'] ?? 3);
            if ($difficultyPref === 'easy') {
                $score += (6 - $difficulty) * 8; // Diff 1 -> 40, Diff 5 -> 8
            } elseif ($difficultyPref === 'hard') {
                $score += $difficulty * 8; // Diff 5 -> 40, Diff 1 -> 8
            } elseif ($difficultyPref === 'balanced') {
                $score += $difficulty === 3 ? 30 : ($difficulty === 2 || $difficulty === 4 ? 18 : 5);
            } elseif ($intent === 'رفع_المعدل' || $intent === 'تخفيف_العبء') {
                // Prefers Easy (1, 2)
                $score += (6 - $difficulty) * 4; // Diff 1 -> 20, Diff 5 -> 4
            } elseif ($intent === 'تسريع_التخرج') {
                // Diff doesn't matter much, but prefers balanced (3, 4)
                $score += $difficulty === 3 || $difficulty === 4 ? 20 : 10;
            } else {
                // Default: balanced is best
                $score += $difficulty === 3 ? 20 : ($difficulty === 2 || $difficulty === 4 ? 15 : 5);
            }
            
            // 3. Type Priority & User Filters - Max 20 points (+50 if matching user filter)
            $type = $course['type'] ?? '';
            if ($hasFilters) {
                if (in_array($type, $userFilters, true)) {
                    $score += 50; // Priority to user's explicitly selected filter types
                } else {
                    $score -= 30; // Deprioritize non-selected types
                }
            } else {
                $score += match($type) {
                    'compulsory' => 20,
                    'supporting' => 15,
                    'university_req' => 10,
                    'elective' => 5,
                    default => 5,
                };
            }
            
            // 4. Semester Proximity - Max 15 points
            $courseSemester = $course['course_semester'] ?? null;
            if ($courseSemester !== null) {
                if ($courseSemester <= $studentSemester) {
                    $score += 15;
                } else {
                    $semesterDiff = $courseSemester - $studentSemester;
                    $score += max(0, 15 - ($semesterDiff * 3));
                }
            } else {
                $courseYear = (int) ($course['course_year'] ?? 1);
                $yearDiff = abs($courseYear - $studentYear);
                $score += max(0, 10 - ($yearDiff * 5));
            }
            
            // 5. Prereq Weight - Max 10 points
            $prereqs = (int) ($course['prereq_count'] ?? 0);
            $score += max(0, 10 - ($prereqs * 5));
            
            // 6. Credit Efficiency - Max 10 points
            $credits = (int) ($course['credit_hours'] ?? 3);
            $score += $credits >= 3 ? 10 : 5;
            
            $scoredCourses[] = [
                'id' => $course['id'],
                'name' => $course['name'],
                'score' => $score,
                'course' => $course,
                'reason' => \App\Support\CourseAdvantages::summary($course, [
                    'student_semester' => (int) ($academicRules['student_semester'] ?? 0),
                ]) ?: $this->generateRankingReason($score, $unlocks, $type),
                'advantages' => \App\Support\CourseAdvantages::for($course, [
                    'student_semester' => (int) ($academicRules['student_semester'] ?? 0),
                ]),
            ];
        }

        // Sort by score descending
        usort($scoredCourses, fn($a, $b) => $b['score'] <=> $a['score']);

        return $this->withBalancedMix(array_slice($scoredCourses, 0, $limit), $scoredCourses, $preferences);
    }

    /**
     * Make sure the shortlist is not all specialisation courses.
     *
     * Major courses unlock the most and score highest, so the top of the list is
     * always specialisation — and a model handed nothing else can only propose an
     * unbalanced term. University requirements here are online and lighter, so one
     * is swapped in for the weakest entry when the shortlist has none.
     *
     * @param array $shortlist   the top-N about to be shown
     * @param array $all         every scored candidate
     * @param array $preferences user's explicit filter preferences
     */
    private function withBalancedMix(array $shortlist, array $all, array $preferences = []): array
    {
        $types = (array) config('academic_path_planner.balance.university_types', ['university_req', 'university_elective']);

        // If student explicitly specified course types that do NOT include university requirements,
        // respect their choice and don't force a university requirement into the shortlist.
        $userFilters = $preferences['filters'] ?? [];
        if (!empty($userFilters) && is_array($userFilters) && empty(array_intersect($types, $userFilters))) {
            return $shortlist;
        }

        $hasUniversity = fn (array $list) => collect($list)
            ->contains(fn (array $entry) => in_array((string) ($entry['course']['type'] ?? ''), $types, true));

        if ($shortlist === [] || $hasUniversity($shortlist)) {
            return $shortlist;
        }

        $candidate = collect($all)->first(
            fn (array $entry) => in_array((string) ($entry['course']['type'] ?? ''), $types, true)
        );

        if ($candidate === null) {
            return $shortlist; // the student has none left to take
        }

        // Replace the weakest entry rather than growing the list: the prompt budget
        // is fixed, and a longer list is not a better one.
        array_pop($shortlist);
        $shortlist[] = array_merge($candidate, [
            'reason' => 'متطلب جامعة (أونلاين) — يوازن حمل الفصل مع مواد التخصص',
        ]);

        return $shortlist;
    }
    
    private function generateRankingReason(int $score, int $unlocks, string $type): string
    {
        if ($score >= 80) return "خيار استراتيجي وممتاز (يفتح {$unlocks} مواد)";
        if ($score >= 60) return "خيار جيد جداً ومناسب لخطتك";
        return "خيار متاح ضمن الخطة";
    }
}
