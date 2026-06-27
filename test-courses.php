<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$majors = \App\Models\Major::all();
foreach ($majors as $m) {
    echo "ID: " . $m->id . " - " . $m->name . "\n";
}
