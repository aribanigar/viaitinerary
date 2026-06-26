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
        Schema::table('accommodations', function (Blueprint $table) {
            if (!Schema::hasColumn('accommodations', 'extra_beds_5_to_12_count')) {
                $table->string('extra_beds_5_to_12_count')->nullable()->after('cnb_count');
            }

            if (!Schema::hasColumn('accommodations', 'extra_beds_above_12_count')) {
                $table->string('extra_beds_above_12_count')->nullable()->after('extra_beds_5_to_12_count');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('accommodations', function (Blueprint $table) {
            $columnsToDrop = [];

            if (Schema::hasColumn('accommodations', 'extra_beds_5_to_12_count')) {
                $columnsToDrop[] = 'extra_beds_5_to_12_count';
            }

            if (Schema::hasColumn('accommodations', 'extra_beds_above_12_count')) {
                $columnsToDrop[] = 'extra_beds_above_12_count';
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
