<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->index('portal_student_id', 'users_portal_student_id_idx');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->index(['major_id', 'study_plan_version', 'semester'], 'courses_major_plan_semester_idx');
        });

        $duplicatePairs = DB::table('course_user')
            ->select('user_id', 'course_id', DB::raw('MIN(id) as keep_id'))
            ->groupBy('user_id', 'course_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicatePairs as $pair) {
            DB::table('course_user')
                ->where('user_id', $pair->user_id)
                ->where('course_id', $pair->course_id)
                ->where('id', '<>', $pair->keep_id)
                ->delete();
        }

        Schema::table('course_user', function (Blueprint $table) {
            $table->unique(['user_id', 'course_id'], 'course_user_user_course_unique');
            $table->index('course_id', 'course_user_course_idx');
        });

        Schema::table('user_carts', function (Blueprint $table) {
            $table->index('course_id', 'user_carts_course_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_carts', function (Blueprint $table) {
            $table->dropIndex('user_carts_course_idx');
        });

        Schema::table('course_user', function (Blueprint $table) {
            $table->dropIndex('course_user_course_idx');
            $table->dropUnique('course_user_user_course_unique');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropIndex('courses_major_plan_semester_idx');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_portal_student_id_idx');
        });
    }
};