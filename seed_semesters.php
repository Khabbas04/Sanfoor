<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = [
    1 => ['1506140', '1501230', '1501114'],
    2 => ['1501110', '1501111', '1501220', '1506343'],
    3 => ['1501112', '1501113', '1506180', '1506181', '1505201', '0300103'],
    4 => ['1501340', '1501221', '1501222', '1505101', '1503270'],
    5 => ['1501321', '1506341', '1501385', '1506280'],
    6 => ['1506342', '1505333', '1506345', '0301241', '1506493'],
    7 => ['1506348', '1506391', '1506344', '1506440', '0200115'],
    8 => ['1506446', '1506495', '1506445', '1509999']
];

foreach ($courses as $sem => $codes) {
    App\Models\Course::withoutGlobalScopes()
        ->whereIn('code', $codes)
        // ->where('major_id', 2) // Commented out just in case some are university requirements (null)
        ->where('study_plan_version', 11)
        ->update(['semester' => $sem]);
}

echo 'Done';
