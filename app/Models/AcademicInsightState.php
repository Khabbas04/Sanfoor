<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AcademicInsightState extends Model
{
    protected $fillable = [
        'user_id',
        'fingerprint',
        'insight_type',
        'priority',
        'recommendation_version',
        'viewed_at',
        'details_opened_at',
        'action_clicked_at',
        'dismissed_at',
        'dismissed_until',
    ];

    protected $casts = [
        'viewed_at' => 'datetime',
        'details_opened_at' => 'datetime',
        'action_clicked_at' => 'datetime',
        'dismissed_at' => 'datetime',
        'dismissed_until' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
