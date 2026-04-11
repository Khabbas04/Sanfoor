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
        Schema::create('tree_course_positions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('course_id');
            $table->unsignedBigInteger('major_id')->default(0);
            $table->unsignedTinyInteger('study_plan_version')->default(12);
            $table->decimal('position_x', 10, 2);
            $table->decimal('position_y', 10, 2);
            $table->timestamps();

            $table->unique(['course_id', 'major_id', 'study_plan_version'], 'tree_course_positions_scope_unique');
            $table->index(['major_id', 'study_plan_version'], 'tree_course_positions_scope_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tree_course_positions');
    }
};