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
        Schema::table('calculations', function (Blueprint $table) {
            $table->integer('number_of_people')->nullable()->after('client_name');
            $table->string('destination')->nullable()->after('number_of_people');
            $table->decimal('price_per_ticket', 10, 2)->nullable()->after('destination');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('calculations', function (Blueprint $table) {
            $table->dropColumn(['number_of_people', 'destination', 'price_per_ticket']);
        });
    }
};
