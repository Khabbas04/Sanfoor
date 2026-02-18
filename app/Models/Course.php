<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'code', 'credit_hours', 'type', 'semester', 'major_id'];

    // 🔥 1. علاقة التخصص (هذا الجزء الذي كان ناقصاً وسبب المشكلة) 🔥
    public function major()
    {
        return $this->belongsTo(Major::class);
    }

    // --- باقي العلاقات كما هي (ممتازة) ---

    // 2. علاقة: ما هي المواد التي يجب أن آخذها قبل هذه المادة؟ (المتطلبات السابقة)
    public function prerequisites()
    {
        return $this->belongsToMany(Course::class, 'course_prerequisites', 'course_id', 'prerequisite_id');
    }

    // 3. علاقة: ما هي المواد التي ستفتح لي بعد إنهاء هذه المادة؟ (الأبناء)
    public function children()
    {
        return $this->belongsToMany(Course::class, 'course_prerequisites', 'prerequisite_id', 'course_id');
    }
}