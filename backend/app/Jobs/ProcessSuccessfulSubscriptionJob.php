<?php

namespace App\Jobs;

use App\Mail\NewSubscriptionAlertMail;
use App\Mail\SubscriptionConfirmationMail;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ProcessSuccessfulSubscriptionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30; // 30 seconds wait before retry

    /**
     * Create a new job instance.
     */
    public function __construct(
        public int $userId,
        public int $subscriptionId
    ) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $user = User::with('agencySetting')->findOrFail($this->userId);
        $subscription = Subscription::findOrFail($this->subscriptionId);
        $plan = Plan::where('key', $subscription->plan_key)->first();

        if (!$plan) {
            Log::error("ProcessSuccessfulSubscriptionJob: Plan not found for key {$subscription->plan_key}");
            return;
        }

        // 1. Send confirmation email to client
        try {
            Mail::mailer('booking')
                ->to($user->email)
                ->send(new SubscriptionConfirmationMail($user, $subscription, $plan));

            Log::info("Subscription confirmation email sent to {$user->email}");
        } catch (\Exception $e) {
            Log::error("Failed to send subscription confirmation email to {$user->email}: " . $e->getMessage());
            throw $e; // Rethrow to allow retry
        }

        // 2. Send alert email to Super Admin
        $superAdminEmail = config('services.super_admin.email', 'ViaItinerary.in@gmail.com');
        try {
            Mail::mailer('booking')
                ->to($superAdminEmail)
                ->send(new NewSubscriptionAlertMail($user, $subscription, $plan));

            Log::info("New subscription alert email sent to Super Admin ({$superAdminEmail})");
        } catch (\Exception $e) {
            Log::error("Failed to send subscription alert email to Super Admin: " . $e->getMessage());
            // Don't throw here if previous email succeeded, but we should log it
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("ProcessSuccessfulSubscriptionJob failed for user {$this->userId}: " . $exception->getMessage());
    }
}
