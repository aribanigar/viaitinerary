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
        Schema::create('teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            // The agency owner/creator who manages this team member
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('cascade');

            // Profile specific details (email/password/name are in users table)
            // We keep 'name' here only if it differs from user.name, but usually it's better to use user.name for consistency.
            // However, for simplicity in existing code, we often sync them or just fetch from User.
            // Let's keep specific profile fields here.

            $table->string('job_title')->nullable()->comment('Specific job title like "Senior Agent"');
            $table->string('phone')->nullable();
            $table->string('image_path')->nullable();
            $table->decimal('commission_rate', 5, 2)->default(0.00)->comment('Commission percentage for this agent');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('teams');
    }
};
