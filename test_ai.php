<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

Auth::login(\App\Models\User::first());
$controller = app(\App\Http\Controllers\AiAdvisorController::class);
$req = new \Illuminate\Http\Request();
$req->merge(['message' => 'احسبلي لو بدي ارفع معدلي ل 84 كم لازم اجيب بكل مادة بافتراض 7 ساعات', 'chat_id' => null, 'client_time' => now()]);
$resp = $controller->handleChat($req);
echo json_encode($resp->getData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
