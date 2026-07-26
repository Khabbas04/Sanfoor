<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rolling conversation memory for the AI advisor.
 *
 * Long chats used to be replayed to Gemini message-by-message (16 turns x 1800
 * chars), which ate the context window next to the already large system prompt.
 * Instead we keep a short rolling summary of everything older than the last few
 * turns: `context_summary` holds the text, `summary_upto_message_id` marks how far
 * it covers so newer turns are still sent verbatim.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chats', function (Blueprint $table) {
            $table->text('context_summary')->nullable()->after('title');
            $table->unsignedBigInteger('summary_upto_message_id')->nullable()->after('context_summary');
            $table->timestamp('summary_updated_at')->nullable()->after('summary_upto_message_id');
        });
    }

    public function down(): void
    {
        Schema::table('chats', function (Blueprint $table) {
            $table->dropColumn(['context_summary', 'summary_upto_message_id', 'summary_updated_at']);
        });
    }
};
