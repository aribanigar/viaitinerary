<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

/**
 * Trait BelongsToAdmin
 * 
 * Automatically scopes queries to the current authenticated user's admin context.
 * For admins, this is their own ID.
 * For team members, this is their creator's (admin) ID.
 */
trait BelongsToAdmin
{
    public static function bootBelongsToAdmin()
    {
        static::addGlobalScope('admin_context', function (Builder $builder) {
            if (Auth::check()) {
                $user = Auth::user();
                $adminId = $user->getAdminId();

                // Ensure the model has a user_id column before scoping
                // Most models in this CRM use 'user_id' to store the owner/admin
                $builder->where($builder->getQuery()->from . '.user_id', $adminId);
            }
        });

        static::creating(function ($model) {
            if (Auth::check() && !$model->user_id) {
                $model->user_id = Auth::user()->getAdminId();
            }
        });
    }
}
