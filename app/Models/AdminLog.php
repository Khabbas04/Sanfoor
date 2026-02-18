<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdminLog extends Model
{
    use HasFactory;

    // 🔥 هذا السطر هو الحل للمشكلة 🔥
    protected $fillable = ['user_id', 'action', 'details'];

    // علاقة عشان نعرف مين الأدمن صاحب الحركة
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}