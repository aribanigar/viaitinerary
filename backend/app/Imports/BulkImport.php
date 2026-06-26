<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class BulkImport implements WithMultipleSheets
{
    public function sheets(): array
    {
        return [
            'Transportation' => new TransportationImport(),
            'Accommodation' => new HotelsImport(),
            'Destinations' => new DestinationsImport(),
        ];
    }
}
