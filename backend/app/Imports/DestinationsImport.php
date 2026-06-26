<?php

namespace App\Imports;

use App\Models\Destination;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Illuminate\Support\Facades\Auth;

class DestinationsImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    public function model(array $row)
    {
        // Destination Name -> name
        // Activities -> activities

        $name = $row['destination_name'] ?? $row['Destination Name'] ?? null;
        $activities_str = $row['activities'] ?? $row['Activities'] ?? '';
        $activities = is_array($activities_str) ? $activities_str : (empty($activities_str) ? [] : array_map('trim', explode(',', $activities_str)));

        if (!$name) {
            return null;
        }

        return Destination::updateOrCreate(
            ['name' => $name],
            [
                'activities' => $activities,
                'user_id' => Auth::id(),
            ]
        );
    }
}
