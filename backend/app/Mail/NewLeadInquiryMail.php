<?php

namespace App\Mail;

use App\Models\LeadInquiry;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewLeadInquiryMail extends Mailable
{
    use Queueable, SerializesModels;

    public $inquiry;
    public $agency;
    public $fromEmail;
    public $fromName;

    /**
     * Create a new message instance.
     */
    public function __construct(LeadInquiry $inquiry, User $agency, $fromEmail = null, $fromName = null)
    {
        $this->inquiry = $inquiry;
        $this->agency = $agency;
        $this->fromEmail = $fromEmail ?? config('mail.from.address') ?? config('mail.mailers.booking.username');
        $this->fromName = $fromName ?? config('app.name');
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
            subject: 'New Trip Inquiry - ' . $this->inquiry->inquiry_id,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.new-trip-inquiry',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
