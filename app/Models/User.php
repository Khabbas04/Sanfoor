<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Carbon;
use App\Services\BrevoMailer;

class User extends Authenticatable implements MustVerifyEmail
{
    // HasApiTokens is kept for future mobile or API-based authentication flows.
    use HasApiTokens, HasFactory, Notifiable;

    // These attributes are safe to mass assign during registration and profile updates.
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'major_id',
        'ip_address',
        'last_login_at',
    ];

    // Hide sensitive authentication and security fields from serialized responses.
    protected $hidden = [
        'password',
        'remember_token',
        'ip_address',
        'last_login_at',
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
     * Normalize role value on write (Owner/OWNER -> owner).
     */
    public function setRoleAttribute($value): void
    {
        $this->attributes['role'] = strtolower((string) $value);
    }

    /**
     * The academic major assigned to the user.
     */
    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class, 'major_id');
    }

    /**
     * The user cart parent record when a dedicated cart entity is needed.
     */
    public function cart(): HasOne
    {
        return $this->hasOne(UserCart::class);
    }

    /**
     * Courses currently added to the simulation cart.
     */
    public function cartCourses(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'user_carts', 'user_id', 'course_id')
            ->withTimestamps();
    }

    /**
     * Courses already completed by the student, including grade metadata.
     */
    public function passedCourses(): BelongsToMany
    {
        return $this->belongsToMany(
            Course::class,
            'course_user',
            'user_id',
            'course_id'
        )->withPivot('grade', 'studied_semester')->withTimestamps();
    }

    /**
     * AI chat threads owned by this user.
     */
    public function chats(): HasMany
    {
        return $this->hasMany(Chat::class)->latest();
    }

    /**
     * Issue reports submitted by the user.
     */
    public function issueReports(): HasMany
    {
        return $this->hasMany(IssueReport::class);
    }

    // ---------------------------------------------------------------------
    // Academic analytics helpers used by dashboards and advisor features.
    // ---------------------------------------------------------------------

    /**
     * Build a unique skill list from completed courses for dashboard display.
     */
    public function getSkillsFromPassedCourses()
    {
        return $this->passedCourses()
            // Qualify the column name to avoid ambiguous SQL in joined queries.
            ->whereNotNull('courses.skills')
            ->where('courses.skills', '!=', '')
            ->get()
            ->flatMap(function ($course) {
                // Convert the comma-separated skill string into normalized objects.
                $skillsArray = explode(',', $course->skills);

                return array_map(fn($skill) => [
                    'name' => trim($skill),
                    'course_source' => $course->name,
                    'course_code' => $course->code,
                ], $skillsArray);
            })
            ->filter(fn($skill) => !empty($skill['name']))
            ->unique('name')
            ->values();
    }

    /**
     * Calculate the weighted GPA in both percentage and 4.0 scale formats.
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
            $totalCredits += $course->credit_hours;
            $weightedSum += ($grade * $course->credit_hours);
        }

        if ($totalCredits == 0) {
            return ['percentage' => 0, 'gpa4' => '0.00'];
        }

        $percentage = $weightedSum / $totalCredits;
        $gpa4 = number_format($percentage / 25, 2);

        return [
            'percentage' => round($percentage, 2),
            'gpa4' => $gpa4,
        ];
    }

    /**
     * Check whether the student has completed the minimum graduation hours.
     */
    public function isEligibleForGraduation($requiredHours = 132)
    {
        $completedHours = $this->passedCourses()->sum('credit_hours');

        return [
            'is_eligible' => $completedHours >= $requiredHours,
            'remaining_hours' => max(0, $requiredHours - $completedHours),
            'progress_percentage' => round(($completedHours / $requiredHours) * 100, 1),
        ];
    }

    /**
     * Convenience helper for owner-only authorization checks.
     */
    public function isOwner(): bool
    {
        return strtolower((string) $this->role) === 'owner';
    }

    /**
     * Convenience helper for admin and owner authorization checks.
     */
    public function isAdminOrOwner(): bool
    {
        return in_array(strtolower((string) $this->role), ['admin', 'owner'], true);
    }

    // ---------------------------------------------------------------------
    // Notification overrides that route email through Brevo instead of mail.
    // ---------------------------------------------------------------------

    /**
     * Send the password reset email through Brevo.
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
     * Send the email verification message through Brevo.
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