<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('trips')->update([
            'kids_upto_5' => DB::raw('kids'),
        ]);

        DB::table('trip_inquiries')->update([
            'kids_upto_5' => DB::raw('kids'),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op – ideally we'd preserve existing kids_upto_5 data but reversing this 
        // doesn't mean moving it back necessarily as 'kids' column still exists.
    }
};
