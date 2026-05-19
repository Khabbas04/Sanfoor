<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GraduationPlan extends Model
{
    use HasFactory;

    protected $table = 'graduation_plans';

    protected $guarded = [];

    protected $casts = [
        'payload' => 'array',
        'approved_at' => 'datetime',
    ];
}
