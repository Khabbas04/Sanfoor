<?php 
require "vendor/autoload.php"; 
$app = require_once "bootstrap/app.php"; 
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class); 
$kernel->bootstrap(); 

$controller = app(App\Http\Controllers\AiAdvisorController::class);

$user = \App\Models\User::first();
\Illuminate\Support\Facades\Auth::login($user);

$request = new \Illuminate\Http\Request();
$request->replace(['message' => 'شو نص المادة رقم 13 في قوانين الجامعة؟']);

try {
    $response = $controller->chat($request);
    echo $response->getContent();
} catch (\Exception $e) {
    echo $e->getMessage();
}
