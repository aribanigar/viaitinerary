<?php

namespace Database\Seeders;

use App\Models\AgencySetting;
use App\Models\User;
use Illuminate\Database\Seeder;

class AgencySettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $user = User::where('email', '92hammadmustafa1@gmail.com')->first();

        if ($user) {
            AgencySetting::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'agency_name' => 'ViaItinerary',
                    'contact_email' => 'contact@viaitinerary.com',
                    'contact_phone' => '+91 9186051499',
                    'website' => 'www.viaitinerary.com',
                    'whatsapp' => '+91 9186051499',
                    'brand_color' => '#FAA61A',
                    'footer_text' => 'THANK YOU FOR TRAVELING WITH US!',
                ]
            );
        }
    }
}
