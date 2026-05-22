<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class AcademicPeriod extends Model
{
    use HasFactory;

    protected $fillable = [
        'academic_year',
        'academic_term',
        'label',
        'is_current',
    ];

    protected $casts = [
        'academic_term' => 'integer',
        'is_current' => 'boolean',
    ];

    public static function current(): ?self
    {
        if (!Schema::hasTable('academic_periods')) {
            return null;
        }

        return static::query()
            ->where('is_current', true)
            ->latest('updated_at')
            ->first()
            ?? static::query()->latest('updated_at')->first();
    }

    public static function termLabel(?int $term): string
    {
        return match ((int) $term) {
            1 => 'الفصل الأول',
            2 => 'الفصل الثاني',
            3 => 'الفصل الصيفي',
            default => 'الفصل الدراسي',
        };
    }

    public function displayLabel(): string
    {
        $customLabel = trim((string) $this->label);
        if ($customLabel !== '') {
            return $customLabel;
        }

        return trim(sprintf('%s %s', $this->academic_year, self::termLabel((int) $this->academic_term)));
    }
}