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
        Schema::table('admin_logs', function (Blueprint $table) {
            $table->boolean('owner_only')->default(false)->after('ip_address');
            $table->json('meta')->nullable()->after('owner_only');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('admin_logs', function (Blueprint $table) {
            $table->dropColumn(['owner_only', 'meta']);
        });
    }
};
