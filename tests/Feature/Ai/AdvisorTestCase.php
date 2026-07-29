<?php

namespace Tests\Feature\Ai;

use App\Models\AcademicPeriod;
use App\Models\College;
use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use App\Services\GeminiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Support\FakeGeminiService;
use Tests\TestCase;

/**
 * Shared fixtures for the AI advisor suite.
 *
 * These tests are CHARACTERIZATION tests first: they pin the behaviour the
 * advisor has today — including the parts that are arguably wrong — so that the
 * staged enhancement work can prove it changed nothing it did not mean to.
 * Anywhere a test documents questionable behaviour it says so explicitly.
 */
abstract class AdvisorTestCase extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // No keys by default: every test states which transport it wants.
        config()->set('services.gemini.keys', '');
        config()->set('services.gemini.key', '');

        Cache::flush();
    }

    /** A student with a major of their own college, on study plan version 12. */
    protected function student(string $email = 'advisee@example.com', array $overrides = []): array
    {
        $college = College::create(['name' => 'كلية ' . uniqid()]);
        $major = Major::withoutEvents(fn () => Major::create([
            'college_id' => $college->id,
            'name' => 'تخصص ' . uniqid(),
            'code' => strtoupper(substr(md5($email), 0, 5)),
        ]));

        $user = User::forceCreate(array_merge([
            'name' => 'سامر الطالب',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'student',
            'major_id' => $major->id,
            'study_plan_version' => 12,
            'email_verified_at' => now(),
        ], $overrides));

        return [$user, $major];
    }

    protected function course(Major $major, array $overrides = []): Course
    {
        return Course::withoutEvents(fn () => Course::create(array_merge([
            'name' => 'مادة ' . uniqid(),
            'code' => strtoupper(substr(uniqid(), -6)),
            'credit_hours' => 3,
            'difficulty_level' => 3,
            'type' => 'compulsory',
            'semester' => 1,
            'major_id' => $major->id,
            'college_id' => $major->college_id,
            'study_plan_version' => 12,
        ], $overrides)));
    }

    /** Mark a course as completed with a grade (null grade = passed, ungraded). */
    protected function pass(User $user, Course $course, ?float $grade = 80): void
    {
        $user->passedCourses()->attach($course->id, ['grade' => $grade]);
        $user->unsetRelation('passedCourses');
        $this->forgetStudentCaches($user);
    }

    protected function addToCart(User $user, Course $course): void
    {
        DB::table('user_carts')->insertOrIgnore([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $user->unsetRelation('cartCourses');
        $this->forgetStudentCaches($user);
    }

    protected function currentPeriod(int $term = 1, string $year = '2026/2027'): AcademicPeriod
    {
        Cache::forget('academic_period_current');

        return AcademicPeriod::create([
            'academic_year' => $year,
            'academic_term' => $term,
            'is_current' => true,
        ]);
    }

    /**
     * Bind a Gemini double for the whole request. $responses are raw model
     * documents, consumed in order (the last one repeats).
     */
    protected function fakeGemini(array $responses = []): FakeGeminiService
    {
        $fake = new FakeGeminiService($responses);
        $this->app->instance(GeminiService::class, $fake);

        // The controller asks the container per request, so the same instance is
        // reused and its recorded calls survive into the assertions.
        return $fake;
    }

    /** A complete advisor envelope with only the fields a test cares about. */
    protected function envelope(array $overrides = []): string
    {
        return json_encode(array_merge([
            'reply' => 'تفضل يا سامر، هذا تحليل وضعك 🙂',
            'suggested_course_ids' => [],
            'courses_to_add' => [],
            'courses_to_remove' => [],
            'follow_up_suggestions' => [],
            'interactive_widget' => null,
        ], $overrides), JSON_UNESCAPED_UNICODE);
    }

    protected function dailyUsageKey(User $user): string
    {
        return 'ai_daily_usage_' . $user->id . '_' . date('Y-m-d');
    }

    protected function forgetStudentCaches(User $user): void
    {
        Cache::forget("student_academic_data_{$user->id}");
        Cache::forget("student_cart_data_{$user->id}");
        Cache::flush();
    }
}
