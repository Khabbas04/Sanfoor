<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo; // 🔥 تم إضافة هذا السطر لاستدعاء العلاقة

class College extends Model
{
    use HasFactory;

    // 🔥 أضفنا university_id هنا لكي يسمح النظام بحفظ رقم الجامعة
    protected $fillable = ['university_id', 'name'];

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