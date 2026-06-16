<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BannedUser extends Model
{
    protected $fillable = ['email', 'reason'];
}
