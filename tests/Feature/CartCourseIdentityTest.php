<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\Feature\Ai\AdvisorTestCase;

class CartCourseIdentityTest extends AdvisorTestCase
{
    public function test_cart_sync_keeps_only_one_logical_course_when_catalogue_rows_are_duplicated(): void
    {
        [$student, $major] = $this->student('logical-cart@example.com');
        $this->currentPeriod(1, '2027');
        $first = $this->course($major, [
            'name' => 'إدارة قواعد البيانات',
            'code' => 'CS330',
            'credit_hours' => 3,
        ]);
        $duplicate = $this->course($major, [
            'name' => 'ادارة قواعد البيانات',
            'code' => 'SE330',
            'credit_hours' => 3,
        ]);

        $this->actingAs($student)
            ->postJson(route('cart.sync'), ['course_ids' => [$first->id, $duplicate->id]])
            ->assertOk()
            ->assertJsonPath('synced_count', 1)
            ->assertJsonPath('synced_course_ids.0', $first->id)
            ->assertJsonPath('merged_duplicates.0.discarded_id', $duplicate->id)
            ->assertJsonPath('merged_duplicates.0.kept_id', $first->id);

        $this->assertSame(1, DB::table('user_carts')->where('user_id', $student->id)->count());
        $this->assertDatabaseHas('user_carts', [
            'user_id' => $student->id,
            'course_id' => $first->id,
            'academic_year' => '2027',
            'academic_term' => 1,
        ]);
        $this->assertDatabaseMissing('user_carts', [
            'user_id' => $student->id,
            'course_id' => $duplicate->id,
        ]);
    }

    public function test_single_course_toggle_removes_an_existing_equivalent_row(): void
    {
        [$student, $major] = $this->student('logical-toggle@example.com');
        $this->currentPeriod(1, '2027');
        $storedCourse = $this->course($major, [
            'name' => 'مبادئ هندسة البرمجيات',
            'code' => 'CS240',
        ]);
        $clickedEquivalent = $this->course($major, [
            'name' => 'مبادىء هندسة البرمجيات',
            'code' => 'SE240',
        ]);
        $this->addToCart($student, $storedCourse);
        DB::table('user_carts')->where('user_id', $student->id)->update([
            'academic_year' => '2027',
            'academic_term' => 1,
        ]);

        $this->actingAs($student)
            ->postJson(route('cart.toggle.single'), ['course_id' => $clickedEquivalent->id])
            ->assertOk()
            ->assertJsonPath('status', 'removed');

        $this->assertSame(0, DB::table('user_carts')->where('user_id', $student->id)->count());
    }
}
