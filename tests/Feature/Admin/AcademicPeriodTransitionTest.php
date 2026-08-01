<?php

namespace Tests\Feature\Admin;

use App\Models\AcademicPeriod;
use App\Models\StudentAiPreference;
use App\Models\User;
use App\Support\AcademicCache;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Feature\Ai\AdvisorTestCase;

class AcademicPeriodTransitionTest extends AdvisorTestCase
{
    public function test_starting_the_first_term_resets_trial_registration_and_refreshes_system_and_ai_context(): void
    {
        [$student, $major] = $this->student();
        $course = $this->course($major);
        $this->currentPeriod(3, '2026');
        $this->addToCart($student, $course);
        StudentAiPreference::create([
            'user_id' => $student->id,
            'preferred_load' => 15,
            'last_approved_plan' => [
                'course_ids' => [$course->id],
                'names' => [$course->name],
                'applied_at' => now()->toISOString(),
            ],
        ]);

        Cache::put('admin_dashboard_demand_report', ['stale' => true], 300);
        $oldGeneration = AcademicCache::version();

        $this->actingAs($this->admin())
            ->put(route('admin.settings.academic_period'), [
                'academic_year' => '2026',
                'academic_term' => 1,
                'label' => '2026/الفصل الأول',
            ])
            ->assertRedirect();

        $this->assertSame(0, DB::table('user_carts')->count());
        $this->assertNull(StudentAiPreference::where('user_id', $student->id)->value('last_approved_plan'));
        $this->assertSame(15, StudentAiPreference::where('user_id', $student->id)->value('preferred_load'));
        $this->assertNull(Cache::get('admin_dashboard_demand_report'));
        $this->assertGreaterThan($oldGeneration, AcademicCache::version());

        $period = AcademicPeriod::current();
        $this->assertSame(1, $period?->academic_term);
        $this->assertSame('2026', $period?->academic_year);
        $this->assertSame(18, $period?->maxHours());

        $this->actingAs($student)
            ->get(route('ai.advisor'))
            ->assertInertia(fn ($page) => $page
                ->where('academic_period.academic_term', 1)
                ->where('studentStats.cart_hours', 0)
                ->where('studentStats.max_allowed_hours', 18)
                ->where('initialCartIds', [])
            );

        $this->actingAs($student)
            ->get(route('tree.index'))
            ->assertInertia(fn ($page) => $page
                ->where('academic_period.academic_term', 1)
                ->where('registration_rules.is_summer', false)
                ->where('registration_rules.term_limit', 18)
                ->where('registration_rules.effective_limit', 18)
                ->where('initial_cart_ids', [])
            );

        $this->actingAs($student)
            ->get(route('dashboard'))
            ->assertInertia(fn ($page) => $page
                ->where('academic_period.academic_term', 1)
                ->where('registration_rules.is_summer', false)
                ->where('registration_rules.term_limit', 18)
                ->where('registration_rules.effective_limit', 18)
                ->where('cart_courses', [])
            );

        $fake = $this->fakeGemini([$this->envelope()]);
        $this->actingAs($student)
            ->postJson(route('ai.advisor.chat'), ['message' => 'كم ساعة أستطيع تسجيلها الآن؟'])
            ->assertOk();

        $this->assertStringContainsString('18 ساعة', $fake->lastSystemInstruction());
        $this->assertStringContainsString('السلة الحالية: 0 ساعات', $fake->lastSystemInstruction());
    }

    public function test_editing_only_the_current_term_label_does_not_clear_trial_registration(): void
    {
        [$student, $major] = $this->student('label-only@example.com');
        $course = $this->course($major);
        $this->currentPeriod(1, '2026');
        $this->addToCart($student, $course);

        $this->actingAs($this->admin('admin-label@example.com'))
            ->put(route('admin.settings.academic_period'), [
                'academic_year' => '2026',
                'academic_term' => 1,
                'label' => 'عنوان محدث للفصل الأول',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('user_carts', [
            'user_id' => $student->id,
            'course_id' => $course->id,
        ]);
    }

    private function admin(string $email = 'term-admin@example.com'): User
    {
        return User::forceCreate([
            'name' => 'مدير النظام',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);
    }
}
