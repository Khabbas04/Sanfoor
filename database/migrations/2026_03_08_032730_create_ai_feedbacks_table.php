<?php

// ==========================================
// 📌 Migration: جدول تقييمات ردود AI
// ==========================================
// شغّل: php artisan make:migration create_ai_feedbacks_table
// ثم انسخ المحتوى هذا جوا

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('message_id')->constrained()->onDelete('cascade');
            $table->enum('rating', ['up', 'down']);
            $table->text('comment')->nullable();
            $table->timestamps();

            // كل طالب يقدر يقيّم كل رسالة مرة وحدة
            $table->unique(['user_id', 'message_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_feedbacks');
    }
};