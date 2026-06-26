<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('trips')
            ->where('status', 'approved')
            ->update(['status' => 'confirmed']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('trips')
            ->where('status', 'confirmed')
            ->update(['status' => 'approved']);
    }
};
