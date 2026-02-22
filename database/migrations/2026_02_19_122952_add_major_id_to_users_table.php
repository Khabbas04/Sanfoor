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
            // إضافة العمود وربطه بجدول التخصصات (majors)
            // nullable() تعني أنه ليس إجبارياً لكل المستخدمين (مثل الأدمن)
            // constrained() تقوم بعمل الربط التلقائي (Foreign Key)
            $table->foreignId('major_id')->nullable()->after('email')->constrained('majors')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // حذف الربط أولاً ثم حذف العمود عند التراجع عن التهجير
            $table->dropForeign(['major_id']);
            $table->dropColumn('major_id');
        });
    }
};