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
            // Add new datetime fields
            $table->dateTime('departure_date_time')->nullable()->after('use_flight');
            $table->dateTime('arrival_date_time')->nullable()->after('departure_date_time');

            // Keep old fields for backward compatibility (can be removed later if needed)
            // If you want to remove old fields, uncomment the following lines:
            // $table->dropColumn(['flight_date', 'departure_time', 'arrival_time']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn(['departure_date_time', 'arrival_date_time']);

            // If you dropped the old fields in up(), restore them here:
            // $table->date('flight_date')->nullable();
            // $table->string('departure_time')->nullable();
            // $table->string('arrival_time')->nullable();
        });
    }
};
