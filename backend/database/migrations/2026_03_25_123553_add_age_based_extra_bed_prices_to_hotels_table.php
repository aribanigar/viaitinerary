<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('hotels', function (Blueprint $table) {
            // Deluxe
            $table->decimal('deluxe_extra_bed_price_upto_5', 10, 2)->nullable()->after('deluxe_extra_bed_price');
            $table->decimal('deluxe_extra_bed_price_5_to_12', 10, 2)->nullable()->after('deluxe_extra_bed_price_upto_5');
            $table->decimal('deluxe_extra_bed_price_above_12', 10, 2)->nullable()->after('deluxe_extra_bed_price_5_to_12');
            
            // Super Deluxe
            $table->decimal('super_deluxe_extra_bed_price_upto_5', 10, 2)->nullable()->after('super_deluxe_extra_bed_price');
            $table->decimal('super_deluxe_extra_bed_price_5_to_12', 10, 2)->nullable()->after('super_deluxe_extra_bed_price_upto_5');
            $table->decimal('super_deluxe_extra_bed_price_above_12', 10, 2)->nullable()->after('super_deluxe_extra_bed_price_5_to_12');
            
            // Suite
            $table->decimal('suite_extra_bed_price_upto_5', 10, 2)->nullable()->after('suite_extra_bed_price');
            $table->decimal('suite_extra_bed_price_5_to_12', 10, 2)->nullable()->after('suite_extra_bed_price_upto_5');
            $table->decimal('suite_extra_bed_price_above_12', 10, 2)->nullable()->after('suite_extra_bed_price_5_to_12');
        });

        // Copy existing data
        DB::table('hotels')->update([
            'deluxe_extra_bed_price_5_to_12' => DB::raw('deluxe_extra_bed_price'),
            'super_deluxe_extra_bed_price_5_to_12' => DB::raw('super_deluxe_extra_bed_price'),
            'suite_extra_bed_price_5_to_12' => DB::raw('suite_extra_bed_price'),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotels', function (Blueprint $table) {
            $table->dropColumn([
                'deluxe_extra_bed_price_upto_5',
                'deluxe_extra_bed_price_5_to_12',
                'deluxe_extra_bed_price_above_12',
                'super_deluxe_extra_bed_price_upto_5',
                'super_deluxe_extra_bed_price_5_to_12',
                'super_deluxe_extra_bed_price_above_12',
                'suite_extra_bed_price_upto_5',
                'suite_extra_bed_price_5_to_12',
                'suite_extra_bed_price_above_12',
            ]);
        });
    }
};
