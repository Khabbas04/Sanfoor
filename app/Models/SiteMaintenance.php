<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class SiteMaintenance extends Model
{
    use HasFactory;

    protected $table = 'site_maintenance';

    protected $fillable = [
        'is_enabled',
        'title',
        'message',
        'expected_minutes',
        'activated_at',
        'ended_at',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'expected_minutes' => 'integer',
        'activated_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::saved(fn () => \Illuminate\Support\Facades\Cache::forget('site_maintenance_current'));
        static::deleted(fn () => \Illuminate\Support\Facades\Cache::forget('site_maintenance_current'));
    }

    public static function current(): ?self
    {
        return \Illuminate\Support\Facades\Cache::remember('site_maintenance_current', 3600, function () {
            try {
                return static::query()->latest('updated_at')->first();
            } catch (\Exception $e) {
                return null;
            }
        });
    }
}