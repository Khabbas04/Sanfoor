<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class DashboardTest extends TestCase
{
    // Do NOT use RefreshDatabase as it will wipe Laragon db
    // use RefreshDatabase;

    public function test_new_student_dashboard()
    {
        $user = User::create([
            'name' => 'Test Student',
            'email' => 'test_student_' . time() . '@example.com',
            'password' => Hash::make('password'),
            'role' => 'student',
            'major_id' => 1,
            'study_plan_version' => 12,
        ]);

        $this->actingAs($user);

        // We expect a redirect to verification.notice if email is not verified
        $response = $this->get('/dashboard');
        
        echo "Response status for unverified user: " . $response->getStatusCode() . "\n";
        
        // Now let's verify them and see if dashboard works
        $user->email_verified_at = now();
        $user->save();
        
        $response = $this->get('/dashboard');
        echo "Response status for verified user: " . $response->getStatusCode() . "\n";
        
        if ($response->getStatusCode() >= 400) {
            echo "Exception message: " . $response->exception->getMessage() . "\n";
            echo "Trace: " . $response->exception->getTraceAsString() . "\n";
        }
        
        $user->forceDelete();
    }
}
