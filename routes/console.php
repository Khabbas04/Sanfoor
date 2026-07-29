<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use Illuminate\Support\Facades\Schedule;

Schedule::command('backup:clean')->daily()->at('02:00');
Schedule::command('backup:run')->daily()->at('03:00');

// One row per Gemini API call adds up; keep the monitoring table inside its
// retention window (config/gemini.php) so the dashboard it feeds stays fast.
Schedule::command('gemini:prune-usage')->daily()->at('04:00');
