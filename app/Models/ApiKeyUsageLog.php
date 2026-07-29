<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApiKeyUsageLog extends Model
{
    protected $fillable = [
        'api_key_id', 'key_fingerprint', 'model', 'request_type',
        'input_tokens', 'output_tokens', 'total_tokens',
        'rpm', 'tpm', 'rpd', 'latency_ms',
        'success', 'error_message', 'error_type',
    ];

    protected $casts = [
        'api_key_id' => 'integer',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
        'total_tokens' => 'integer',
        'rpm' => 'integer',
        'tpm' => 'integer',
        'rpd' => 'integer',
        'latency_ms' => 'integer',
        'success' => 'boolean',
    ];
}
