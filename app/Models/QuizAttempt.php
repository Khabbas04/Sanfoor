<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizAttempt extends Model
{
    use HasFactory;

    protected static function booted()
    {
        static::addGlobalScope('college_filter', function ($builder) {
            $builder->whereHas('course');
        });
    }

    protected $fillable = [
        'user_id',
        'course_id',
        'chapter_id',
        'mode',
        'total_questions',
        'correct_answers',
        'score_percentage',
        'time_spent_seconds',
        'answers',
    ];

    protected $casts = [
        'answers' => 'array',
        'total_questions' => 'integer',
        'correct_answers' => 'integer',
        'score_percentage' => 'integer',
        'time_spent_seconds' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function chapter(): BelongsTo
    {
        return $this->belongsTo(Chapter::class);
    }
}
