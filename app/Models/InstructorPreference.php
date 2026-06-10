<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InstructorPreference extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'preferred_days' => 'array',
        'preferred_times' => 'array',
        'carpool_with_user_ids' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
