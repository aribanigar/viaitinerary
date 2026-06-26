<?php

namespace App\Policies;

use App\Models\User;
use App\Models\BlogPost;
use App\Models\Team;

class BlogPostPolicy
{
    /**
     * Determine if the user can view any blog posts
     */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, ['admin', 'super_admin']);
    }

    /**
     * Determine if the user can view the blog post
     */
    public function view(User $user, BlogPost $post): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        // Admin can view posts from their team
        $teamId = $this->resolveTeamId($user);
        return $teamId && $post->team_id === $teamId;
    }

    /**
     * Determine if the user can create blog posts
     */
    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'super_admin']);
    }

    /**
     * Determine if the user can update the blog post
     */
    public function update(User $user, BlogPost $post): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        $teamId = $this->resolveTeamId($user);
        return $teamId && $post->team_id === $teamId;
    }

    /**
     * Determine if the user can delete the blog post
     */
    public function delete(User $user, BlogPost $post): bool
    {
        return $this->update($user, $post);
    }

    /**
     * Determine if the user can publish the blog post
     */
    public function publish(User $user, BlogPost $post): bool
    {
        return $this->update($user, $post) && $post->canBePublished();
    }

    /**
     * Determine if the user can view all posts (super admin only)
     */
    public function viewAllPosts(User $user): bool
    {
        return $user->role === 'super_admin';
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
