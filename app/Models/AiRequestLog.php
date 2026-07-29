<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiRequestLog extends Model
{
    protected $fillable = [
        'user_id', 'chat_id', 'route_used', 'intent', 'intent_confidence',
        'answer_confidence', 'confidence_level', 'tools_called', 'dropped_ids',
        'validation_failed', 'fallback_used', 'fallback_reason', 'was_cached',
        'response_time_ms', 'time_to_first_token_ms', 'action_name', 'action_result',
        'feedback_reason', 'provider_error_type', 'prompt_version',
    ];

    protected $casts = [
        'tools_called' => 'array',
        'validation_failed' => 'boolean',
        'fallback_used' => 'boolean',
        'was_cached' => 'boolean',
        'dropped_ids' => 'integer',
        'response_time_ms' => 'integer',
        'time_to_first_token_ms' => 'integer',
        'intent_confidence' => 'float',
        'answer_confidence' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
