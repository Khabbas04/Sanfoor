<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Course extends Model
{
    use HasFactory;

    protected static function booted()
    {
        static::addGlobalScope('college_filter', function ($builder) {
            if (app()->runningInConsole()) {
                return;
            }
            if (auth()->check()) {
                $user = auth()->user();
                if ($user->isAdminOrOwner()) {
                    return;
                }
                if ($user->major_id) {
                    $collegeId = \Illuminate\Support\Facades\Cache::remember(
                        "major_college_id:{$user->major_id}",
                        3600,
                        fn () => \App\Models\Major::withoutGlobalScopes()->where('id', $user->major_id)->value('college_id')
                    );
                    $builder->where(function ($query) use ($collegeId) {
                        $query->where('courses.college_id', $collegeId)
                              ->orWhereHas('major', function ($q) use ($collegeId) {
                                  $q->where('college_id', $collegeId);
                              })
                              ->orWhere(function ($q) {
                                  $q->whereNull('courses.major_id')
                                    ->whereNull('courses.college_id');
                              });
                    });
                    return;
                }
            }
            // Guest or no major: default to College 1 (IT) + university requirements
            $builder->where(function ($query) {
                $query->where('courses.college_id', 1)
                      ->orWhereHas('major', function ($q) {
                          $q->where('college_id', 1);
                      })
                      ->orWhere(function ($q) {
                          $q->whereNull('courses.major_id')
                            ->whereNull('courses.college_id');
                      });
            });
        });

        static::saved(function ($course) {
            \Illuminate\Support\Facades\Cache::increment('dashboard_courses_version');
            \App\Http\Controllers\TreeController::flushCourseTreeCache();
        });

        static::deleted(function ($course) {
            \Illuminate\Support\Facades\Cache::increment('dashboard_courses_version');
            \App\Http\Controllers\TreeController::flushCourseTreeCache();
        });
    }

    // These fields are managed directly from the admin course CRUD flows.
    protected $fillable = [
        'name',
        'code',
        'credit_hours',
        'difficulty_level',
        'minimum_passed_hours',
        'type',
        'semester',
        'tree_position_x',
        'tree_position_y',
        'major_id',
        'college_id',
        'study_plan_version',
        'is_quiz_only',
        'description',
    ];

    /**
     * The major this course belongs to.
     */
    public function major(): BelongsTo
    {
        return $this->belongsTo(Major::class);
    }

    /**
     * The college this course belongs to.
     */
    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    /**
     * Courses that must be completed before taking this course.
     */
    public function prerequisites(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_prerequisites', 'course_id', 'prerequisite_id');
    }

    /**
     * Courses unlocked by completing this course.
     */
    public function children(): BelongsToMany
    {
        return $this->belongsToMany(Course::class, 'course_prerequisites', 'prerequisite_id', 'course_id');
    }

    /**
     * Users who added this course to their simulation carts.
     */
    public function cartUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_carts', 'course_id', 'user_id');
    }

    /**
     * Chapters belonging to this course.
     */
    public function chapters(): HasMany
    {
        return $this->hasMany(Chapter::class)->orderBy('order');
    }

    /**
     * Questions belonging to this course.
     */
    public function questions(): HasMany
    {
        return $this->hasMany(Question::class);
    }

    /**
     * Sections (schedule) for this course.
     */
    public function sections(): HasMany
    {
        return $this->hasMany(CourseSection::class);
    }
}