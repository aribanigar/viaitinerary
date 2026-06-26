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
            if (!Schema::hasColumn('hotels', 'price_sections')) {
                $table->json('price_sections')->nullable()->after('phone');
            }
        });

        // Migrate existing legacy data into price_sections JSON array
        $hotels = \Illuminate\Support\Facades\DB::table('hotels')->get();
        foreach ($hotels as $hotel) {
            $sections = [];

            if (isset($hotel->deluxe_price) || isset($hotel->deluxe_extra_bed_price_cnb) || isset($hotel->deluxe_extra_bed_price_5_to_12) || isset($hotel->deluxe_extra_bed_price_above_12)) {
                $sections[] = [
                    'room_type' => 'deluxe',
                    'meal_plan' => 'room_only',
                    'price' => (float)($hotel->deluxe_price ?? 0),
                    'cnb' => (float)($hotel->deluxe_extra_bed_price_cnb ?? 0),
                    'upto_5' => (float)($hotel->deluxe_extra_bed_price_5_to_12 ?? 0),
                    'above_12' => (float)($hotel->deluxe_extra_bed_price_above_12 ?? 0),
                ];
            }

            if (isset($hotel->super_deluxe_price) || isset($hotel->super_deluxe_extra_bed_price_cnb) || isset($hotel->super_deluxe_extra_bed_price_5_to_12) || isset($hotel->super_deluxe_extra_bed_price_above_12)) {
                $sections[] = [
                    'room_type' => 'super_deluxe',
                    'meal_plan' => 'room_only',
                    'price' => (float)($hotel->super_deluxe_price ?? 0),
                    'cnb' => (float)($hotel->super_deluxe_extra_bed_price_cnb ?? 0),
                    'upto_5' => (float)($hotel->super_deluxe_extra_bed_price_5_to_12 ?? 0),
                    'above_12' => (float)($hotel->super_deluxe_extra_bed_price_above_12 ?? 0),
                ];
            }

            if (isset($hotel->suite_price) || isset($hotel->suite_extra_bed_price_cnb) || isset($hotel->suite_extra_bed_price_5_to_12) || isset($hotel->suite_extra_bed_price_above_12)) {
                $sections[] = [
                    'room_type' => 'suite',
                    'meal_plan' => 'room_only',
                    'price' => (float)($hotel->suite_price ?? 0),
                    'cnb' => (float)($hotel->suite_extra_bed_price_cnb ?? 0),
                    'upto_5' => (float)($hotel->suite_extra_bed_price_5_to_12 ?? 0),
                    'above_12' => (float)($hotel->suite_extra_bed_price_above_12 ?? 0),
                ];
            }

            if (!empty($sections)) {
                \Illuminate\Support\Facades\DB::table('hotels')
                    ->where('id', $hotel->id)
                    ->update(['price_sections' => json_encode($sections)]);
            }
        }
        
        // Note: Legacy columns are currently kept intact until verified.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotels', function (Blueprint $table) {
            if (Schema::hasColumn('hotels', 'price_sections')) {
                $table->dropColumn('price_sections');
            }
            
            // Re-adding columns is strictly not necessary here if they weren't dropped in up(), 
            // but we kept them intact anyway so no need to drop again.
        });
    }
};
