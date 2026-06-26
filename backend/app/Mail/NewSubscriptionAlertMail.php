<?php

namespace App\Mail;

use App\Models\Subscription;
use App\Models\User;
use App\Models\Plan;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class NewSubscriptionAlertMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * Create a new message instance.
     */
    public function __construct(
        public User $user,
        public Subscription $subscription,
        public Plan $plan
    ) {}

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(
                config('mail.mailers.booking.username'),
                'Via Kashmir IT'
            ),
            subject: 'New Subscription Alert — ViaKashmir Itinerary',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.internal-subscription-alert',
            with: [
                'revenue' => number_format((float)$this->subscription->paid_amount, 0),
                'planName' => $this->plan->name,
                'userCount' => $this->plan->team_member_limit ? ($this->plan->team_member_limit + 1) : 1,
                'customerName' => $this->user->name,
                'agencyName' => $this->user->agencySetting?->agency_name ?? 'N/A',
                'customerEmail' => $this->user->email,
                'customerPhone' => $this->user->agencySetting?->phone ?? 'N/A',
                'orderId' => $this->subscription->razorpay_payment_id ?? 'N/A',
                'purchaseDate' => $this->subscription->starts_at?->format('d M Y H:i') ?? now()->format('d M Y H:i'),
                'duration' => $this->plan->duration_months . ' Months',
                'amountPaid' => number_format((float)$this->subscription->paid_amount, 2),
            ],
        );
    }
}
