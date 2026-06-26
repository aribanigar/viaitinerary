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
        Schema::create('integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('platform'); // 'facebook' or 'google'
            $table->string('platform_id')->nullable();
            $table->text('access_token');
            $table->text('refresh_token')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->json('settings')->nullable(); // For page_id, form_id list, etc.
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('integrations');
    }
};
