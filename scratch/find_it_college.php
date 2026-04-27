<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\College;
use App\Models\Major;

$itCollege = College::where('name', 'like', '%IT%')
    ->orWhere('name', 'like', '%تكنولوجيا المعلومات%')
    ->first();

if ($itCollege) {
    echo "IT_COLLEGE_ID=" . $itCollege->id . "\n";
    echo "IT_COLLEGE_NAME=" . $itCollege->name . "\n";
} else {
    echo "IT_COLLEGE_NOT_FOUND\n";
    // List all colleges to see what's available
    foreach (College::all() as $c) {
        echo "ID: " . $c->id . " Name: " . $c->name . "\n";
    }
}
