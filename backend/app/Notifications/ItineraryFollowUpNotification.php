<?php

namespace App\Notifications;

use App\Models\Trip;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ItineraryFollowUpNotification extends Notification
{
    use Queueable;

    protected $trip;

    /**
     * Create a new notification instance.
     */
    public function __construct(Trip $trip)
    {
        $this->trip = $trip;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'trip_id' => $this->trip->trip_id,
            'client_name' => $this->trip->client_name,
            'client_phone' => $this->trip->client_phone,
            'client_email' => $this->trip->client_email,
            'message' => 'Please send the follow-up message for the itinerary created yesterday.',
            'type' => 'follow_up'
        ];
    }
}
