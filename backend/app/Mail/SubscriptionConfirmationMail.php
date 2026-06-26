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

class SubscriptionConfirmationMail extends Mailable
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
                'Via Kashmir Itinerary'
            ),
            subject: "You're In! — ViaKashmir Itinerary",
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.subscription-confirmation',
            with: [
                'userName' => $this->user->name,
                'orderId' => $this->subscription->razorpay_payment_id ?? 'N/A',
                'purchaseDate' => $this->subscription->starts_at?->format('d F Y') ?? now()->format('d F Y'),
                'planName' => $this->plan->name,
                'userCount' => $this->plan->team_member_limit ? ($this->plan->team_member_limit + 1) : 1,
                'duration' => $this->plan->duration_months . ' Months',
                'amountPaid' => number_format((float)$this->subscription->paid_amount, 2),
                'startDate' => $this->subscription->starts_at?->format('d M Y') ?? now()->format('d M Y'),
                'endDate' => $this->subscription->ends_at?->format('d M Y') ?? now()->addMonths($this->plan->duration_months)->format('d M Y'),
            ],
        );
    }
}
