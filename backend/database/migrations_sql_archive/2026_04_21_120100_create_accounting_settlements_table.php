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
        Schema::create('accounting_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('obligation_id')->constrained('accounting_obligations')->cascadeOnDelete();
            $table->foreignId('trip_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->decimal('amount', 15, 2);
            $table->enum('settlement_type', ['receipt', 'payment', 'refund', 'adjustment'])->default('payment');
            $table->date('settlement_date');
            $table->string('method')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'trip_id']);
            $table->index(['obligation_id', 'settlement_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accounting_settlements');
    }
};
