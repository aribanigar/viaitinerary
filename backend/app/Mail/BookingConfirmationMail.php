<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public $trip;
    public $pdfContent;
    public $agencyName;
    public $agencySettings;
    public $logoBase64;
    public $tripImageBase64;
    public $heroImageBase64;
    public $confirmationMessage;
    public $fromEmail;
    public $fromName;

    /**
     * Create a new message instance.
     */
    public function __construct($trip, $pdfContent, $agencyName, $agencySettings = null, $logoBase64 = null, $tripImageBase64 = null, $heroImageBase64 = null, $confirmationMessage = null, $fromEmail = null, $fromName = null)
    {
        $this->trip = $trip;
        $this->pdfContent = $pdfContent;
        $this->agencyName = $agencyName;
        $this->agencySettings = $agencySettings;
        $this->logoBase64 = $logoBase64;
        $this->tripImageBase64 = $tripImageBase64;
        $this->heroImageBase64 = $heroImageBase64;
        $this->confirmationMessage = $confirmationMessage;
        $this->fromEmail = $fromEmail ?? config('mail.from.address') ?? config('mail.mailers.booking.username');
        $this->fromName = $fromName ?? $agencyName;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(
                $this->fromEmail,
                $this->fromName
            ),
            subject: 'Booking Confirmed – Trip Details #' . $this->trip->trip_id,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            htmlString: nl2br($this->confirmationMessage),
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
            Attachment::fromData(fn() => $this->pdfContent, $this->trip->trip_id . '_Confirmation.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
