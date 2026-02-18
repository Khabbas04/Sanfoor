<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * الحقول المسموح بتعبئتها (Mass Assignable).
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role', // صلاحية المستخدم (admin/student)
    ];

    /**
     * الحقول المخفية عند التحويل لـ JSON.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * تحويل أنواع البيانات (Casting).
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // =========================================================
    // 🔥 العلاقات المضافة حديثاً للنظام الشجري 🔥
    // =========================================================

    /**
     * العلاقة مع المواد التي أنجزها الطالب (Passed Courses).
     * تربط المستخدم بالمواد عبر الجدول الوسيط course_user.
     */
    public function passedCourses(): BelongsToMany
    {
        // تم استخدام الجدول الوسيط 'course_user' لتخزين إنجازات الطالب
        return $this->belongsToMany(Course::class, 'course_user')
                    ->withTimestamps(); // لحفظ تاريخ الإنجاز
    }
}