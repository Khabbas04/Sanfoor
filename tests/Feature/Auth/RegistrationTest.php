<?php

namespace Tests\Feature\Auth;

use App\Models\College;
use App\Models\Major;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_registration_redirects_to_login(): void
    {
        $response = $this->get('/register');

        $response->assertRedirect(route('login', absolute: false));
    }

    public function test_secret_registration_screen_can_be_rendered(): void
    {
        $response = $this->get('/admin-secret-register');

        $response->assertStatus(200);
    }

    public function test_new_users_can_register_from_secret_registration(): void
    {
        Http::fake();
        $major = $this->createMajor();

        $response = $this->post('/admin-secret-register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'major_id' => $major->id,
            'study_plan_version' => 12,
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('home', ['tour' => 'start'], false));
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
