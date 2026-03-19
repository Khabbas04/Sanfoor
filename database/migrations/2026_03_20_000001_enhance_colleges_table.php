<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add detailed information columns to colleges table.
     */
    public function up(): void
    {
        Schema::table('colleges', function (Blueprint $table) {
            // Detailed college information
            $table->text('description')->nullable()->after('name');
            $table->string('building_symbol')->nullable()->after('description');
            $table->string('building_location')->nullable()->after('building_symbol');
            $table->text('services')->nullable()->after('building_location');
            $table->string('image_url')->nullable()->after('services');
            $table->string('location_latitude')->nullable()->after('image_url');
            $table->string('location_longitude')->nullable()->after('location_latitude');
            $table->string('maps_url')->nullable()->after('location_longitude');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('colleges', function (Blueprint $table) {
            $table->dropColumn([
                'description',
                'building_symbol',
                'building_location',
                'services',
                'image_url',
                'location_latitude',
                'location_longitude',
                'maps_url',
            ]);
        });
    }
};
