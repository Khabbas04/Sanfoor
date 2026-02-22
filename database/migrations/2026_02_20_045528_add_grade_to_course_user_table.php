<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            // إضافة حقل العلامة من نوع decimal ليقبل أرقام مثل 95.5
            $table->decimal('grade', 5, 2)->nullable()->after('course_id');
        });
    }

    public function down(): void
    {
        Schema::table('course_user', function (Blueprint $table) {
            $table->dropColumn('grade');
        });
    }
};