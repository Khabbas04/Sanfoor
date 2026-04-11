<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Course extends Model
{
    use HasFactory;

    // These fields are managed directly from the admin course CRUD flows.
    protected $fillable = [
        'name',
        'code',
        'credit_hours',
        'minimum_passed_hours',
        'type',
        'semester',
        'tree_position_x',
        'tree_position_y',
        'major_id',
        'study_plan_version',
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
}