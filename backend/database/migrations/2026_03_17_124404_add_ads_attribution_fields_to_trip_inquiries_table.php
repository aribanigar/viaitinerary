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
        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->string('external_id')->nullable()->after('inquiry_id');
            $table->string('utm_source')->nullable()->after('source_url');
            $table->string('utm_medium')->nullable()->after('utm_source');
            $table->string('utm_campaign')->nullable()->after('utm_medium');
            $table->string('gclid')->nullable()->after('utm_campaign');
            $table->string('fb_lead_id')->nullable()->after('gclid');
        });
    }

    public function down(): void
    {
        Schema::table('trip_inquiries', function (Blueprint $table) {
            $table->dropColumn(['external_id', 'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fb_lead_id']);
        });
    }
};
