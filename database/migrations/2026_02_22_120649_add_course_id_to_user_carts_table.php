<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
public function up(): void
{
    Schema::table('user_carts', function (Blueprint $table) {
        // ضفنا nullable() عشان لارافيل ما يزعل من الصفوف القديمة
        $table->foreignId('course_id')->nullable()->after('user_id')->constrained()->onDelete('cascade');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_carts', function (Blueprint $table) {
            //
        });
    }
};
