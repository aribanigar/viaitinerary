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
        Schema::table('hotels', function (Blueprint $table) {
            $table->dropColumn([
                'deluxe_extra_bed_price',
                'super_deluxe_extra_bed_price',
                'suite_extra_bed_price',
            ]);
        });

        Schema::table('trips', function (Blueprint $table) {
            $table->dropColumn('kids');
        });

        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->dropColumn('kids');
        });

        Schema::table('calculations', function (Blueprint $table) {
            $table->dropColumn('extra_bed_price');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotels', function (Blueprint $table) {
            $table->decimal('deluxe_extra_bed_price', 10, 2)->nullable();
            $table->decimal('super_deluxe_extra_bed_price', 10, 2)->nullable();
            $table->decimal('suite_extra_bed_price', 10, 2)->nullable();
        });

        Schema::table('trips', function (Blueprint $table) {
            $table->integer('kids')->default(0);
        });

        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->integer('kids')->default(0);
        });

        Schema::table('calculations', function (Blueprint $table) {
            $table->decimal('extra_bed_price', 10, 2)->nullable();
        });
    }
};
