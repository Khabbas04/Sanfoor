<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

// Minimal model used for sitemap integration and future study-plan resources.
class Plan extends Model
{
    use HasFactory;

    // Keep the table name explicit because this model was added after the initial schema.
    protected $table = 'plans';

    // Allow mass assignment until dedicated fillable rules are introduced.
    protected $guarded = [];
}
