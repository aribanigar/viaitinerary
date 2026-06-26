<?php

namespace App\Http\Controllers;

use App\Models\Calculation;
use App\Models\AgencySetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;

class CalculationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        return Calculation::with(['user' => function ($query) {
            $query->select('id', 'name', 'email');
        }])
            ->select('id', 'user_id', 'client_name', 'total_cost', 'created_at')
            ->where('user_id', Auth::id())
            ->latest()
            ->paginate($perPage);
    }

    /**
     * Download a PDF generation of the resource.
     */
    public function downloadPdf(string $id)
    {
        $calculation = Calculation::where('id', $id)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $user = Auth::user();
        $adminId = $user->getAdminId();
        $agencySettings = AgencySetting::where('user_id', $adminId)->first();

        // Convert logo to Base64 for DomPDF consistency on production
        $logoBase64 = null;
        if ($agencySettings && $agencySettings->logo_path) {
            $path = storage_path('app/public/' . $agencySettings->logo_path);
            if (file_exists($path)) {
                $type = pathinfo($path, PATHINFO_EXTENSION);
                $data = @file_get_contents($path);
                if ($data !== false) {
                    $logoBase64 = 'data:image/' . $type . ';base64,' . base64_encode($data);
                }
            }
        }

        $pdf = Pdf::setOptions([
            'isHtml5ParserEnabled' => true,
            'isRemoteEnabled' => true,
            'fontDir' => storage_path('fonts'),
            'fontCache' => storage_path('fonts'),
        ])
            ->loadView('pdf.calculation', [
                'calculation' => $calculation,
                'agencySettings' => $agencySettings,
                'user' => $user,
                'logoBase64' => $logoBase64
            ]);

        return $pdf->download("Pricing-Sheet-{$calculation->client_name}.pdf");
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'client_name' => 'required|string|max:255',
            'selected_hotels' => 'nullable|array',
            'selected_vehicles' => 'nullable|array',
            'other_costs' => 'nullable|array',
            'gst_percentage' => 'nullable|numeric',
            'profit_margin_percentage' => 'nullable|numeric',
            'total_cost' => 'required|numeric',
        ]);

        $calculation = Calculation::create([
            'user_id' => Auth::id(),
            'client_name' => $validated['client_name'],
            'selected_hotels' => $validated['selected_hotels'] ?? [],
            'selected_vehicles' => $validated['selected_vehicles'] ?? [],
            'other_costs' => $validated['other_costs'] ?? [],
            'gst_percentage' => $validated['gst_percentage'] ?? 0,
            'profit_margin_percentage' => $validated['profit_margin_percentage'] ?? 0,
            'total_cost' => $validated['total_cost'],
        ]);

        return response()->json($calculation, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        return Calculation::with('user')->findOrFail($id);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $calculation = Calculation::findOrFail($id);

        $validated = $request->validate([
            'client_name' => 'sometimes|string|max:255',
            'selected_hotels' => 'sometimes|array',
            'selected_vehicles' => 'sometimes|array',
            'other_costs' => 'sometimes|array',
            'gst_percentage' => 'sometimes|numeric',
            'profit_margin_percentage' => 'sometimes|numeric',
            'total_cost' => 'sometimes|numeric',
        ]);

        $calculation->update($validated);

        return response()->json($calculation);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        Calculation::destroy($id);
        return response()->json(null, 204);
    }
}
