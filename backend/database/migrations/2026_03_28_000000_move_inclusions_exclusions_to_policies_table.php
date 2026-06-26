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
        // Add new columns to policies table
        Schema::table('policies', function (Blueprint $table) {
            $table->text('default_inclusions')->nullable();
            $table->text('default_exclusions')->nullable();
        });

        // Drop the inclusion_exclusions table if it exists
        Schema::dropIfExists('inclusion_exclusions');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('inclusion_exclusions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('type', ['inclusion', 'exclusion']);
            $table->text('content');
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            
            $table->index(['user_id', 'type']);
        });

        Schema::table('policies', function (Blueprint $table) {
            $table->dropColumn(['default_inclusions', 'default_exclusions']);
        });
    }
};
