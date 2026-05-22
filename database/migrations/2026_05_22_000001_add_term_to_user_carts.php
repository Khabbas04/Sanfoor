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
            if (!Schema::hasColumn('user_carts', 'target_year')) {
                $table->unsignedTinyInteger('target_year')->nullable()->after('course_id');
            }
            if (!Schema::hasColumn('user_carts', 'target_term')) {
                $table->unsignedTinyInteger('target_term')->nullable()->after('target_year');
            }
            if (!Schema::hasColumn('user_carts', 'is_summer')) {
                $table->boolean('is_summer')->default(false)->after('target_term');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_carts', function (Blueprint $table) {
            if (Schema::hasColumn('user_carts', 'is_summer')) {
                $table->dropColumn('is_summer');
            }
            if (Schema::hasColumn('user_carts', 'target_term')) {
                $table->dropColumn('target_term');
            }
            if (Schema::hasColumn('user_carts', 'target_year')) {
                $table->dropColumn('target_year');
            }
        });
    }
};
