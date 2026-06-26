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
        Schema::create('trips', function (Blueprint $table) {
            $table->id();
            $table->string('trip_id')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('trip_title');
            $table->string('client_name')->nullable();
            $table->string('destination')->nullable();
            $table->string('pax')->nullable();
            $table->date('start_date')->nullable();
            $table->string('duration')->nullable();
            $table->decimal('cost', 10, 2)->nullable();
            $table->string('currency')->default('INR (Rs)');
            $table->string('image_path')->nullable();
            $table->string('status')->default('Draft');
            $table->string('slug')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trips');
    }
};
