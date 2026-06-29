<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NtpGuest extends Model
{
    protected $fillable = [
        'name',
        'college_id',
        'major_id',
        'study_plan_version',
        'user_id'
    ];

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function major()
    {
        return $this->belongsTo(Major::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
