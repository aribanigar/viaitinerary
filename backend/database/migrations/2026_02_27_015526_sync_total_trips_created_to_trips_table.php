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
        // No-op: trips_used is seeded during initializeTrial(); no data-copy needed.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
