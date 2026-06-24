<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$keys = explode(',', config('services.gemini.keys'));
$key = trim($keys[0]);

$url = "https://generativelanguage.googleapis.com/v1beta/models?key={$key}";

$response = \Illuminate\Support\Facades\Http::withoutVerifying()->get($url);

echo "Status: " . $response->status() . "\n";
echo "Body: " . $response->body() . "\n";
