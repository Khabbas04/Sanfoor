<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentAiPreference extends Model
{
    protected $fillable = [
        'user_id',
        'active_goal',
        'preferred_load',
        'difficulty_preference',
        'gpa_target',
        'last_approved_plan',
    ];

    protected $casts = [
        'preferred_load' => 'integer',
        'gpa_target' => 'float',
        'last_approved_plan' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
