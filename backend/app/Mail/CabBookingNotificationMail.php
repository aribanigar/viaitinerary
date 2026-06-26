<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

use App\Models\Trip;
use App\Models\Transportation;

class CabBookingNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public Trip $trip,
        public Transportation $transportation,
        public $agencySettings,
        public ?string $fromEmail = null,
        public ?string $fromName = null
    ) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subject = 'New Cab Service Request - ' . ($this->agencySettings->agency_name ?? 'Travel Agency');

        $fromEmail = $this->fromEmail ?? config('mail.from.address') ?? config('mail.mailers.booking.username');
        $fromName = $this->fromName ?? ($this->agencySettings->agency_name ?? config('app.name'));

        return new Envelope(
            from: new Address($fromEmail, $fromName),
            subject: $subject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.cab-booking',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
