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
        // Drop pax column from trips table
        if (Schema::hasColumn('trips', 'pax')) {
            Schema::table('trips', function (Blueprint $table) {
                $table->dropColumn('pax');
            });
        }

        // Drop pax column from trip_inquiries table
        if (Schema::hasColumn('trip_inquiries', 'pax')) {
            Schema::table('trip_inquiries', function (Blueprint $table) {
                $table->dropColumn('pax');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Add pax column back to trips table
        Schema::table('trips', function (Blueprint $table) {
            $table->string('pax')->nullable()->after('client_email');
        });

        // Add pax column back to trip_inquiries table
        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->string('pax')->nullable()->after('destination');
        });
    }
};
