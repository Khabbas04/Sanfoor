<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The advisor's optional academic memory.
 *
 * Deliberately NOT a transcript of the conversation: only five decisions the
 * student made explicitly, each of which changes future advice. Past messages are
 * never mined for this — a student who once mentioned a hard semester should not
 * find that inferred back at them months later.
 *
 * One row per student, cleared in full by their own button.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('student_ai_preferences')) {
            return;
        }

        Schema::create('student_ai_preferences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();

            // "أبي أسرّع تخرجي" / "أبي أرفع معدلي" — the goal advice is shaped around.
            $table->string('active_goal', 40)->nullable();
            // The number of hours they said suits them.
            $table->unsignedTinyInteger('preferred_load')->nullable();
            // easy | balanced | hard
            $table->string('difficulty_preference', 20)->nullable();
            $table->decimal('gpa_target', 5, 2)->nullable();
            // The last plan they actually applied, so a follow-up can refer to it.
            $table->json('last_approved_plan')->nullable();

            // Shown to the student as "saved on", so the memory is never a secret.
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_ai_preferences');
    }
};
