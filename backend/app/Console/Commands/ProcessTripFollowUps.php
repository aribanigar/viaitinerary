<?php

namespace App\Console\Commands;

use App\Models\Trip;
use App\Models\User;
use App\Notifications\ItineraryFollowUpNotification;
use Carbon\Carbon;
use App\Models\Team;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Sends in-app follow-up notifications for trips created more than 24 hours ago.
 *
 * Runs every hour via the scheduler.
 *
 * Architecture:
 *  - Replaces the old behaviour where NotificationController::index() did DB
 *    writes on every frontend poll (only fired if the user opened the bell).
 *  - Now runs on a schedule so follow-ups are sent regardless of user activity.
 *  - Resolves the correct notifiable (admin or team member) via a single JOIN query.
 *  - Marks processed trips in one bulk UPDATE rather than one UPDATE per trip.
 */
class ProcessTripFollowUps extends Command
{
    protected $signature   = 'app:process-trip-follow-ups';
    protected $description = 'Send 24-hour follow-up in-app notifications for unnotified trips';

    public function handle(): int
    {
        $cutoff = Carbon::now()->subHours(24);

        // Unnotified trips older than the cutoff. MongoDB has no joins, so the
        // notifiable (team member or admin) is resolved in PHP:
        //   - Team trips  → notify the team member (teams.user_id)
        //   - Admin trips → notify the trip owner  (trips.user_id)
        $trips = Trip::where('follow_up_sent', false)
            ->where('created_at', '<=', $cutoff)
            ->get();

        if ($trips->isEmpty()) {
            $this->info('No trips need follow-up notifications.');
            return self::SUCCESS;
        }

        $teamIds = $trips->pluck('team_id')->filter()->unique()->values();
        $teams   = Team::whereIn('_id', $teamIds->all())->get()->keyBy('id');

        $notifiableIdByTrip = [];
        foreach ($trips as $trip) {
            $team = $trip->team_id ? $teams->get($trip->team_id) : null;
            $notifiableIdByTrip[$trip->id] = $team->user_id ?? $trip->user_id;
        }

        $userIds = collect($notifiableIdByTrip)->filter()->unique()->values();
        $users   = User::whereIn('_id', $userIds->all())->get()->keyBy('id');

        $processedTripIds = [];

        foreach ($trips as $trip) {
            $notifiable = $users->get($notifiableIdByTrip[$trip->id] ?? null);

            if (!$notifiable) {
                Log::warning("ProcessTripFollowUps: skipping trip {$trip->trip_id} — notifiable user not found.");
                continue;
            }

            try {
                $notifiable->notify(new ItineraryFollowUpNotification($trip));
                $processedTripIds[] = $trip->id;
            } catch (\Throwable $e) {
                Log::error("ProcessTripFollowUps: notification failed for trip {$trip->trip_id}: " . $e->getMessage());
            }
        }

        // Single bulk UPDATE instead of one UPDATE per trip
        if (!empty($processedTripIds)) {
            Trip::whereIn('id', $processedTripIds)->update(['follow_up_sent' => true]);
            $this->info('Processed ' . count($processedTripIds) . ' follow-up notification(s).');
        }

        return self::SUCCESS;
    }
}
