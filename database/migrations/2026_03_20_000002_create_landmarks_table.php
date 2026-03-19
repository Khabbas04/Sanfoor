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
        Schema::create('landmarks', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // مثال: مطعم القصر، المصلى الرئيسي
            $table->text('description')->nullable();
            $table->string('type'); // restaurant, prayer_room, library, clinic, etc.
            $table->string('building_location')->nullable(); // مثال: مبنى أ، الطابق الثاني
            $table->string('location_latitude')->nullable();
            $table->string('location_longitude')->nullable();
            $table->string('maps_url')->nullable();
            $table->string('image_url')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('type');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('landmarks');
    }
};
