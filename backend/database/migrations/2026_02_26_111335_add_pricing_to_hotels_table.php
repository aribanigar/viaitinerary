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
            $table->decimal('standard_price', 10, 2)->nullable()->after('city');
            $table->json('bed_pricing')->nullable()->after('standard_price'); // Store array of objects [{beds: 1, price: 100}, ...]
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hotels', function (Blueprint $table) {
            $table->dropColumn(['standard_price', 'bed_pricing']);
        });
    }
};
