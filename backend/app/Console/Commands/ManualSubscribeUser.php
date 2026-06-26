<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\Plan;
use App\Services\SubscriptionService;

class ManualSubscribeUser extends Command
{
    protected $signature = 'subscription:manual-subscribe {user_id} {plan_id} {--paid}';

    protected $description = 'Manually subscribe a user to a plan (use --paid to mark paid_amount as plan price)';

    public function handle()
    {
        $userId = $this->argument('user_id');
        $planId = $this->argument('plan_id');
        $markPaid = $this->option('paid');

        $user = User::find($userId);
        if (!$user) {
            $this->error("User with id {$userId} not found.");
            return 1;
        }

        $plan = Plan::find($planId);
        if (!$plan) {
            $this->error("Plan with id {$planId} not found.");
            return 1;
        }

        $planKey = $plan->key;

        // Prepare data similar to SubscriptionService::upgradeUserToPlan but mark paid_amount optional
        $price = $plan ? $plan->price : 0;
        $data = [
            'plan_key' => $planKey,
            'paid_amount' => $markPaid ? $price : 0,
            'razorpay_payment_id' => $markPaid ? 'manual-' . time() : null,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => $plan ? now()->addMonths($plan->duration_months) : now()->addMonth(),
            'trial_ends_at' => null,
            'trip_limit' => $plan ? $plan->trip_limit : null,
        ];

        $subscription = $user->subscription()->first();
        if ($subscription) {
            $subscription->update($data);
        } else {
            $user->subscription()->create(array_merge($data, ['trips_used' => 0]));
        }

        $user->update(['status' => 'active']);

        $this->info("User {$user->id} subscribed to plan {$planKey} successfully.");
        return 0;
    }
}
