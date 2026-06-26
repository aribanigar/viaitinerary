<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'bypass_subscription',
        'name',
        'email',
        'password',
        'role',
        'status',
        'email_verified_at',
        'profile_picture',
        'embed_token',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (User $user) {
            if (empty($user->embed_token)) {
                $user->embed_token = (string) Str::uuid();
            }
        });
    }

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
        ];
    }

    // -----------------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------------

    /** The user's own subscription record (admin or team member). */
    public function subscription()
    {
        return $this->hasOne(Subscription::class, 'user_id');
    }

    /** One active API session per user for strict single-device login. */
    public function activeSession()
    {
        return $this->hasOne(UserActiveSession::class, 'user_id');
    }

    public function agencySetting()
    {
        return $this->hasOne(AgencySetting::class, 'user_id');
    }

    /** The team record for team-role users. */
    public function teamRecord()
    {
        return $this->hasOne(Team::class, 'user_id');
    }

    public function trips()
    {
        return $this->hasMany(Trip::class);
    }

    /** Teams created by this admin (team members are linked via teams.created_by). */
    public function teamsCreated()
    {
        return $this->hasMany(Team::class, 'created_by');
    }

    public function blogPosts()
    {
        return $this->hasMany(BlogPost::class, 'author_id');
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Returns the admin user_id for either an admin or a team member.
     * For admins it returns their own id.
     * For team members it returns the id of the admin who created them.
     */
    public function getAdminId(): int
    {
        if ($this->role === 'admin') {
            return $this->id;
        }

        return $this->teamRecord ? $this->teamRecord->created_by : $this->id;
    }

    /**
     * Returns the teams.id for a team-role user, or null for admins.
     */
    public function getTeamId(): ?int
    {
        if ($this->role === 'team') {
            return $this->teamRecord ? $this->teamRecord->id : null;
        }

        return null;
    }
}
