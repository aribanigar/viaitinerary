<?php

namespace App\Support;

use Illuminate\Validation\Rules\Password;

class PasswordPolicy
{
    public static function rule(): Password
    {
        return Password::min((int) config('security.passwords.min_length', 12))
            ->letters()
            ->mixedCase()
            ->numbers()
            ->symbols();
    }

    public static function required(): array
    {
        return ['required', 'string', static::rule()];
    }

    public static function nullable(): array
    {
        return ['nullable', 'string', static::rule()];
    }

    public static function requiredConfirmed(): array
    {
        return ['required', 'string', 'confirmed', static::rule()];
    }

    public static function sometimesConfirmed(): array
    {
        return ['sometimes', 'string', 'confirmed', static::rule()];
    }
}
