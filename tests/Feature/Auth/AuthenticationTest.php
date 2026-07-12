<?php

namespace Tests\Feature\Auth;

use App\Models\College;
use App\Models\Major;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_screen_can_be_rendered(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $major = $this->createMajor();
        $user = User::factory()->create([
            'role' => 'student',
            'major_id' => $major->id,
            'study_plan_version' => 12,
        ]);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_students_without_major_are_sent_to_complete_profile(): void
    {
        $user = User::factory()->create(['role' => 'student']);

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('profile.complete', absolute: false));
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $user = User::factory()->create();

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_users_can_logout(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/');
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
