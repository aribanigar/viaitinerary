<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agency_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('agency_settings', 'smtp_host')) {
                $table->string('smtp_host')->nullable()->after('smtp_email');
            }

            if (!Schema::hasColumn('agency_settings', 'smtp_port')) {
                $table->unsignedSmallInteger('smtp_port')->nullable()->after('smtp_host');
            }

            if (!Schema::hasColumn('agency_settings', 'smtp_encryption')) {
                $table->string('smtp_encryption', 10)->nullable()->after('smtp_port');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agency_settings', function (Blueprint $table) {
            if (Schema::hasColumn('agency_settings', 'smtp_encryption')) {
                $table->dropColumn('smtp_encryption');
            }

            if (Schema::hasColumn('agency_settings', 'smtp_port')) {
                $table->dropColumn('smtp_port');
            }

            if (Schema::hasColumn('agency_settings', 'smtp_host')) {
                $table->dropColumn('smtp_host');
            }
        });
    }
};
