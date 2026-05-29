<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

echo "Creating unverified student...\n";
$user = new User();
$user->name = 'Test Verify';
$user->email = 'test_verify_' . time() . '@test.com';
$user->password = Hash::make('Test1234');
$user->role = 'student';
$user->study_plan_version = 12;
$user->save();

try {
    $httpKernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $request = Request::create('/verify-email', 'GET');
    
    // We need to set session for auth to work properly in full stack
    $app['session']->start();
    $request->setLaravelSession($app['session']);
    
    Auth::login($user);
    
    echo "Handling request to /verify-email...\n";
    $response = $httpKernel->handle($request);
    
    echo "Response status: " . $response->getStatusCode() . "\n";
    if ($response->getStatusCode() >= 400) {
        echo "Response content:\n";
        echo strip_tags($response->getContent()) . "\n";
    }
} catch (\Throwable $e) {
    echo "Exception: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
} finally {
    $user->forceDelete();
}
