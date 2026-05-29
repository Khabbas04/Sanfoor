<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo; // 🔥 تم إضافة هذا السطر لاستدعاء العلاقة

class College extends Model
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
                    $collegeId = \App\Models\Major::withoutGlobalScopes()->where('id', $user->major_id)->value('college_id');
                    $builder->where('id', $collegeId);
                    return;
                }
            }
            $builder->where('id', 1);
        });
    }

    // 🔥 أضفنا حقول التفاصيل الملموسة عن الكلية
    protected $fillable = [
        'university_id',
        'name',
        'description',
        'building_symbol',
        'building_location',
        'services',
        'image_url',
        'location_latitude',
        'location_longitude',
        'maps_url',
    ];

    protected $casts = [
        'services' => 'json',
    ];

    /**
     * 🔥 العلاقة مع الجامعة (كل كلية تنتمي لجامعة واحدة)
     */
    public function university(): BelongsTo
    {
        return $this->belongsTo(University::class, 'university_id');
    }

    /**
     * 🔥 العلاقة مع التخصصات (الكلية الواحدة تضم عدة تخصصات)
     */
    public function majors(): HasMany
    {
        return $this->hasMany(Major::class);
    }
}