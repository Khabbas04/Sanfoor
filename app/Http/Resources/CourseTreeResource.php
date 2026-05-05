<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourseTreeResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'name' => $this->name,
            'code' => $this->code,
            'credit_hours' => (int) $this->credit_hours,
            'difficulty_level' => $this->difficulty_level !== null ? (int) $this->difficulty_level : null,
            'minimum_passed_hours' => $this->minimum_passed_hours !== null ? (int) $this->minimum_passed_hours : null,
            'type' => $this->type,
            'semester' => $this->semester !== null ? (int) $this->semester : null,
            'tree_position_x' => $this->tree_position_x !== null ? (float) $this->tree_position_x : null,
            'tree_position_y' => $this->tree_position_y !== null ? (float) $this->tree_position_y : null,
            'major_id' => $this->major_id !== null ? (int) $this->major_id : null,
            'study_plan_version' => $this->study_plan_version !== null ? (int) $this->study_plan_version : null,
            'description' => $this->description,
            'avg_grade' => isset($this->avg_grade) ? (float) $this->avg_grade : 72.0,
            'graded_attempts' => (int) ($this->graded_attempts ?? 0),
            'failed_attempts' => (int) ($this->failed_attempts ?? 0),
            'fail_rate' => isset($this->fail_rate) ? (float) $this->fail_rate : 18.0,
            'prerequisites_count' => (int) ($this->prerequisites_count ?? 0),
            'prerequisites' => $this->whenLoaded('prerequisites', function () {
                return $this->prerequisites->map(function ($prerequisite) {
                    return [
                        'id' => (int) $prerequisite->id,
                        'name' => $prerequisite->name,
                        'code' => $prerequisite->code,
                        'semester' => $prerequisite->semester !== null ? (int) $prerequisite->semester : null,
                    ];
                })->values();
            }, []),
        ];
    }
}