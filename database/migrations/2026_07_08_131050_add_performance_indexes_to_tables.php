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
        Schema::table('course_prerequisites', function (Blueprint $table) {
            $table->index(['course_id', 'prerequisite_id']);
        });

        Schema::table('user_carts', function (Blueprint $table) {
            $table->index(['academic_year', 'academic_term']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            //
        });
    }
};
