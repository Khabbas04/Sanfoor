<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Normalize all existing role values to lowercase (Owner -> owner, ADMIN -> admin, etc.)
        DB::statement("UPDATE users SET role = LOWER(role) WHERE role IS NOT NULL");

        // Any unexpected role value will be treated as student to keep auth logic safe.
        DB::table('users')
            ->whereNull('role')
            ->orWhereNotIn('role', ['student', 'admin', 'owner'])
            ->update(['role' => 'student']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No destructive rollback for role normalization.
    }
};
