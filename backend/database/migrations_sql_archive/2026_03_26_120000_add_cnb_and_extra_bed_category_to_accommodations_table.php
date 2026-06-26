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
            if (!Schema::hasColumn('accommodations', 'cnb_count')) {
                $table->string('cnb_count')->nullable()->after('beds');
            }

            if (!Schema::hasColumn('accommodations', 'extra_bed_category')) {
                $table->string('extra_bed_category')->nullable()->after('cnb_count');
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

            if (Schema::hasColumn('accommodations', 'cnb_count')) {
                $columnsToDrop[] = 'cnb_count';
            }

            if (Schema::hasColumn('accommodations', 'extra_bed_category')) {
                $columnsToDrop[] = 'extra_bed_category';
            }

            if (!empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
