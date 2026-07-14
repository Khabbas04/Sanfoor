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
        Schema::dropIfExists('demo_guests');
    }

    public function down(): void
    {
        Schema::create('demo_guests', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->unsignedBigInteger('college_id');
            $table->unsignedBigInteger('major_id');
            $table->string('study_plan_version', 10);
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });
    }
};
