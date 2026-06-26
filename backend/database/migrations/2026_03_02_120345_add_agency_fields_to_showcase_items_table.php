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
        Schema::table('showcase_items', function (Blueprint $table) {
            $table->string('agency_name')->nullable()->after('title');
            $table->string('whatsapp_number')->nullable()->after('agency_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('showcase_items', function (Blueprint $table) {
            $table->dropColumn(['agency_name', 'whatsapp_number']);
        });
    }
};
