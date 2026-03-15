<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Major extends Model
{
    use HasFactory;

    // Basic major metadata managed from the academic structure admin tools.
    protected $fillable = ['college_id', 'name', 'code'];

    /**
     * The college that owns this academic major.
     */
    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class, 'college_id');
    }

    /**
     * Students assigned to this major.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}