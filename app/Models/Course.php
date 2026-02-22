<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Course extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 
        'code', 
        'credit_hours', 
        'type', 
        'semester', 
        'major_id',
        'description'
    ];

    /**
     * 1. علاقة التخصص
     */
    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class);
    }

    /**
     * 2. علاقة المتطلبات السابقة (ماذا آخذ قبل هذه المادة؟)
     */
    public function prerequisites(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_prerequisites', 'course_id', 'prerequisite_id');
    }

    /**
     * 3. علاقة المواد التابعة (ماذا تفتح هذه المادة؟)
     */
    public function children(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_prerequisites', 'prerequisite_id', 'course_id');
    }

    /**
     * 🔥 4. علاقة المحاكي (التي تعالج خطأ تقرير الطلب) 🔥
     * تربط المادة بالطلاب الذين أضافوها للمحاكي عبر جدول user_carts
     */
    public function cartUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_carts', 'course_id', 'user_id');
    }
}