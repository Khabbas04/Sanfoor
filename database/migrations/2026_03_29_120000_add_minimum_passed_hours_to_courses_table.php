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
        Schema::table('courses', function (Blueprint $table) {
            if (!Schema::hasColumn('courses', 'minimum_passed_hours')) {
                $table->unsignedSmallInteger('minimum_passed_hours')
                    ->nullable()
                    ->after('credit_hours');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            if (Schema::hasColumn('courses', 'minimum_passed_hours')) {
                $table->dropColumn('minimum_passed_hours');
            }
        });
    }
};
