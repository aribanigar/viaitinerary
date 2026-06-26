<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Nullable first so existing rows are not immediately rejected
            $table->uuid('embed_token')->nullable()->unique()->after('id');
        });

        // Backfill a unique UUID for every existing user
        DB::table('users')->orderBy('id')->chunk(100, function ($users) {
            foreach ($users as $user) {
                DB::table('users')->where('id', $user->id)->update([
                    'embed_token' => (string) Str::uuid(),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('embed_token');
        });
    }
};
