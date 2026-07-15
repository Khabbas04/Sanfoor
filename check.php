<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = App\Models\Course::withoutGlobalScopes()->where('code', '1506140')->first();
if ($course) {
    echo "Found! Major ID: " . ($course->major_id ?? 'null') . " | Plan Version: " . ($course->study_plan_version ?? 'null');
} else {
    echo "Course not found in DB.";
}
