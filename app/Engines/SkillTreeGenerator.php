<?php

namespace App\Engines;

use App\Models\User;
use App\Models\Course;

/**
 * Produces the student "skill tree" (Mermaid flowchart) that the AI advisor
 * injects in place of the %%SKILL_TREE%% marker. Rendered on the frontend by the
 * `mermaid` library.
 */
class SkillTreeGenerator
{
    public function generate(User $user, array $academicData): string
    {
        $courses = Course::with('prerequisites')
            ->where('major_id', $user->major_id)
            ->where('study_plan_version', $user->study_plan_version)
            ->orderBy('semester')
            ->get();

        if ($courses->isEmpty()) {
            return "```mermaid\ngraph TD\n  A[\"لا توجد خطة دراسية متاحة\"]\n```";
        }

        // Reliable "passed" detection by course id (the old code read a
        // non-existent 'passed_courses_names_array' key, so nothing was ever
        // highlighted as passed).
        $passedSet = array_flip(array_map('intval', $academicData['profile']['passed_course_ids'] ?? []));
        $cartSet = array_flip(array_map('intval', $academicData['cart']['ids'] ?? []));
        $planIds = array_flip($courses->pluck('id')->map('intval')->all());

        $lines = [
            'graph TD',
            'classDef passed fill:#dcfce7,stroke:#22c55e,stroke-width:2px,color:#166534;',
            'classDef available fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e40af;',
            'classDef inCart fill:#fef9c3,stroke:#eab308,stroke-width:3px,color:#854d0e;',
            'classDef locked fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#991b1b,stroke-dasharray: 4 4;',
        ];

        // Group nodes by semester for a clean top-down layout.
        foreach ($courses->groupBy('semester') as $semester => $group) {
            $sem = (int) $semester;
            $semLabel = $sem > 0 ? "الفصل {$sem}" : 'غير مصنّف';
            $lines[] = "subgraph sem{$sem}[\"{$semLabel}\"]";
            foreach ($group as $course) {
                $cid = (int) $course->id;
                $label = $this->sanitize($course->name);
                $hrs = (int) $course->credit_hours;
                $status = $this->status($cid, $course, $passedSet, $cartSet);
                $lines[] = "  C{$cid}[\"{$label} — {$hrs}س\"]:::{$status}";
            }
            $lines[] = 'end';
        }

        // Real prerequisite arrows, only between courses that exist in this plan.
        foreach ($courses as $course) {
            foreach ($course->prerequisites as $prereq) {
                $pid = (int) $prereq->id;
                if (isset($planIds[$pid])) {
                    $lines[] = "C{$pid} --> C" . (int) $course->id;
                }
            }
        }

        return "```mermaid\n" . implode("\n", $lines) . "\n```";
    }

    private function status(int $cid, Course $course, array $passedSet, array $cartSet): string
    {
        if (isset($passedSet[$cid])) {
            return 'passed';
        }
        if (isset($cartSet[$cid])) {
            return 'inCart';
        }
        foreach ($course->prerequisites as $prereq) {
            if (!isset($passedSet[(int) $prereq->id])) {
                return 'locked';
            }
        }
        return 'available';
    }

    /** Strip characters that would break Mermaid node labels. */
    private function sanitize(string $name): string
    {
        $name = str_replace(['"', '(', ')', '[', ']', '{', '}', ';', '|', '<', '>', '#', '`', '\\', '&'], ' ', $name);
        return trim(preg_replace('/\s+/u', ' ', $name));
    }
}
