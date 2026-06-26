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
        Schema::create('trip_inquiries', function (Blueprint $table) {
            $table->id();
            $table->string('inquiry_id')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('client_name');
            $table->string('client_email');
            $table->string('client_phone')->nullable();
            $table->string('destination');
            $table->string('pax')->nullable(); // e.g., "2 Adults, 1 Child"
            $table->date('start_date')->nullable();
            $table->string('duration')->nullable(); // in nights
            $table->decimal('approximate_budget', 10, 2)->nullable();
            $table->string('currency')->default('INR (₹)');
            $table->text('special_requests')->nullable();
            $table->enum('status', ['new', 'contacted', 'quoted', 'converted', 'closed'])->default('new');
            $table->string('source_url')->nullable();
            $table->text('notes')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            // Add indexes for better query performance
            $table->index('user_id');
            $table->index('status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trip_inquiries');
    }
};
