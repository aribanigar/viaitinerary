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
        Schema::table('agency_settings', function (Blueprint $table) {
            $table->decimal('gst_amount', 10, 2)->default(0.00);
            $table->decimal('profit_margin_percentage', 5, 2)->default(0.00);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('agency_settings', function (Blueprint $table) {
            $table->dropColumn(['gst_percentage', 'profit_margin_percentage']);
        });
    }
};
