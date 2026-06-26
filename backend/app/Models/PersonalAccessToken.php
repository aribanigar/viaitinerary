<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;
use MongoDB\Laravel\Eloquent\DocumentModel;

/**
 * MongoDB-backed Sanctum personal access token. Sanctum's default token model
 * is a relational Eloquent model; on MongoDB we store tokens as documents.
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    use DocumentModel;

    protected $connection = 'mongodb';
    protected $keyType = 'string';
    protected $table = 'personal_access_tokens';
}
