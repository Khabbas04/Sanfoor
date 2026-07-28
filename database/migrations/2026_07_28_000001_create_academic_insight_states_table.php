<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_insight_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('fingerprint', 64);
            $table->string('insight_type', 40);
            $table->string('priority', 20);
            $table->string('recommendation_version', 30);
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('details_opened_at')->nullable();
            $table->timestamp('action_clicked_at')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->timestamp('dismissed_until')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'fingerprint']);
            $table->index(['user_id', 'dismissed_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('academic_insight_states');
    }
};
