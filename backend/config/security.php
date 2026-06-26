<?php

return [
    'passwords' => [
        // Strong baseline for new and updated passwords.
        'min_length' => env('PASSWORD_MIN_LENGTH', 8),

        // Number of known breach appearances allowed (0 means strictest).
        'uncompromised_threshold' => env('PASSWORD_UNCOMPROMISED_THRESHOLD', 1),

        // Check whether existing users' current password still meets policy at login.
        'check_on_login' => env('PASSWORD_POLICY_CHECK_ON_LOGIN', false),

        // If true, block login when policy check fails; if false, allow login but flag for reset.
        'enforce_on_login' => env('PASSWORD_POLICY_ENFORCE_ON_LOGIN', false),
    ],
];
