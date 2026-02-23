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
    // نتحقق إذا كان العمود غير موجود قبل محاولة إضافته
    if (!Schema::hasColumn('user_carts', 'course_id')) {
        Schema::table('user_carts', function (Blueprint $table) {
            $table->foreignId('course_id')->after('user_id')->constrained()->onDelete('cascade');
        });
    }
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_carts', function (Blueprint $table) {
            // فك الارتباط (Foreign Key) أولاً وهو سر حل مشكلة الـ FAIL في PostgreSQL
            if (Schema::hasColumn('user_carts', 'course_id')) {
                $table->dropForeign(['course_id']); 
                $table->dropColumn('course_id');
            }
        });
    }
};