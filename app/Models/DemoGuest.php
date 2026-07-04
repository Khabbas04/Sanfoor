<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DemoGuest extends Model
{
    protected $fillable = [
        'name',
        'email',
        'college_id',
        'major_id',
    ];

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function major()
    {
        return $this->belongsTo(Major::class);
    }
}
