<?php

namespace App\Console\Commands;

use App\Models\Trip;
use App\Models\User;
use App\Notifications\ItineraryFollowUpNotification;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
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

        // Single query: get all unnotified trips with the correct notifiable user id.
        //   - Team trips  → notify the team member (teams.user_id)
        //   - Admin trips → notify the admin     (trips.user_id)
        $rows = DB::table('trips')
            ->leftJoin('teams', 'trips.team_id', '=', 'teams.id')
            ->where('trips.follow_up_sent', false)
            ->where('trips.created_at', '<=', $cutoff)
            ->select([
                'trips.id',
                'trips.trip_id',
                'trips.client_name',
                'trips.client_phone',
                'trips.client_email',
                DB::raw('COALESCE(teams.user_id, trips.user_id) AS notifiable_user_id'),
            ])
            ->get();

        if ($rows->isEmpty()) {
            $this->info('No trips need follow-up notifications.');
            return self::SUCCESS;
        }

        // Load only the User models we actually need (one query)
        $userIds    = $rows->pluck('notifiable_user_id')->unique()->values();
        $users      = User::whereIn('id', $userIds)->get()->keyBy('id');

        // Load full Trip models for the notification (needed by ItineraryFollowUpNotification)
        $tripIds    = $rows->pluck('id')->all();
        $tripModels = Trip::whereIn('id', $tripIds)->get()->keyBy('id');

        $processedTripIds = [];

        foreach ($rows as $row) {
            $notifiable = $users->get($row->notifiable_user_id);
            $trip       = $tripModels->get($row->id);

            if (!$notifiable || !$trip) {
                Log::warning("ProcessTripFollowUps: skipping trip {$row->trip_id} — user or trip not found.");
                continue;
            }

            try {
                $notifiable->notify(new ItineraryFollowUpNotification($trip));
                $processedTripIds[] = $row->id;
            } catch (\Throwable $e) {
                Log::error("ProcessTripFollowUps: notification failed for trip {$row->trip_id}: " . $e->getMessage());
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
