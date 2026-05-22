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

    public static function current(): ?self
    {
        if (!Schema::hasTable('site_maintenance')) {
            return null;
        }

        return static::query()->latest('updated_at')->first();
    }
}