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
        // إذا كان الجدول موجوداً، سنقوم بتعديله، وإذا لم يكن سننشئه
        if (!Schema::hasTable('user_carts')) {
            Schema::create('user_carts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->onDelete('cascade');
                $table->foreignId('course_id')->constrained()->onDelete('cascade'); // ربط المادة بالمحاكي
                $table->timestamps();

                // 🔥 منع إضافة نفس المادة للمحاكي أكثر من مرة لنفس الطالب
                $table->unique(['user_id', 'course_id']);
            });
        } else {
            // إذا الجدول موجود عندك، بس بنضيف عليه الأعمدة الناقصة
            Schema::table('user_carts', function (Blueprint $table) {
                if (!Schema::hasColumn('user_carts', 'course_id')) {
                    $table->foreignId('course_id')->after('user_id')->constrained()->onDelete('cascade');
                    $table->unique(['user_id', 'course_id']);
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_carts');
    }
};