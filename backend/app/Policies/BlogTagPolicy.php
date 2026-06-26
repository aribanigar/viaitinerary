<?php

namespace App\Policies;

use App\Models\User;
use App\Models\BlogTag;
use App\Models\Team;

class BlogTagPolicy
{
    /**
     * Determine if the user can view any tags
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['admin', 'super_admin']);
    }

    /**
     * Determine if the user can view the tag
     */
    public function view(User $user, BlogTag $tag): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        $teamId = $this->resolveTeamId($user);
        return $teamId && $tag->team_id === $teamId;
    }

    /**
     * Determine if the user can create tags
     */
    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'super_admin']);
    }

    /**
     * Determine if the user can update the tag
     */
    public function update(User $user, BlogTag $tag): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        $teamId = $this->resolveTeamId($user);
        return $teamId && $tag->team_id === $teamId;
    }

    /**
     * Determine if the user can delete the tag
     */
    public function delete(User $user, BlogTag $tag): bool
    {
        return $this->update($user, $tag);
    }

    /**
     * Resolve team ID for the user
     */
    protected function resolveTeamId(User $user): ?int
    {
        $team = Team::where('created_by', $user->id)->first();
        return $team?->id;
    }
}
