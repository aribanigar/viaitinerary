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
            $table->foreignId('destination_id')->nullable()->after('destination')->constrained('destinations')->nullOnDelete();
        });

        Schema::table('accommodations', function (Blueprint $table) {
            $table->foreignId('hotel_id')->nullable()->after('trip_id')->constrained('hotels')->nullOnDelete();
        });

        Schema::table('transportations', function (Blueprint $table) {
            $table->foreignId('vehicle_id')->nullable()->after('trip_id')->constrained('vehicles')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropConstrainedForeignId('destination_id');
        });

        Schema::table('accommodations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('hotel_id');
        });

        Schema::table('transportations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('vehicle_id');
        });
    }
};
