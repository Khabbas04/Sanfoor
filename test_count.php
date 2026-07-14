<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class); 
$kernel->bootstrap(); 

echo "COUNT=" . \Illuminate\Support\Facades\DB::table('document_chunks')->count() . "\n";
