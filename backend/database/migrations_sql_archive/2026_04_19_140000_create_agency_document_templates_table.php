<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('agency_document_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');

            $table->text('confirmation_message')->nullable();
            $table->text('confirmation_pdf_message')->nullable();
            $table->string('confirmation_hero_image')->nullable();
            $table->text('payment_voucher_email_message')->nullable();
            $table->text('invoice_email_message')->nullable();

            $table->timestamps();
        });

        $settingsRows = DB::table('agency_settings')
            ->select([
                'user_id',
                'confirmation_message',
                'confirmation_pdf_message',
                'confirmation_hero_image',
            ])
            ->whereNotNull('user_id')
            ->get();

        foreach ($settingsRows as $row) {
            DB::table('agency_document_templates')->updateOrInsert(
                ['user_id' => $row->user_id],
                [
                    'confirmation_message' => $row->confirmation_message,
                    'confirmation_pdf_message' => $row->confirmation_pdf_message,
                    'confirmation_hero_image' => $row->confirmation_hero_image,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agency_document_templates');
    }
};
