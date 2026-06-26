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
        Schema::create('accounting_obligations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('team_id')->nullable()->constrained('teams')->nullOnDelete();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();

            $table->enum('direction', ['receivable', 'payable']);
            $table->enum('party_type', ['client', 'hotel', 'cab', 'manual'])->default('manual');
            $table->unsignedBigInteger('party_id')->nullable();
            $table->string('party_name')->nullable();

            $table->enum('source_type', ['trip', 'accommodation', 'transportation', 'manual_adjustment'])->default('manual_adjustment');
            $table->unsignedBigInteger('source_id')->nullable();

            $table->decimal('expected_amount', 15, 2)->default(0);
            $table->decimal('settled_amount', 15, 2)->default(0);
            $table->enum('status', ['pending', 'partial', 'settled'])->default('pending');
            $table->date('due_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'trip_id']);
            $table->index(['trip_id', 'direction', 'party_type']);
            $table->index(['source_type', 'source_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accounting_obligations');
    }
};
