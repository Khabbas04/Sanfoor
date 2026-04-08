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
        $afterColumn = Schema::hasColumn('course_user', 'studied_semester')
            ? 'studied_semester'
            : 'course_id';

        Schema::table('course_user', function (Blueprint $table) use ($afterColumn) {
            if (!Schema::hasColumn('course_user', 'studied_year')) {
                $table->unsignedTinyInteger('studied_year')->nullable()->after($afterColumn);
            }

            if (!Schema::hasColumn('course_user', 'studied_term')) {
                $table->unsignedTinyInteger('studied_term')->nullable()->after('studied_year');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            if (Schema::hasColumn('course_user', 'studied_term')) {
                $table->dropColumn('studied_term');
            }

            if (Schema::hasColumn('course_user', 'studied_year')) {
                $table->dropColumn('studied_year');
            }
        });
    }
};
