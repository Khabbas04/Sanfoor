<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminLog extends Model
{
    use HasFactory;

    // 🔥 هذا السطر هو الحل للمشكلة 🔥
    protected $fillable = ['user_id', 'action', 'details', 'ip_address', 'owner_only', 'meta'];

    // علاقة عشان نعرف مين الأدمن صاحب الحركة
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}