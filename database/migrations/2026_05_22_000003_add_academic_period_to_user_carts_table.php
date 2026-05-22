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
        Schema::table('user_carts', function (Blueprint $table) {
            if (!Schema::hasColumn('user_carts', 'academic_year')) {
                $table->string('academic_year', 20)->nullable()->after('course_id');
            }
            if (!Schema::hasColumn('user_carts', 'academic_term')) {
                $table->unsignedTinyInteger('academic_term')->nullable()->after('academic_year');
            }
            if (Schema::hasColumn('user_carts', 'academic_year') && Schema::hasColumn('user_carts', 'academic_term')) {
                $table->index(['academic_year', 'academic_term'], 'user_carts_academic_period_idx');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_carts', function (Blueprint $table) {
            if (Schema::hasColumn('user_carts', 'academic_term')) {
                $table->dropIndex('user_carts_academic_period_idx');
                $table->dropColumn('academic_term');
            }
            if (Schema::hasColumn('user_carts', 'academic_year')) {
                $table->dropColumn('academic_year');
            }
        });
    }
};