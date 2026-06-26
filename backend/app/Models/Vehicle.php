<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory;
    use \App\Traits\BelongsToAdmin;

    protected $fillable = ['user_id', 'name', 'email', 'phone', 'price'];

    protected $appends = ['creator_name', 'creator_email'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getCreatorNameAttribute()
    {
        return $this->user ? $this->user->name : 'Unknown';
    }

    public function getCreatorEmailAttribute()
    {
        return $this->user ? $this->user->email : 'Unknown';
    }
}
