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
            $table->integer('kids_upto_5')->default(0)->after('kids');
            $table->integer('kids_5_to_12')->default(0)->after('kids_upto_5');
        });

        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->integer('kids_upto_5')->default(0)->after('kids');
            $table->integer('kids_5_to_12')->default(0)->after('kids_upto_5');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn(['kids_upto_5', 'kids_5_to_12']);
        });

        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->dropColumn(['kids_upto_5', 'kids_5_to_12']);
        });
    }
};
