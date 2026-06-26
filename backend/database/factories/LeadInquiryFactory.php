<?php

namespace Database\Factories;

use App\Models\LeadInquiry;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<LeadInquiry>
 */
class LeadInquiryFactory extends Factory
{
    protected $model = LeadInquiry::class;

    public function definition(): array
    {
        return [
            'inquiry_id'         => 'INQ' . $this->faker->unique()->numerify('######'),
            'user_id'            => User::factory(),
            'client_name'        => $this->faker->name(),
            'client_email'       => $this->faker->unique()->safeEmail(),
            'client_phone'       => '+91 98765 43210',
            'destination'        => $this->faker->city(),
            'pax'                => '2 Adults',
            'start_date'         => now()->addDays(30)->toDateString(),
            'duration'           => 5,
            'approximate_budget' => 50000,
            'currency'           => 'INR (₹)',
            'special_requests'   => null,
            'status'             => 'new',
            'source_url'         => null,
            'ip_address'         => '127.0.0.1',
            'is_public'          => false,
            'assigned_to'        => null,
        ];
    }
}
