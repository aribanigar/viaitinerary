<?php

namespace App\Imports;

use App\Models\Hotel;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Illuminate\Support\Facades\Auth;

class HotelsImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    public function model(array $row)
    {
        $name = $row['hotel_name'] ?? $row['Hotel Name'] ?? null;
        $city = $row['city'] ?? $row['City'] ?? null;
        $email = $row['hotel_email'] ?? $row['Hotel Email'] ?? $row['email'] ?? $row['Email'] ?? null;
        $phone = $row['hotel_phone'] ?? $row['Hotel Phone'] ?? $row['phone'] ?? $row['Phone'] ?? null;
        
        if (!$name) {
            return null;
        }
        
        $price_sections = [];
        
        $jsonSections = $row['price_sections'] ?? $row['Price Sections'] ?? $row['price_sections_json'] ?? $row['Price Sections (JSON)'] ?? null;
        if (!empty($jsonSections)) {
            $decoded = is_string($jsonSections) ? json_decode($jsonSections, true) : $jsonSections;
            if (is_array($decoded)) {
                $price_sections = $decoded;
            }
        } else {
            // Fallback for legacy CSV formats
            $deluxe_price = $row['deluxe_room_price'] ?? $row['Deluxe Room Price'] ?? 0;
            $super_deluxe_price = $row['super_deluxe_room_price'] ?? $row['Super Deluxe Room Price'] ?? 0;
            $suite_price = $row['suite_price'] ?? $row['Suite Price'] ?? 0;

            $deluxe_eb_cnb = $row['deluxe_extra_bed_price_cnb'] ?? $row['deluxe_extra_bed_price_upto_5'] ?? $row['Deluxe Extra Bed Price (CNB)'] ?? $row['Deluxe Extra Bed Price (Upto 5)'] ?? 0;
            $deluxe_eb_5_to_12 = $row['deluxe_extra_bed_price_5_12'] ?? $row['deluxe_extra_bed_price_5_to_12'] ?? $row['deluxe_extra_bed_price'] ?? $row['Deluxe Extra Bed Price'] ?? $row['Deluxe Extra Bed Price (5-12)'] ?? 0;
            $deluxe_eb_above_12 = $row['deluxe_extra_bed_price_above_12'] ?? $row['Deluxe Extra Bed Price (Above 12)'] ?? 0;

            $super_deluxe_eb_cnb = $row['super_deluxe_extra_bed_price_cnb'] ?? $row['super_deluxe_extra_bed_price_upto_5'] ?? $row['Super Deluxe Extra Bed Price (CNB)'] ?? $row['Super Deluxe Extra Bed Price (Upto 5)'] ?? 0;
            $super_deluxe_eb_5_to_12 = $row['super_deluxe_extra_bed_price_5_12'] ?? $row['super_deluxe_extra_bed_price_5_to_12'] ?? $row['super_deluxe_extra_bed_price'] ?? $row['Super Deluxe Extra Bed Price'] ?? $row['Super Deluxe Extra Bed Price (5-12)'] ?? 0;
            $super_deluxe_eb_above_12 = $row['super_deluxe_extra_bed_price_above_12'] ?? $row['Super Deluxe Extra Bed Price (Above 12)'] ?? 0;

            $suite_eb_cnb = $row['suite_extra_bed_price_cnb'] ?? $row['suite_extra_bed_price_upto_5'] ?? $row['Suite Extra Bed Price (CNB)'] ?? $row['Suite Extra Bed Price (Upto 5)'] ?? 0;
            $suite_eb_5_to_12 = $row['suite_extra_bed_price_5_12'] ?? $row['suite_extra_bed_price_5_to_12'] ?? $row['suite_extra_bed_price'] ?? $row['Suite Extra Bed Price'] ?? $row['Suite Extra Bed Price (5-12)'] ?? 0;
            $suite_eb_above_12 = $row['suite_extra_bed_price_above_12'] ?? $row['Suite Extra Bed Price (Above 12)'] ?? 0;

            if ($deluxe_price > 0 || $deluxe_eb_cnb > 0 || $deluxe_eb_5_to_12 > 0 || $deluxe_eb_above_12 > 0) {
                $price_sections[] = [
                    'room_type'  => 'deluxe',
                    'meal_plan'  => 'room_only',
                    'price'      => $deluxe_price,
                    'cnb'        => $deluxe_eb_cnb,
                    'upto_5'     => $deluxe_eb_5_to_12,
                    'above_12'   => $deluxe_eb_above_12,
                ];
            }
            if ($super_deluxe_price > 0 || $super_deluxe_eb_cnb > 0 || $super_deluxe_eb_5_to_12 > 0 || $super_deluxe_eb_above_12 > 0) {
                $price_sections[] = [
                    'room_type'  => 'super_deluxe',
                    'meal_plan'  => 'room_only',
                    'price'      => $super_deluxe_price,
                    'cnb'        => $super_deluxe_eb_cnb,
                    'upto_5'     => $super_deluxe_eb_5_to_12,
                    'above_12'   => $super_deluxe_eb_above_12,
                ];
            }
            if ($suite_price > 0 || $suite_eb_cnb > 0 || $suite_eb_5_to_12 > 0 || $suite_eb_above_12 > 0) {
                $price_sections[] = [
                    'room_type'  => 'suite',
                    'meal_plan'  => 'room_only',
                    'price'      => $suite_price,
                    'cnb'        => $suite_eb_cnb,
                    'upto_5'     => $suite_eb_5_to_12,
                    'above_12'   => $suite_eb_above_12,
                ];
            }
        }

        return Hotel::updateOrCreate(
            ['name' => $name, 'city' => $city, 'user_id' => Auth::id()],
            [
                'email' => $email,
                'phone' => $phone,
                'price_sections' => $price_sections,
            ]
        );
    }
}
