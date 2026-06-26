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
        Schema::create('accommodations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trip_id')->constrained('trips')->cascadeOnDelete();
            $table->string('name');
            $table->string('city')->nullable();
            $table->string('category')->nullable();
            $table->string('rooms')->nullable();
            $table->string('meal_plan')->nullable();
            $table->date('check_in')->nullable();
            $table->date('check_out')->nullable();
            $table->string('image_path')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accommodations');
    }
};
