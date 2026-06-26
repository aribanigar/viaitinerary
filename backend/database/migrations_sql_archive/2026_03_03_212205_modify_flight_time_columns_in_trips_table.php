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
        // First, nullify values that aren't valid datetimes to allow migration
        DB::table('trips')->whereRaw('LENGTH(departure_time) < 10')->update(['departure_time' => null]);
        DB::table('trips')->whereRaw('LENGTH(arrival_time) < 10')->update(['arrival_time' => null]);

        Schema::table('trips', function (Blueprint $table) {
            $table->dateTime('departure_time')->nullable()->change();
            $table->dateTime('arrival_time')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->string('departure_time')->nullable()->change();
            $table->string('arrival_time')->nullable()->change();
        });
    }
};
