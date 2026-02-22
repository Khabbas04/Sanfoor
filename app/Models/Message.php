<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasFactory;

    protected $fillable = ['chat_id', 'role', 'content'];

    // الرسالة تابعة لمحادثة
    public function chat()
    {
        return $this->belongsTo(Chat::class);
    }
}