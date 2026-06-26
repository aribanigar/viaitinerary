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
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();

            // One subscription row per user (admin or team member). UNIQUE enforced here.
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');

            // null  = no plan assigned (pending team member)
            // trial, monthly, six_months, yearly
            $table->string('plan_key', 50)->nullable();

            // pending | trialing | active | expired | canceled
            $table->string('status', 20)->default('pending');

            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();

            // Trial-specific fields
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('trial_expired_notified_at')->nullable();

            // Trip limits (3 for trial, null = unlimited for paid)
            $table->unsignedInteger('trip_limit')->nullable();
            $table->unsignedInteger('trips_used')->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
