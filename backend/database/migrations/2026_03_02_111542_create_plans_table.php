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
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // e.g., 'monthly', 'yearly'
            $table->string('name');
            $table->decimal('price', 10, 2);
            $table->integer('duration_months');
            $table->integer('trip_limit')->nullable(); // null = unlimited
            $table->json('features')->nullable(); // JSON array of features
            $table->string('badge_label')->nullable(); // e.g., 'BEST VALUE'
            $table->boolean('recommended')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
