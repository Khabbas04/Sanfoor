<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per advisor request, for answering questions the text logs cannot:
 * which intents students actually ask about, how often the fallback fires, how
 * long a reply takes, which tools run, and where validation rejects the model.
 *
 * A separate table on purpose — `chats` and `messages` are the student's own
 * conversation and must not grow operational columns. Nothing here is required by
 * a reply: writing is wrapped so a logging failure can never cost an answer.
 *
 * No message text and no credentials are stored: an intent, some counters and
 * timings are enough to run the feature on, and keeping the content out means this
 * table is safe to query freely.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ai_request_logs')) {
            return;
        }

        Schema::create('ai_request_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('chat_id')->nullable();

            $table->string('route_used', 20);              // chat | stream | action | regenerate
            $table->string('intent', 40)->nullable();
            $table->decimal('intent_confidence', 4, 2)->nullable();
            $table->decimal('answer_confidence', 4, 2)->nullable();
            $table->string('confidence_level', 10)->nullable();

            $table->json('tools_called')->nullable();
            $table->unsignedSmallInteger('dropped_ids')->default(0);
            $table->boolean('validation_failed')->default(false);
            $table->boolean('fallback_used')->default(false);
            $table->string('fallback_reason', 40)->nullable();
            $table->boolean('was_cached')->default(false);

            $table->unsignedInteger('response_time_ms')->nullable();
            $table->unsignedInteger('time_to_first_token_ms')->nullable();

            $table->string('action_name', 40)->nullable();
            $table->string('action_result', 20)->nullable();   // success | error
            $table->string('feedback_reason', 40)->nullable();
            $table->string('provider_error_type', 60)->nullable();
            $table->string('prompt_version', 40)->nullable();

            $table->timestamps();

            $table->index(['created_at', 'intent']);
            $table->index(['created_at', 'fallback_used']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_request_logs');
    }
};
