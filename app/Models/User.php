<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'major_id',
        'ip_address',       
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * تعريف أنواع البيانات (Casts) لضمان عدم تعطل النظام عند معالجة التواريخ.
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_login_at' => 'datetime', // 🔥 هذا السطر يمنع الشاشة البيضاء في لوحة الأدمن
        ];
    }

    /**
     * علاقة التخصص
     */
    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class , 'major_id');
    }

    /**
     * علاقة المهارات
     */
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class , 'user_skills')
            ->using(UserSkill::class)
            ->withPivot('proficiency_level')
            ->withTimestamps();
    }

    /**
     * علاقة المحاكي (كائن واحد)
     */
    public function cart(): HasOne
    {
        return $this->hasOne(UserCart::class);
    }

    /**
     * علاقة مواد المحاكي للأدمن (تستخدم لعرض المواد في تفاصيل الطالب)
     */
    public function cartCourses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'user_carts', 'user_id', 'course_id')
            ->withTimestamps();
    }

    /**
     * علاقة المواد المنجزة
     */
    public function passedCourses(): BelongsToMany
    {
        return $this->belongsToMany(
            Course::class ,
            'course_user', 
            'user_id', 
            'course_id' 
        )->withPivot('grade', 'studied_semester')->withTimestamps();
    }

    /**
     * دالة حساب المعدل التراكمي المركزية
     */
    public function calculateGPA()
    {
        $coursesWithGrades = $this->passedCourses()->whereNotNull('course_user.grade')->get();

        if ($coursesWithGrades->isEmpty()) {
            return ['percentage' => 0, 'gpa4' => '0.00'];
        }

        $totalCredits = 0;
        $weightedSum = 0;

        foreach ($coursesWithGrades as $course) {
            $grade = (float) $course->pivot->grade;
            
            if ($grade > 0) {
                $totalCredits += $course->credit_hours;
                $weightedSum += ($grade * $course->credit_hours);
            }
        }

        if ($totalCredits == 0) {
            return ['percentage' => 0, 'gpa4' => '0.00'];
        }

        $percentage = $weightedSum / $totalCredits;
        $gpa4 = number_format($percentage / 25, 2);

        return [
            'percentage' => round($percentage, 2),
            'gpa4' => $gpa4
        ];
    }
}