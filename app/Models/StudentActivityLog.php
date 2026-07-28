<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentActivityLog extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::created(function (StudentActivityLog $log) {
            if (in_array($log->action, [
                'course_passed',
                'course_unpassed',
                'grade_updated',
                'course_retake_added',
                'plan_reset',
            ], true)) {
                \App\Services\StudentDashboardInsightService::forget((int) $log->user_id);
            }
        });
    }

    protected $fillable = [
        'user_id',
        'course_id',
        'action',
        'details',
    ];

    protected $casts = [
        'details' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
