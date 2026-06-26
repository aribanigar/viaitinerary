<?php

namespace App\Notifications;

use App\Models\LeadInquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LeadAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(protected LeadInquiry $inquiry) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'lead_assigned',
            'inquiry_id' => $this->inquiry->inquiry_id,
            'lead_id' => $this->inquiry->id,
            'client_name' => $this->inquiry->client_name,
            'client_phone' => $this->inquiry->client_phone,
            'client_email' => $this->inquiry->client_email,
            'destination' => $this->inquiry->destination,
            'message' => sprintf(
                'A lead has been assigned to you: %s (%s).',
                $this->inquiry->client_name,
                $this->inquiry->inquiry_id
            ),
            'action_url' => '/lead-inquiries',
        ];
    }
}
