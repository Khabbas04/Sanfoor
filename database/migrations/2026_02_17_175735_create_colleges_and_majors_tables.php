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
        // 1. إنشاء جدول الكليات
        Schema::create('colleges', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // مثال: كلية تكنولوجيا المعلومات
            $table->timestamps();
        });

        // 2. إنشاء جدول التخصصات
        Schema::create('majors', function (Blueprint $table) {
            $table->id();
            // ربط التخصص بالكلية
            $table->foreignId('college_id')->constrained('colleges')->onDelete('cascade');
            $table->string('name'); // مثال: علم الحاسوب
            $table->string('code')->unique(); // مثال: CS
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('majors');
        Schema::dropIfExists('colleges');
    }
};