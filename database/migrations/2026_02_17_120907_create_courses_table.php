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
        Schema::create('courses', function (Blueprint $table) {
            $table->id();
            
            // --- بيانات المادة الأساسية ---
            $table->string('name');              // اسم المادة (مثال: برمجة 1)
            $table->string('code')->unique();    // رمز المادة (مثال: 0306101) - unique لمنع التكرار
            $table->integer('credit_hours');     // عدد الساعات المعتمدة
            
            // --- بيانات الخطة الشجرية ---
            $table->string('type')->default('compulsory'); // نوع المادة (إجباري، اختياري..) عشان نلون المربع في الشجرة
            $table->integer('semester')->nullable();       // رقم الفصل المقترح (1، 2، 3..) لترتيب المادة في المستوى الصحيح
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('courses');
    }
};