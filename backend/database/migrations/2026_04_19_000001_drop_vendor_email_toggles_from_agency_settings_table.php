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
        $dropColumns = [];

        if (Schema::hasColumn('agency_settings', 'send_hotel_emails')) {
            $dropColumns[] = 'send_hotel_emails';
        }

        if (Schema::hasColumn('agency_settings', 'send_cab_emails')) {
            $dropColumns[] = 'send_cab_emails';
        }

        if (!empty($dropColumns)) {
            Schema::table('agency_settings', function (Blueprint $table) use ($dropColumns) {
                $table->dropColumn($dropColumns);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasColumn('agency_settings', 'send_hotel_emails')) {
            Schema::table('agency_settings', function (Blueprint $table) {
                $table->boolean('send_hotel_emails')->default(true)->after('confirmation_pdf_message');
            });
        }

        if (!Schema::hasColumn('agency_settings', 'send_cab_emails')) {
            Schema::table('agency_settings', function (Blueprint $table) {
                if (Schema::hasColumn('agency_settings', 'send_hotel_emails')) {
                    $table->boolean('send_cab_emails')->default(true)->after('send_hotel_emails');
                } else {
                    $table->boolean('send_cab_emails')->default(true)->after('confirmation_pdf_message');
                }
            });
        }
    }
};
