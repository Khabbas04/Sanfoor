<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$logs = App\Models\AdminLog::where('action', 'NEW_USER_REGISTERED')->latest()->take(5)->get();
foreach($logs as $l) {
    echo $l->id . ' - ' . $l->created_at . ' - ' . $l->details . PHP_EOL;
}
echo 'Total: ' . App\Models\AdminLog::where('action', 'NEW_USER_REGISTERED')->count() . PHP_EOL;
