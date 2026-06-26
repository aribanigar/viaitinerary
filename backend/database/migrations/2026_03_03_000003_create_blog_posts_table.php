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
        Schema::create('blog_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained('teams')->cascadeOnDelete();
            $table->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('blog_category_id')->nullable()->constrained('blog_categories')->nullOnDelete();
            $table->string('title', 255);
            $table->string('slug', 255);
            $table->text('excerpt')->nullable();
            $table->longText('content');
            $table->string('featured_image')->nullable();
            $table->enum('status', ['draft', 'published', 'scheduled', 'archived'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->string('author_name')->nullable();
            $table->string('meta_title', 160)->nullable();
            $table->text('meta_description')->nullable();
            $table->string('og_image')->nullable();
            $table->unsignedBigInteger('views_count')->default(0);
            $table->unsignedSmallInteger('read_time_minutes')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'slug']);
            $table->index(['team_id', 'status', 'published_at']);
            $table->index('author_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('blog_posts');
    }
};
