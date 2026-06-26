<?php

return [
    'trial' => [
        'name' => 'Trial',
        'limit' => 3,
        'duration_days' => 3,
        'price' => 0,
    ],
    'monthly' => [
        'name' => 'Monthly',
        'limit' => null, // Unlimited
        'price' => 999,
        'duration_months' => 1,
    ],
    'six_months' => [
        'name' => '6 Months',
        'limit' => null,
        'price' => 5200,
        'duration_months' => 6,
    ],
    'yearly' => [
        'name' => 'Yearly',
        'limit' => null,
        'price' => 10000,
        'duration_months' => 12,
    ],
];
