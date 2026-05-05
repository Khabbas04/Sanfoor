<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PassedCourseResource extends JsonResource
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
            'semester' => $this->semester !== null ? (int) $this->semester : null,
            'pivot' => [
                'grade' => $this->pivot?->grade !== null ? (float) $this->pivot->grade : null,
                'studied_semester' => $this->pivot?->studied_semester !== null ? (int) $this->pivot->studied_semester : null,
                'studied_year' => $this->pivot?->studied_year !== null ? (int) $this->pivot->studied_year : null,
                'studied_term' => $this->pivot?->studied_term !== null ? (int) $this->pivot->studied_term : null,
            ],
        ];
    }
}