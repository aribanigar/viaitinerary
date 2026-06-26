<?php

namespace App\Http\Controllers;

use App\Models\Vehicle;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        $search = $request->input('search');

        $query = Vehicle::where('user_id', $request->user()->getAdminId())
            ->with('user:id,name,email');

        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        $vehicles = $query->latest()->paginate($perPage);

        return response()->json($vehicles);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'price' => 'required|numeric|min:0',
        ]);

        $data = $validated;
        $data['user_id'] = $request->user()->getAdminId();

        $vehicle = Vehicle::create($data);

        return response()->json($vehicle, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Vehicle $vehicle)
    {
        if ($vehicle->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        return response()->json($vehicle);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Vehicle $vehicle)
    {
        if ($vehicle->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'price' => 'required|numeric|min:0',
        ]);

        $vehicle->update($validated);

        return response()->json($vehicle);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Vehicle $vehicle)
    {
        if ($vehicle->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        $vehicle->delete();
        return response()->json(null, 204);
    }
}
