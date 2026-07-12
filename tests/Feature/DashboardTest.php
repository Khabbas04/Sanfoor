<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Major;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_student_dashboard(): void
    {
        $major = $this->createMajor();
        $user = User::forceCreate([
            'name' => 'Test Student',
            'email' => 'test_student@example.com',
            'password' => Hash::make('password'),
            'role' => 'student',
            'major_id' => $major->id,
            'study_plan_version' => 12,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->get('/dashboard')
            ->assertOk();
    }

    private function createMajor(): Major
    {
        $college = College::create(['name' => 'Test College']);

        return Major::withoutEvents(fn () => Major::create([
            'college_id' => $college->id,
            'name' => 'Test Major',
            'code' => 'TM',
        ]));
    }
}
