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
        Schema::create('calculations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('client_name');
            $table->json('selected_hotels');
            $table->json('selected_vehicles');
            $table->json('other_costs');
            $table->decimal('gst_percentage', 5, 2);
            $table->decimal('profit_margin_percentage', 5, 2);
            $table->decimal('total_cost', 15, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('calculations');
    }
};
