<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * إضافة حقول الإعادة: is_retake و attempt_number
     * - is_retake: هل هذا السجل إعادة لمادة سابقة؟
     * - attempt_number: رقم المحاولة (1 = أول مرة، 2 = أول إعادة ...)
     */
    public function up(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            if (!Schema::hasColumn('course_user', 'is_retake')) {
                $table->boolean('is_retake')->default(false)->after('studied_term');
            }

            if (!Schema::hasColumn('course_user', 'attempt_number')) {
                $table->unsignedTinyInteger('attempt_number')->default(1)->after('is_retake');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            if (Schema::hasColumn('course_user', 'attempt_number')) {
                $table->dropColumn('attempt_number');
            }

            if (Schema::hasColumn('course_user', 'is_retake')) {
                $table->dropColumn('is_retake');
            }
        });
    }
};
