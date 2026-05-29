<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

// We need to fully bootstrap the kernel so services like 'hash' are available
$kernel->bootstrap();

echo "Creating unverified student...\n";

// Ensure a major exists
$college = \App\Models\College::firstOrCreate(['id' => 1], ['name' => 'Test College']);
$major = \App\Models\Major::withoutGlobalScopes()->firstOrCreate(['id' => 1], ['college_id' => $college->id, 'name' => 'Test Major', 'code' => 'TM']);

$user = new User();
$user->name = 'Test Student';
$user->email = 'test_student_' . time() . '@test.com';
$user->password = bcrypt('Test1234');
$user->role = 'student';
$user->major_id = 1;
$user->study_plan_version = 12;
$user->save();

try {
    $request = Request::create('/tree', 'GET');
    
    // We need to set session for auth to work properly in full stack
    $session = $app['session']->driver();
    $session->start();
    $request->setLaravelSession($session);
    
    Auth::login($user);
    
    echo "Handling request to /dashboard...\n";
    $response = $kernel->handle($request);
    
    echo "Response status: " . $response->getStatusCode() . "\n";
    if ($response->getStatusCode() >= 400) {
        if (str_contains($response->getContent(), 'System/Error')) {
            echo "Inertia error page returned. Check exception log.\n";
        } else {
            echo strip_tags($response->getContent()) . "\n";
        }
    }
} catch (\Throwable $e) {
    echo "Exception: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
} finally {
    $user->forceDelete();
}
