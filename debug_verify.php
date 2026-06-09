<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Models\Course;
use App\Http\Controllers\AiAdvisorController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

$u = User::whereHas('passedCourses')->first();
echo "User: {$u->name}\n";
Auth::login($u);

$controller = app(AiAdvisorController::class);

// Use reflection to access private methods for debugging
$reflection = new ReflectionClass(AiAdvisorController::class);
$getAcademicData = $reflection->getMethod('getStudentAcademicData');
$getAcademicData->setAccessible(true);
$academicData = $getAcademicData->invoke($controller, $u);

$getCartData = $reflection->getMethod('getCartData');
$getCartData->setAccessible(true);
$cartData = $getCartData->invoke($controller, $u);

$getAvailableCourses = $reflection->getMethod('getAvailableCourses');
$getAvailableCourses->setAccessible(true);
$availableCourses = $getAvailableCourses->invoke($controller, $academicData['passed_course_ids'], $cartData['ids'], $u);

echo "Available Courses Text Length: " . strlen($availableCourses['text']) . "\n";
echo "Available Courses Map Size: " . count($availableCourses['map']) . "\n";
echo "Available Courses Output:\n";
echo $availableCourses['text'] . "\n\n";

$buildSystemPrompt = $reflection->getMethod('buildSystemPrompt');
$buildSystemPrompt->setAccessible(true);
$prompt = $buildSystemPrompt->invoke($controller, $u, $academicData, $cartData, $availableCourses, '');

echo "System Prompt Length: " . strlen($prompt) . "\n";
echo substr($prompt, strpos($prompt, 'المواد المتاحة للتسجيل للطالب:'));

