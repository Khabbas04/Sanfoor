<?php

namespace Tests\Feature\Ai;

use App\Models\Landmark;
use Illuminate\Support\Facades\DB;

/**
 * Actions the student confirms. The advisor proposes; nothing is written until
 * this endpoint is called, and then only after the student's state is re-read and
 * re-validated.
 */
class AdvisorActionsTest extends AdvisorTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config()->set('ai.features.actions', true);
    }

    public function test_the_endpoint_is_closed_while_the_flag_is_off(): void
    {
        config()->set('ai.features.actions', false);

        [$user, $major] = $this->student();
        $course = $this->course($major);
        $this->currentPeriod();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'add_courses_to_cart', 'course_ids' => [$course->id]])
            ->assertNotFound();

        $this->assertDatabaseMissing('user_carts', ['user_id' => $user->id, 'course_id' => $course->id]);
    }

    public function test_guests_cannot_execute_actions(): void
    {
        $this->postJson(route('ai.advisor.action'), ['action' => 'add_courses_to_cart', 'course_ids' => [1]])
            ->assertUnauthorized();
    }

    public function test_an_action_outside_the_allow_list_is_refused(): void
    {
        [$user] = $this->student();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'delete_all_grades'])
            ->assertUnprocessable()
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('errors.0.code', 'action_not_allowed');
    }

    public function test_a_confirmed_add_writes_the_cart_and_audits_it(): void
    {
        [$user, $major] = $this->student();
        $first = $this->course($major, ['name' => 'مادة أولى', 'credit_hours' => 3]);
        $second = $this->course($major, ['name' => 'مادة ثانية', 'credit_hours' => 3]);
        $this->currentPeriod();

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'add_courses_to_cart',
                'course_ids' => [$first->id, $second->id],
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('refresh_cart', true);

        $this->assertSame(
            [$first->id, $second->id],
            array_column($response->json('applied'), 'id')
        );
        $this->assertSame('مادة أولى', $response->json('applied.0.name'));

        $this->assertDatabaseHas('user_carts', ['user_id' => $user->id, 'course_id' => $first->id]);
        $this->assertDatabaseHas('student_activity_logs', [
            'user_id' => $user->id,
            'course_id' => $first->id,
            'action' => 'course_cart_added',
        ]);
    }

    /** The decision is made against data read at execution time, not at proposal time. */
    public function test_an_action_is_validated_against_the_state_at_execution_time(): void
    {
        [$user, $major] = $this->student();
        $extra = $this->course($major, ['name' => 'مادة إضافية', 'credit_hours' => 3]);
        $this->currentPeriod();

        // The advisor proposed this while the cart was empty. By the time the
        // student presses the button, they have filled it to the 18-hour limit.
        foreach (range(1, 6) as $index) {
            $this->addToCart($user, $this->course($major, ['name' => "مادة سلة {$index}", 'credit_hours' => 3]));
        }

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.action'), [
                'action' => 'add_courses_to_cart',
                'course_ids' => [$extra->id],
            ])
            ->assertOk()
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('refresh_cart', false);

        $this->assertDatabaseMissing('user_carts', ['user_id' => $user->id, 'course_id' => $extra->id]);
        $this->assertStringContainsString('18 ساعة', $response->json('message'));
    }

    public function test_an_ineligible_course_is_refused_with_a_clear_reason(): void
    {
        [$user, $major] = $this->student();
        $prerequisite = $this->course($major, ['name' => 'البرمجة الأولى']);
        $locked = $this->course($major, ['name' => 'البرمجة المتقدمة', 'semester' => 2]);
        $locked->prerequisites()->attach($prerequisite->id);
        $this->currentPeriod();

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'add_courses_to_cart',
                'course_ids' => [$locked->id],
            ])
            ->assertOk()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseMissing('user_carts', ['user_id' => $user->id, 'course_id' => $locked->id]);
        $this->assertContains('not_eligible', array_column($response->json('errors'), 'code'));
        $this->assertStringContainsString('غير متاحة', $response->json('message'));
    }

    /** A partly valid request applies the valid part and says what it skipped. */
    public function test_a_partly_valid_add_applies_what_it_can(): void
    {
        [$user, $major] = $this->student();
        $good = $this->course($major, ['name' => 'مادة صالحة', 'credit_hours' => 3]);
        $prerequisite = $this->course($major, ['name' => 'متطلب']);
        $locked = $this->course($major, ['name' => 'مادة مغلقة', 'semester' => 2]);
        $locked->prerequisites()->attach($prerequisite->id);
        $this->currentPeriod();

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'add_courses_to_cart',
                'course_ids' => [$good->id, $locked->id],
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame([$good->id], array_column($response->json('applied'), 'id'));
        $this->assertSame([$locked->id], $response->json('skipped'));
        $this->assertDatabaseHas('user_carts', ['user_id' => $user->id, 'course_id' => $good->id]);
        $this->assertDatabaseMissing('user_carts', ['user_id' => $user->id, 'course_id' => $locked->id]);
    }

    public function test_a_confirmed_removal_only_removes_courses_in_the_cart(): void
    {
        [$user, $major] = $this->student();
        $inCart = $this->course($major, ['name' => 'مادة بالسلة']);
        $notInCart = $this->course($major, ['name' => 'مادة خارج السلة']);
        $this->addToCart($user, $inCart);
        $this->currentPeriod();

        $response = $this->actingAs($user->fresh())
            ->postJson(route('ai.advisor.action'), [
                'action' => 'remove_courses_from_cart',
                'course_ids' => [$inCart->id, $notInCart->id],
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame([$inCart->id], array_column($response->json('applied'), 'id'));
        $this->assertSame(0, DB::table('user_carts')->where('user_id', $user->id)->count());
        $this->assertDatabaseHas('student_activity_logs', [
            'user_id' => $user->id,
            'course_id' => $inCart->id,
            'action' => 'course_cart_removed',
        ]);
    }

    public function test_applying_a_semester_plan_adds_its_courses_within_the_limit(): void
    {
        [$user, $major] = $this->student();
        $ids = [];
        foreach (range(1, 5) as $index) {
            $ids[] = $this->course($major, ['name' => "مادة خطة {$index}", 'credit_hours' => 3])->id;
        }
        $this->currentPeriod();

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'apply_semester_plan',
                'course_ids' => $ids,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('action', 'apply_semester_plan');

        $this->assertCount(5, $response->json('applied'));
        $this->assertSame(5, DB::table('user_carts')->where('user_id', $user->id)->count());
    }

    /** A plan bigger than the student's limit is applied only as far as it fits. */
    public function test_a_plan_over_the_limit_is_truncated_not_forced(): void
    {
        [$user, $major] = $this->student();
        $ids = [];
        foreach (range(1, 8) as $index) {
            $ids[] = $this->course($major, ['name' => "مادة خطة {$index}", 'credit_hours' => 3])->id;
        }
        $this->currentPeriod();

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'apply_semester_plan', 'course_ids' => $ids])
            ->assertOk();

        // 18 hours is the cap, so six three-hour courses at most.
        $this->assertCount(6, $response->json('applied'));
        $this->assertSame(6, DB::table('user_carts')->where('user_id', $user->id)->count());
        $this->assertStringContainsString('18 ساعة', $response->json('message'));
    }

    public function test_an_action_cannot_touch_another_students_cart(): void
    {
        [$attacker, $attackerMajor] = $this->student('attacker@example.com');
        [$victim, $victimMajor] = $this->student('victim@example.com');
        $victimCourse = $this->course($victimMajor, ['name' => 'مادة الضحية']);
        $this->course($attackerMajor);
        $this->addToCart($victim, $victimCourse);
        $this->currentPeriod();

        // The course belongs to another plan, so it is not eligible for this student.
        $this->actingAs($attacker->fresh())
            ->postJson(route('ai.advisor.action'), [
                'action' => 'add_courses_to_cart',
                'course_ids' => [$victimCourse->id],
            ])
            ->assertOk()
            ->assertJsonPath('status', 'error');

        $this->assertDatabaseMissing('user_carts', ['user_id' => $attacker->id, 'course_id' => $victimCourse->id]);
        // The victim's cart is untouched.
        $this->assertSame(1, DB::table('user_carts')->where('user_id', $victim->id)->count());
    }

    public function test_an_action_tied_to_another_students_message_is_refused(): void
    {
        [$attacker, $attackerMajor] = $this->student('attacker@example.com');
        [$victim] = $this->student('victim@example.com');
        $course = $this->course($attackerMajor);
        $this->currentPeriod();

        $chat = $victim->chats()->create(['title' => 'محادثة الضحية']);
        $message = $chat->messages()->create(['role' => 'ai', 'content' => 'جواب']);

        $this->actingAs($attacker)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'add_courses_to_cart',
                'course_ids' => [$course->id],
                'message_id' => $message->id,
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('user_carts', ['user_id' => $attacker->id, 'course_id' => $course->id]);
    }

    /* ── navigation actions ─────────────────────────────────────────────── */

    public function test_navigation_returns_an_in_app_route_never_a_url(): void
    {
        [$user, $major] = $this->student();
        $course = $this->course($major);
        $this->currentPeriod();

        $response = $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'open_course_in_tree',
                'course_id' => $course->id,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame('tree.index', $response->json('target.route'));
        $this->assertSame($course->id, $response->json('target.params.course'));
        $this->assertFalse($response->json('refresh_cart'));
        // No URL crosses the wire, so a link cannot leave the application.
        $this->assertStringNotContainsString('http', json_encode($response->json('target')));
    }

    public function test_navigation_to_a_course_outside_the_plan_is_refused(): void
    {
        [$user, $major] = $this->student();
        [, $otherMajor] = $this->student('other@example.com');
        $this->course($major);
        $foreign = $this->course($otherMajor, ['name' => 'مادة تخصص آخر']);
        $this->currentPeriod();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'open_course_in_tree',
                'course_id' => $foreign->id,
            ])
            ->assertOk()
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('errors.0.code', 'course_not_visible');
    }

    public function test_opening_a_campus_place_resolves_a_landmark(): void
    {
        [$user] = $this->student();
        $landmark = Landmark::create(['name' => 'المكتبة', 'type' => 'facility', 'is_active' => true]);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'open_campus_place', 'place_id' => $landmark->id])
            ->assertOk()
            ->assertJsonPath('target.route', 'campus.directory')
            ->assertJsonPath('target.params.place', $landmark->id);

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'open_campus_place'])
            ->assertOk()
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('errors.0.code', 'invalid_target');
    }

    public function test_an_action_with_no_courses_changes_nothing(): void
    {
        [$user] = $this->student();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), ['action' => 'add_courses_to_cart', 'course_ids' => []])
            ->assertOk()
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('errors.0.code', 'no_courses');
    }

    public function test_the_payload_is_validated(): void
    {
        [$user] = $this->student();

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('action');

        $this->actingAs($user)
            ->postJson(route('ai.advisor.action'), [
                'action' => 'add_courses_to_cart',
                'course_ids' => range(1, 11),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('course_ids');
    }
}
