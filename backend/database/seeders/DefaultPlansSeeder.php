<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Plan;

class DefaultPlansSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $plans = [
            [
                'key' => 'trial',
                'name' => 'Trial',
                'price' => 0,
                'duration_months' => 1,
                'trip_limit' => 3,
                'is_active' => true,
            ],
            [
                'key' => 'monthly',
                'name' => 'Monthly',
                'price' => 999,
                'duration_months' => 1,
                'trip_limit' => null,
                'is_active' => true,
                'features' => json_encode([
                    "Unlimited Trip Creation",
                    "PDF Itinerary Downloads",
                    "Team Collaboration",
                    "Priority Support"
                ]),
                'badge_label' => null,
                'recommended' => false,
            ],
            [
                'key' => 'six_months',
                'name' => 'Semi-Annual',
                'price' => 5200,
                'duration_months' => 6,
                'is_active' => true,
                'features' => json_encode([
                    "Everything in Monthly",
                    "Save 15% on Multi-month",
                    "Advanced Analytics",
                    "Custom Brand Color"
                ]),
                'badge_label' => 'BEST VALUE',
                'recommended' => true,
            ],
            [
                'key' => 'yearly',
                'name' => 'Annual',
                'price' => 10000,
                'duration_months' => 12,
                'is_active' => true,
                'features' => json_encode([
                    "Everything in Semi-Annual",
                    "Save 20% on Annual",
                    "Beta Access to Features",
                    "Dedicated Manager"
                ]),
                'badge_label' => null,
                'recommended' => false,
            ],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['key' => $plan['key']], $plan);
        }
    }
}
