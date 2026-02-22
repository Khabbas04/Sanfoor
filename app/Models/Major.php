<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Major extends Model
{
    use HasFactory;

    protected $fillable = ['college_id', 'name', 'code'];

    /**
     * 🔥 العلاقة مع الكلية (كل تخصص ينتمي لكلية واحدة)
     */
    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class, 'college_id');
    }

    /**
     * العلاقة مع المستخدمين (الطلاب)
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}