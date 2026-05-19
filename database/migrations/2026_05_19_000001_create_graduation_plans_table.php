<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('graduation_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('major_id')->nullable()->constrained('majors')->nullOnDelete();
            $table->unsignedTinyInteger('study_plan_version')->default(12);
            $table->json('payload');
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->unique('user_id', 'graduation_plans_user_unique');
            $table->index(['major_id', 'study_plan_version'], 'graduation_plans_major_plan_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('graduation_plans');
    }
};
