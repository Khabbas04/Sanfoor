<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    // قم بإنشاء Migration جديدة: php artisan make:migration add_details_to_courses_table
public function up()
{
    Schema::table('courses', function (Blueprint $table) {
        // المتطلب السابق (يربط المادة بمادة أخرى)
        $table->unsignedBigInteger('prerequisite_id')->nullable()->after('id');
        $table->foreign('prerequisite_id')->references('id')->on('courses')->onDelete('set null');
        
        // المهارات المكتسبة من المادة (مثلاً: SQL, Problem Solving)
        $table->text('skills')->nullable()->after('description');
        
        // درجة الصعوبة (من 1 لـ 5) لمساعدة الـ AI في موازنة الجدول
        $table->integer('difficulty_level')->default(3)->after('credit_hours');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            //
        });
    }
};
