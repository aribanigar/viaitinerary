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
        // Change from enum TO string first to bypass immediate validation
        Schema::table('trips', function (Blueprint $table) {
            $table->string('status')->change();
        });

        // Update values
        DB::table('trips')->where('status', 'approved')->update(['status' => 'confirmed']);

        // Change back to enum with new values
        Schema::table('trips', function (Blueprint $table) {
            $table->enum('status', ['pending', 'rejected', 'confirmed', 'completed', 'Draft'])->default('pending')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('trips')->where('status', 'confirmed')->update(['status' => 'approved']);

        Schema::table('trips', function (Blueprint $table) {
            $table->enum('status', ['pending', 'rejected', 'approved', 'completed', 'Draft'])->default('pending')->change();
        });
    }
};
