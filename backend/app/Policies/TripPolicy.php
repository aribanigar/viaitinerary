<?php

namespace App\Policies;

use App\Models\Trip;
use App\Models\User;
use App\Models\Team;

class TripPolicy
{
    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Trip $trip): bool
    {
        if ($user->role === 'admin' || $user->role === 'super_admin') {
            $adminId = $user->getAdminId();
            // Admin can view their own trips or trips created by their team members
            return $trip->user_id === $adminId ||
                ($trip->team_id && Team::where('id', $trip->team_id)->where('created_by', $adminId)->exists());
        }

        if ($user->role === 'team') {
            return $trip->team_id === $user->getTeamId();
        }

        return false;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Trip $trip): bool
    {
        if ($user->role === 'admin' || $user->role === 'super_admin') {
            $adminId = $user->getAdminId();
            // Admin can update their own trips or trips created by their team members
            return $trip->user_id === $adminId ||
                ($trip->team_id && Team::where('id', $trip->team_id)->where('created_by', $adminId)->exists());
        }

        if ($user->role === 'team') {
            return $trip->team_id === $user->getTeamId();
        }

        return false;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Trip $trip): bool
    {
        if ($user->role === 'admin' || $user->role === 'super_admin') {
            $adminId = $user->getAdminId();
            // Admin can delete their own trips or trips created by their team members
            return $trip->user_id === $adminId ||
                ($trip->team_id && Team::where('id', $trip->team_id)->where('created_by', $adminId)->exists());
        }

        if ($user->role === 'team') {
            return $trip->team_id === $user->getTeamId();
        }

        return false;
    }
}
