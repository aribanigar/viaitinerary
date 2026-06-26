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
        if (!Schema::hasColumn('agency_settings', 'company_address')) {
            Schema::table('agency_settings', function (Blueprint $table) {
                $table->text('company_address')->nullable()->after('website');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('agency_settings', 'company_address')) {
            Schema::table('agency_settings', function (Blueprint $table) {
                $table->dropColumn('company_address');
            });
        }
    }
};
