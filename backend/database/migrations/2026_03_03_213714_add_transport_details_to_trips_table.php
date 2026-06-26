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
            // Drop common single columns and replace with plural JSON column
            $table->json('transport_details')->nullable()->after('use_flight');

            $table->dropColumn([
                'transport_type',
                'flight_date',
                'airline',
                'flight_number',
                'departure_time',
                'arrival_time',
                'departure_location',
                'arrival_location',
                'pnr_number',
                'departure_date_time',
                'arrival_date_time',
                'traveler_names'
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn('transport_details');

            $table->string('transport_type')->nullable()->after('use_flight');
            $table->date('flight_date')->nullable();
            $table->string('airline')->nullable();
            $table->string('flight_number')->nullable();
            $table->string('departure_time')->nullable();
            $table->string('arrival_time')->nullable();
            $table->string('departure_location')->nullable();
            $table->string('arrival_location')->nullable();
            $table->string('pnr_number')->nullable();
            $table->datetime('departure_date_time')->nullable();
            $table->datetime('arrival_date_time')->nullable();
            $table->json('traveler_names')->nullable();
        });
    }
};
