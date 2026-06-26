<?php

namespace App\Imports;

use App\Models\Vehicle;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Illuminate\Support\Facades\Auth;

class TransportationImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    public function model(array $row)
    {
        // Car Name -> name
        // Vehicle Email -> email
        // Vehicle Phone -> phone
        // Price (INR) -> price

        $name = $row['car_name'] ?? $row['Car Name'] ?? null;
        $email = $row['vehicle_email'] ?? $row['Vehicle Email'] ?? $row['email'] ?? $row['Email'] ?? null;
        $phone = $row['vehicle_phone'] ?? $row['Vehicle Phone'] ?? $row['phone'] ?? $row['Phone'] ?? null;
        $price = $row['price_inr'] ?? $row['Price (INR)'] ?? 0;

        if (!$name) {
            return null;
        }

        return Vehicle::updateOrCreate(
            ['name' => $name, 'user_id' => Auth::id()],
            [
                'email' => $email,
                'phone' => $phone,
                'price' => $price,
            ]
        );
    }
}
