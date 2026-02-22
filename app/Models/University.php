<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class University extends Model
{
    use HasFactory;

    // الحقول المسموح تعبئتها
    protected $fillable = ['name'];

    /**
     * 🔥 العلاقة مع الكليات (الجامعة الواحدة تضم عدة كليات)
     */
    public function colleges(): HasMany
    {
        return $this->hasMany(College::class);
    }
}