<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class); 
$kernel->bootstrap(); 

$response = Illuminate\Support\Facades\Http::withoutVerifying()->get('https://generativelanguage.googleapis.com/v1beta/models?key='.env('GEMINI_API_KEY'));
print_r($response->json());
