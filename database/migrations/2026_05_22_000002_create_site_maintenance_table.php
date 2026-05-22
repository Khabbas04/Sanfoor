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
        Schema::create('site_maintenance', function (Blueprint $table) {
            $table->id();
            $table->boolean('is_enabled')->default(false)->index();
            $table->string('title')->default('الموقع تحت الصيانة');
            $table->text('message')->nullable();
            $table->unsignedSmallInteger('expected_minutes')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('site_maintenance');
    }
};