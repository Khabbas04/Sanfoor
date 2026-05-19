<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * تعديل قيد الفريد في جدول course_user
     * - حذف القيد القديم (user_id, course_id)
     * - إضافة القيد الجديد (user_id, course_id, attempt_number) للسماح بمحاولات متعددة للمادة الواحدة
     */
    public function up(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            // حذف القيد القديم
            $table->dropUnique('course_user_user_course_unique');

            // إضافة القيد الجديد المشترك مع رقم المحاولة
            $table->unique(['user_id', 'course_id', 'attempt_number'], 'course_user_user_course_attempt_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            $table->dropUnique('course_user_user_course_attempt_unique');
            $table->unique(['user_id', 'course_id'], 'course_user_user_course_unique');
        });
    }
};
