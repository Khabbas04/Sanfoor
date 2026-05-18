<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = App\Models\Course::withoutGlobalScopes()->get(['id', 'name', 'code', 'study_plan_version', 'is_quiz_only', 'major_id']);
foreach ($courses as $c) {
    echo "ID: {$c->id} | Name: {$c->name} | Code: {$c->code} | Version: " . ($c->study_plan_version ?? 'NULL') . " | QuizOnly: {$c->is_quiz_only} | Major: " . ($c->major_id ?? 'NULL') . "\n";
}
