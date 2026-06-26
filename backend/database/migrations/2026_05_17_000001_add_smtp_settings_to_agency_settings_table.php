<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agency_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('agency_settings', 'smtp_email')) {
                $table->string('smtp_email')->nullable()->after('contact_email');
            }

            if (!Schema::hasColumn('agency_settings', 'smtp_app_password')) {
                $table->text('smtp_app_password')->nullable()->after('smtp_email');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agency_settings', function (Blueprint $table) {
            if (Schema::hasColumn('agency_settings', 'smtp_app_password')) {
                $table->dropColumn('smtp_app_password');
            }

            if (Schema::hasColumn('agency_settings', 'smtp_email')) {
                $table->dropColumn('smtp_email');
            }
        });
    }
};
