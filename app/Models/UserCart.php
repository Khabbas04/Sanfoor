<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserCart extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'course_id', 'target_year', 'target_term', 'is_summer'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function courses()
    {
        return $this->belongsToMany(Course::class , 'cart_courses', 'user_cart_id', 'course_id')->withTimestamps();
    }
}
