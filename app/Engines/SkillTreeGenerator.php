<?php

namespace App\Engines;

use App\Models\User;
use App\Models\Course;

/**
 * Produces the student "skill tree" that the AI advisor injects in place of the
 * %%SKILL_TREE%% marker.
 *
 * Output is a fenced ```skilltree block containing structured JSON (nodes + edges),
 * NOT mermaid text: the frontend renders it with reactflow/dagre (already bundled),
 * so no heavy diagramming dependency is added to the build.
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
            return $this->wrap(['nodes' => [], 'edges' => [], 'empty' => true]);
        }

        // Reliable "passed" detection by course id (the previous code read a
        // non-existent 'passed_courses_names_array' key, so nothing was ever
        // highlighted as passed).
        $passedSet = array_flip(array_map('intval', $academicData['profile']['passed_course_ids'] ?? []));
        $cartSet = array_flip(array_map('intval', $academicData['cart']['ids'] ?? []));
        $planIds = array_flip($courses->pluck('id')->map('intval')->all());

        $nodes = [];
        $edges = [];

        foreach ($courses as $course) {
            $cid = (int) $course->id;

            if (isset($passedSet[$cid])) {
                $status = 'passed';
            } elseif (isset($cartSet[$cid])) {
                $status = 'inCart';
            } else {
                $status = 'available';
                foreach ($course->prerequisites as $prereq) {
                    if (!isset($passedSet[(int) $prereq->id])) {
                        $status = 'locked';
                        break;
                    }
                }
            }

            $nodes[] = [
                'id' => $cid,
                'name' => $course->name,
                'code' => (string) $course->code,
                'credit_hours' => (int) $course->credit_hours,
                'semester' => (int) ($course->semester ?? 0),
                'status' => $status,
            ];

            // Real prerequisite edges, but only between nodes that exist in this plan.
            foreach ($course->prerequisites as $prereq) {
                $pid = (int) $prereq->id;
                if (isset($planIds[$pid])) {
                    $edges[] = ['from' => $pid, 'to' => $cid];
                }
            }
        }

        return $this->wrap(['nodes' => $nodes, 'edges' => $edges]);
    }

    private function wrap(array $payload): string
    {
        return "```skilltree\n" . json_encode($payload, JSON_UNESCAPED_UNICODE) . "\n```";
    }
}
