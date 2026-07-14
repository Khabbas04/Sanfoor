<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class); 
$kernel->bootstrap(); 

$engine = app(App\Engines\DocumentRagEngine::class); 
print_r($engine->search('شو نص المادة رقم 13 في قوانين الجامعة؟', 10));
