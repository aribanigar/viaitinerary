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
            $table->decimal('deluxe_price', 10, 2)->nullable()->after('city');
            $table->decimal('super_deluxe_price', 10, 2)->nullable()->after('deluxe_price');
            $table->decimal('suite_price', 10, 2)->nullable()->after('super_deluxe_price');

            $table->decimal('deluxe_extra_bed_price', 10, 2)->nullable()->after('suite_price');
            $table->decimal('super_deluxe_extra_bed_price', 10, 2)->nullable()->after('deluxe_extra_bed_price');
            $table->decimal('suite_extra_bed_price', 10, 2)->nullable()->after('super_deluxe_extra_bed_price');
        });

        // Migrate existing data: put standard_price into deluxe_price 
        // and extra_bed_price into deluxe_extra_bed_price
        \DB::table('hotels')->get()->each(function ($hotel) {
            \DB::table('hotels')->where('id', $hotel->id)->update([
                'deluxe_price' => $hotel->standard_price,
                'deluxe_extra_bed_price' => $hotel->extra_bed_price
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotels', function (Blueprint $table) {
            $table->dropColumn([
                'deluxe_price',
                'super_deluxe_price',
                'suite_price',
                'deluxe_extra_bed_price',
                'super_deluxe_extra_bed_price',
                'suite_extra_bed_price'
            ]);
        });
    }
};
