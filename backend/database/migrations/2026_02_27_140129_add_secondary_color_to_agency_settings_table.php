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
            $table->string('secondary_color')->default('#0D2D2D');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('agency_settings', function (Blueprint $table) {
            $table->dropColumn('secondary_color');
        });
    }
};
