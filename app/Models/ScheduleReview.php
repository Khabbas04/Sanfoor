<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleReview extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'plan_data',
        'status',
        'feedback',
        'reviewed_by',
    ];

    protected $casts = [
        'plan_data' => 'array',
    ];

    /**
     * The student who submitted the request.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * The staff/admin who reviewed the request.
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
