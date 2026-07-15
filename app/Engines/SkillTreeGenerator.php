<?php

namespace App\Engines;

use App\Models\User;
use App\Models\Course;

class SkillTreeGenerator
{
    public function generate(User $user, array $academicData): string
    {
        // Get all courses in user's major plan
        $majorId = $user->major_id;
        $planVersion = $user->study_plan_version;

        $courses = Course::where('major_id', $majorId)
            ->where('study_plan_version', $planVersion)
            ->orderBy('semester')
            ->get();

        if ($courses->isEmpty()) {
            return "```mermaid\ngraph TD;\n  A[لا توجد خطة دراسية متاحة]:::locked\n```";
        }

        $passedNames = collect($academicData['profile']['passed_courses_names_array'] ?? []);
        $cartIds = collect($academicData['cart']['ids'] ?? []);

        $mermaid = "```mermaid\ngraph TD;\n";
        $mermaid .= "  classDef passed fill:#dcfce7,stroke:#22c55e,stroke-width:2px,color:#166534,font-weight:bold;\n";
        $mermaid .= "  classDef locked fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#991b1b,font-weight:bold,stroke-dasharray: 5 5;\n";
        $mermaid .= "  classDef available fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e40af,font-weight:bold;\n";
        $mermaid .= "  classDef inCart fill:#fef9c3,stroke:#eab308,stroke-width:3px,color:#854d0e,font-weight:bold;\n\n";

        // To create a hierarchical tree, we group by semester
        $semesterGroups = $courses->groupBy('semester');
        
        foreach ($semesterGroups as $semester => $semCourses) {
            $mermaid .= "  subgraph الفصل {$semester}\n";
            $mermaid .= "    direction TB;\n";
            foreach ($semCourses as $course) {
                $nodeId = 'C' . $course->id;
                $name = str_replace(['(', ')', '[', ']', '"'], '', $course->name);
                
                // Determine class
                $class = 'locked';
                if ($passedNames->contains($course->name)) {
                    $class = 'passed';
                } elseif ($cartIds->contains($course->id)) {
                    $class = 'inCart';
                } else {
                    $class = 'available'; // Simplified: assume available if not passed. In reality we'd check prereqs.
                }

                $mermaid .= "    {$nodeId}[\"{$name}\"]:::{$class};\n";
            }
            $mermaid .= "  end\n";
        }

        // Draw prerequisite lines (simplified, just sequential for demo if we don't have real prereqs)
        // If we have actual prerequisite logic in Course model, we can add arrows.
        
        $mermaid .= "```\n";
        return $mermaid;
    }
}
