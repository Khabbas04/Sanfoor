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
    Schema::table('users', function (Blueprint $table) {
        // إضافة حقل الـ IP و حقل آخر تسجيل دخول
        $table->string('ip_address', 45)->nullable();
        $table->timestamp('last_login_at')->nullable();
    });
}

public function down()
{
    Schema::table('users', function (Blueprint $table) {
        $table->dropColumn(['ip_address', 'last_login_at']);
    });
}
};
