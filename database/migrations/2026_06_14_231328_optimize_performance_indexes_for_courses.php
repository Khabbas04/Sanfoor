<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            // Smart composite index to make the heavy statistics query instant
            $table->index(['course_id', 'grade'], 'idx_course_user_stats');
        });

        Schema::table('courses', function (Blueprint $table) {
            // Index for dashboard query filtering
            $table->index(['major_id', 'study_plan_version'], 'idx_courses_major_plan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            $table->dropIndex('idx_course_user_stats');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropIndex('idx_courses_major_plan');
        });
    }
};
