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
        Schema::table('trips', function (Blueprint $table) {
            $table->boolean('use_flight')->default(false);
            $table->string('flight_name')->nullable();
            $table->date('flight_date')->nullable();
            $table->string('airline')->nullable();
            $table->string('flight_number')->nullable();
            $table->string('departure_time')->nullable();
            $table->string('arrival_time')->nullable();
            $table->string('pnr_number')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn([
                'use_flight',
                'flight_name',
                'flight_date',
                'airline',
                'flight_number',
                'departure_time',
                'arrival_time',
                'pnr_number',
            ]);
        });
    }
};
