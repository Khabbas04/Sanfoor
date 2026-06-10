<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $user = \App\Models\User::first();
    if (!$user) {
        echo "No user found.\n";
        exit;
    }
    Auth::login($user);

    $controller = app()->make(\App\Http\Controllers\InstructorAiAdvisorController::class);
    $request = Illuminate\Http\Request::create('/instructor/ai-scheduler/chat', 'POST', [
        'message' => 'test'
    ]);
    
    // Validate manually since FormRequest validation via controller might redirect or throw ValidationException
    $response = $controller->chat($request);
    
    echo "Success: " . $response->getContent() . "\n";
} catch (\Throwable $e) {
    echo "Exception: " . $e->getMessage() . " on line " . $e->getLine() . " in " . $e->getFile() . "\n";
}
