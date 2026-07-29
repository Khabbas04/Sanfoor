<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per Gemini API call, per key, per model.
 *
 * Until now the monitoring page was built entirely from short-lived cache
 * counters: it could show "requests today" but not tokens, not latency, not which
 * model a key was spending its quota on, and nothing at all about yesterday. This
 * table is the record those questions need.
 *
 * The API key itself is NEVER stored. `api_key_id` is its 1-based position in the
 * configured list (what the UI calls "Key #3") and `key_fingerprint` is a short
 * hash, so history survives the list being reordered while the secret never
 * touches the database.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('api_key_usage_logs')) {
            return;
        }

        Schema::create('api_key_usage_logs', function (Blueprint $table) {
            $table->id();

            $table->unsignedTinyInteger('api_key_id');          // 1-based position
            $table->string('key_fingerprint', 16)->index();     // stable across reordering
            $table->string('model', 60);

            // chat | stream | embed | title | schedule | plan | analysis | classify
            $table->string('request_type', 20);

            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->unsignedInteger('total_tokens')->default(0);

            // Counter snapshots at the moment of the call, so a spike can be read
            // back later instead of only being visible live.
            $table->unsignedSmallInteger('rpm')->default(0);
            $table->unsignedInteger('tpm')->default(0);
            $table->unsignedInteger('rpd')->default(0);

            $table->unsignedInteger('latency_ms')->default(0);
            $table->boolean('success')->default(true);
            // Sanitised before it gets here: never a URL, never a key.
            $table->string('error_message', 255)->nullable();
            $table->string('error_type', 40)->nullable();

            $table->timestamps();

            // The dashboard's three access patterns: by day, by model, by key.
            $table->index(['created_at', 'model']);
            $table->index(['created_at', 'api_key_id']);
            $table->index(['created_at', 'success']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_key_usage_logs');
    }
};
