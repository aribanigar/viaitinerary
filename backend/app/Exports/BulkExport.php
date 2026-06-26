<?php

namespace App\Exports;

use App\Models\Vehicle;
use App\Models\Hotel;
use App\Models\Destination;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Illuminate\Support\Facades\Auth;

class BulkExport implements WithMultipleSheets
{
    protected $adminId;

    public function __construct($adminId)
    {
        $this->adminId = $adminId;
    }

    public function sheets(): array
    {
        return [
            'Transportation' => new TransportationExport($this->adminId),
            'Accommodation' => new HotelsExport($this->adminId),
            'Destinations' => new DestinationsExport($this->adminId),
        ];
    }
}

class TransportationExport implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings, \Maatwebsite\Excel\Concerns\WithTitle
{
    protected $adminId;

    public function __construct($adminId)
    {
        $this->adminId = $adminId;
    }

    public function collection()
    {
        return Vehicle::where('user_id', $this->adminId)->get()->map(function ($vehicle) {
            return [
                'name' => $vehicle->name,
                'email' => $vehicle->email,
                'phone' => $vehicle->phone,
                'price' => $vehicle->price,
            ];
        });
    }

    public function headings(): array
    {
        return ["Car Name", "Vehicle Email", "Vehicle Phone", "Price (INR)"];
    }

    public function title(): string
    {
        return 'Transportation';
    }
}

class HotelsExport implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings, \Maatwebsite\Excel\Concerns\WithTitle
{
    protected $adminId;

    public function __construct($adminId)
    {
        $this->adminId = $adminId;
    }

    public function collection()
    {
        return Hotel::where('user_id', $this->adminId)->get()->map(function ($hotel) {
            return [
                'name' => $hotel->name,
                'city' => $hotel->city,
                'email' => $hotel->email,
                'phone' => $hotel->phone,
                'price_sections' => is_string($hotel->price_sections) ? $hotel->price_sections : json_encode($hotel->price_sections ?? []),
            ];
        });
    }

    public function headings(): array
    {
        return [
            "Hotel Name",
            "City",
            "Hotel Email",
            "Hotel Phone",
            "Price Sections (JSON)"
        ];
    }

    public function title(): string
    {
        return 'Accommodation';
    }
}

class DestinationsExport implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings, \Maatwebsite\Excel\Concerns\WithTitle
{
    protected $adminId;

    public function __construct($adminId)
    {
        $this->adminId = $adminId;
    }

    public function collection()
    {
        return Destination::where('user_id', $this->adminId)->get()->map(function ($dest) {
            return [
                'name' => $dest->name,
                'activities' => is_array($dest->activities) ? implode(', ', $dest->activities) : $dest->activities,
            ];
        });
    }

    public function headings(): array
    {
        return ["Destination Name", "Activities"];
    }

    public function title(): string
    {
        return 'Destinations';
    }
}
