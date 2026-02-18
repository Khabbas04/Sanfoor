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
        Schema::create('course_prerequisites', function (Blueprint $table) {
            $table->id();
            
            // العمود الأول: المادة (الابن) - التي يريد الطالب تسجيلها
            // constrained('courses'): يعني لازم تكون موجودة في جدول المواد
            // onDelete('cascade'): لو حذفنا المادة، تنحذف علاقتها تلقائياً
            $table->foreignId('course_id')->constrained('courses')->onDelete('cascade');
            
            // العمود الثاني: المتطلب (الأب) - المادة التي يجب أن ينجح فيها أولاً
            $table->foreignId('prerequisite_id')->constrained('courses')->onDelete('cascade');
            
            $table->timestamps();

            // (اختياري) منع التكرار: عشان ما نقدر نضيف نفس المتطلب لنفس المادة مرتين بالغلط
            $table->unique(['course_id', 'prerequisite_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('course_prerequisites');
    }
};