<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('courses', function (Blueprint $table) {
            // إضافة العمود مع التحقق لضمان عدم التكرار في حال شغلت الميجريشن مرتين
            if (!Schema::hasColumn('courses', 'major_id')) {
                $table->foreignId('major_id')->nullable()->constrained()->onDelete('cascade');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            // 🔥 أهم خطوة: فك الارتباط أولاً عشان الداتا بيس تسمح بالحذف أو التعديل
            $table->dropForeign(['major_id']);
            $table->dropColumn('major_id');
        });
    }
};