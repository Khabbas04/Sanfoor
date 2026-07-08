<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Chat extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'title'];

    // المحادثة تابعة لطالب
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // المحادثة بتحتوي على عدة رسائل
    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    // علاقة لجلب أحدث رسالة بشكل مباشر لتجنب N+1
    public function latestMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }
}