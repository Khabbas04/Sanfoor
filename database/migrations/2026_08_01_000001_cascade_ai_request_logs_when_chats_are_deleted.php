<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ai_request_logs') || !Schema::hasTable('chats')) {
            return;
        }

        // Clean the rows created before chat_id had referential integrity. These
        // are exactly the deleted conversations that used to remain in metrics.
        DB::table('ai_request_logs')
            ->whereNotNull('chat_id')
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('chats')
                    ->whereColumn('chats.id', 'ai_request_logs.chat_id');
            })
            ->delete();

        Schema::table('ai_request_logs', function (Blueprint $table) {
            $table->foreign('chat_id')
                ->references('id')
                ->on('chats')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('ai_request_logs')) {
            return;
        }

        Schema::table('ai_request_logs', function (Blueprint $table) {
            $table->dropForeign(['chat_id']);
        });
    }
};
