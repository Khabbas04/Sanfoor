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
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'portal_student_id')) {
                $table->string('portal_student_id')->nullable()->after('email');
            }

            if (!Schema::hasColumn('users', 'portal_major_name')) {
                $table->string('portal_major_name')->nullable()->after('major_id');
            }

            if (!Schema::hasColumn('users', 'portal_gpa')) {
                $table->decimal('portal_gpa', 5, 2)->nullable()->after('portal_major_name');
            }

            if (!Schema::hasColumn('users', 'portal_passed_hours')) {
                $table->unsignedSmallInteger('portal_passed_hours')->nullable()->after('portal_gpa');
            }

            if (!Schema::hasColumn('users', 'portal_synced_at')) {
                $table->timestamp('portal_synced_at')->nullable()->after('portal_passed_hours');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $columnsToDrop = [];

            foreach (['portal_student_id', 'portal_major_name', 'portal_gpa', 'portal_passed_hours', 'portal_synced_at'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $columnsToDrop[] = $column;
                }
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
