<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckTrialExpiries extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:check-trial-expiries';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Finds expired trials and notifies admins.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $expiredSubscriptions = \App\Models\Subscription::where('plan_key', 'trial')
            ->where('status', 'trialing')
            ->where('trial_ends_at', '<=', now())
            ->whereNull('trial_expired_notified_at')
            ->with('user')
            ->get();

        foreach ($expiredSubscriptions as $sub) {
            if ($sub->user) {
                $sub->user->notify(new \App\Notifications\TrialExpiredUpgradeNotification());
                $sub->update(['trial_expired_notified_at' => now()]);
            }
        }

        $this->info('Checked and notified ' . $expiredSubscriptions->count() . ' tenants.');
    }
}
