<?php

namespace App\Policies;

use App\Models\User;
use App\Models\BlogCategory;
use App\Models\Team;

class BlogCategoryPolicy
{
    /**
     * Determine if the user can view any categories
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['admin', 'super_admin']);
    }

    /**
     * Determine if the user can view the category
     */
    public function view(User $user, BlogCategory $category): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        $teamId = $this->resolveTeamId($user);
        return $teamId && $category->team_id === $teamId;
    }

    /**
     * Determine if the user can create categories
     */
    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'super_admin']);
    }

    /**
     * Determine if the user can update the category
     */
    public function update(User $user, BlogCategory $category): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        $teamId = $this->resolveTeamId($user);
        return $teamId && $category->team_id === $teamId;
    }

    /**
     * Determine if the user can delete the category
     */
    public function delete(User $user, BlogCategory $category): bool
    {
        return $this->update($user, $category);
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
