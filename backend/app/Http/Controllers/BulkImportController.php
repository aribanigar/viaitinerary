<?php

namespace App\Http\Controllers;

use App\Imports\BulkImport;
use App\Exports\BulkExport;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BulkImportController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls'
        ]);

        try {
            Excel::import(new BulkImport, $request->file('file'));
            return response()->json([
                'message' => 'Bulk data imported successfully'
            ], 200);
        } catch (\Exception $e) {
            Log::error('Bulk Import Error: ' . $e->getMessage());
            return response()->json([
                'error' => 'An error occurred during bulk import: ' . $e->getMessage()
            ], 500);
        }
    }

    public function export(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['error' => 'Unauthenticated'], 401);
            }

            $adminId = $user->getAdminId();

            if (ob_get_length()) {
                ob_clean();
            }

            return Excel::download(new BulkExport($adminId), 'agency_data_export.xlsx');
        } catch (\Exception $e) {
            Log::error('Bulk Export Error: ' . $e->getMessage());
            return response()->json([
                'error' => 'An error occurred during bulk export: ' . $e->getMessage()
            ], 500);
        }
    }

    public function downloadTemplate(): BinaryFileResponse|\Illuminate\Http\JsonResponse
    {
        $filePath = storage_path('app/templates/bulk_import_template.xlsx');

        if (!file_exists($filePath)) {
            return response()->json(['error' => 'Template file not found.'], 404);
        }

        return response()->download($filePath, 'bulk_import_template.xlsx');
    }
}
