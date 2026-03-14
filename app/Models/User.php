<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens; // 🔥 التحديث 1: استيراد مكتبة التوكنات للموبايل
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Carbon;
use App\Services\BrevoMailer;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable; // 🔥 التحديث 2: إضافة HasApiTokens هنا

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

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_login_at' => 'datetime',
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
     * علاقة المهارات (اليدوية)
     */
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class , 'user_skills')
            ->withPivot('proficiency_level')
            ->withTimestamps();
    }

    /**
     * علاقة المحاكي (كائن الربط)
     */
    public function cart(): HasOne
    {
        return $this->hasOne(UserCart::class);
    }

    /**
     * علاقة مواد المحاكي (للقراءة والتحكم من الـ AI)
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
     * سجل محادثات الذكاء الاصطناعي
     */
    public function chats(): HasMany
    {
        return $this->hasMany(Chat::class)->latest();
    }

    // =========================================================
    // 🔥 وظائف الذكاء الاصطناعي والتحليلات الجديدة 🔥
    // =========================================================

    /**
     * استخلاص المهارات من المواد المنجزة (AI Skill Mapping)
     * تستخدم لعرض مهارات الطالب في الداشبورد بناءً على نجاحه في المواد
     */
    public function getSkillsFromPassedCourses()
    {
        return $this->passedCourses()
            // 🔥 تحديد اسم الجدول لمنع خطأ الـ SQL (Undefined column / Ambiguity)
            ->whereNotNull('courses.skills')
            // 🔥 التأكد من عدم جلب حقول تحتوي على نصوص فارغة
            ->where('courses.skills', '!=', '') 
            ->get()
            ->flatMap(function ($course) {
                // تحويل المهارات من نص (Comma separated) إلى مصفوفة
                $skillsArray = explode(',', $course->skills);
                return array_map(fn($skill) => [
                    'name' => trim($skill),
                    'course_source' => $course->name,
                    'course_code' => $course->code
                ], $skillsArray);
            })
            // 🔥 تصفية إضافية لمنع أي مهارة فارغة من الظهور في الداشبورد
            ->filter(fn($skill) => !empty($skill['name'])) 
            ->unique('name')
            ->values();
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

    /**
     * التحقق مما إذا كان الطالب مؤهلاً للتخرج (AI Graduation Auditor)
     */
    public function isEligibleForGraduation($requiredHours = 132)
    {
        $completedHours = $this->passedCourses()->sum('credit_hours');
        return [
            'is_eligible' => $completedHours >= $requiredHours,
            'remaining_hours' => max(0, $requiredHours - $completedHours),
            'progress_percentage' => round(($completedHours / $requiredHours) * 100, 1)
        ];
    }

    public function isOwner(): bool
    {
        return strtolower((string) $this->role) === 'owner';
    }

    public function isAdminOrOwner(): bool
    {
        return in_array(strtolower((string) $this->role), ['admin', 'owner'], true);
    }

    // =========================================================
    // 📧 إرسال الإيميلات عبر Brevo API (تجاوز الافتراضي)
    // =========================================================

    /**
     * إرسال رابط إعادة تعيين كلمة المرور عبر Brevo
     */
    public function sendPasswordResetNotification($token): void
    {
        $resetUrl = url(route('password.reset', [
            'token' => $token,
            'email' => $this->email,
        ], false));

        BrevoMailer::send(
            $this->email,
            'إعادة تعيين كلمة المرور - سنفور',
            BrevoMailer::passwordResetHtml($resetUrl)
        );
    }

    /**
     * إرسال رابط تأكيد البريد الإلكتروني عبر Brevo
     */
    public function sendEmailVerificationNotification(): void
    {
        $verifyUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addMinutes(60),
            [
                'id'   => $this->getKey(),
                'hash' => sha1($this->getEmailForVerification()),
            ]
        );

        BrevoMailer::send(
            $this->email,
            'تأكيد البريد الإلكتروني - سنفور',
            BrevoMailer::verifyEmailHtml($verifyUrl)
        );
    }
}