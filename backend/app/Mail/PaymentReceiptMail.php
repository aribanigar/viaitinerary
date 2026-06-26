<?php

namespace App\Mail;

use App\Models\AgencySetting;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public $trip;
    public $pdfContent;
    public $agencyName;
    public $paymentAmount;
    public $fromEmail;
    public $fromName;

    /**
     * Create a new message instance.
     */
    public function __construct($trip, $pdfContent, $agencyName, $paymentAmount, $fromEmail = null, $fromName = null)
    {
        $this->trip = $trip;
        $this->pdfContent = $pdfContent;
        $this->agencyName = $agencyName;
        $this->paymentAmount = $paymentAmount;
        $this->fromEmail = $fromEmail ?? config('mail.from.address') ?? config('mail.mailers.booking.username');
        $this->fromName = $fromName ?? $agencyName;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subjectTemplate = 'Payment Receipt - Trip #{tripId}';
        $subject = str_replace(
            ['{agencyName}', '{clientName}', '{tripId}'],
            [
                $this->agencyName,
                $this->trip->client_name ?? 'Guest',
                $this->trip->trip_id,
            ],
            $subjectTemplate
        );

        return new Envelope(
            from: new Address(
                $this->fromEmail,
                $this->fromName
            ),
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $settings = AgencySetting::with('documentTemplate')->where('user_id', $this->trip->user_id)->first();
        $messageTemplate = $settings?->payment_voucher_email_message
            ?? "Dear {clientName},\n\nThank you for your payment of {currencySymbol}{paymentAmount}. Please find your payment receipt attached below.\n\nRegards,\n{agencyName}";

        $message = str_replace(
            ['{agencyName}', '{clientName}', '{tripId}', '{paymentAmount}', '{currencySymbol}'],
            [
                $this->agencyName,
                $this->trip->client_name ?? 'Guest',
                $this->trip->trip_id,
                number_format($this->paymentAmount, 2),
                $this->trip->currency_symbol,
            ],
            $messageTemplate
        );

        return new Content(
            htmlString: nl2br(e($message)),
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromData(fn() => $this->pdfContent, 'Payment_Receipt_' . $this->trip->trip_id . '.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
