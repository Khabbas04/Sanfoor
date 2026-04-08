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
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'study_plan_version')) {
                $table->unsignedTinyInteger('study_plan_version')->default(12)->after('major_id');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'study_plan_version')) {
                $table->unsignedTinyInteger('study_plan_version')->default(12)->after('major_id');
            }
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropUnique('courses_code_unique');
            $table->unique(['code', 'major_id', 'study_plan_version'], 'courses_code_major_plan_unique');
            $table->index(['major_id', 'study_plan_version'], 'courses_major_plan_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropIndex('courses_major_plan_idx');
            $table->dropUnique('courses_code_major_plan_unique');
            $table->unique('code');
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'study_plan_version')) {
                $table->dropColumn('study_plan_version');
            }
        });

        Schema::table('courses', function (Blueprint $table) {
            if (Schema::hasColumn('courses', 'study_plan_version')) {
                $table->dropColumn('study_plan_version');
            }
        });
    }
};
