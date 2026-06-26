<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use MongoDB\Laravel\Eloquent\Model;

class InclusionExclusion extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'type', 'content', 'sort_order'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
