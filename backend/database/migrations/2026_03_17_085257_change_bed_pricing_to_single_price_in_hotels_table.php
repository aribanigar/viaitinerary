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
            $table->decimal('extra_bed_price', 10, 2)->nullable()->after('standard_price');
            // We'll keep bed_pricing for now and drop it in down() or just leave it until we are sure
            // But user said "store only the numbers", so we should ideally drop it.
        });

        // Optional: migrate data if possible, but bed_pricing was a JSON array like [{beds: 1, price: 100}, ...]
        // Since the scenario changed to only ONE price, we could take the first one.
        \DB::table('hotels')->get()->each(function ($hotel) {
            $pricing = json_decode($hotel->bed_pricing, true);
            if (is_array($pricing) && count($pricing) > 0) {
                \DB::table('hotels')->where('id', $hotel->id)->update([
                    'extra_bed_price' => $pricing[0]['price'] ?? null
                ]);
            }
        });

        Schema::table('hotels', function (Blueprint $table) {
            $table->dropColumn('bed_pricing');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotels', function (Blueprint $table) {
            $table->json('bed_pricing')->nullable()->after('standard_price');
            $table->dropColumn('extra_bed_price');
        });
    }
};
