<?php

namespace App\Http\Controllers;

use App\Models\Destination;
use Illuminate\Http\Request;
use App\Traits\HandlesBase64Images;

class DestinationController extends Controller
{
    use HandlesBase64Images;

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        $search = $request->input('search');

        $query = Destination::where('user_id', $request->user()->getAdminId())
            ->with('user:id,name,email') // Include email
            ->select('id', 'user_id', 'name', 'activities', 'image_path');

        if ($search) {
            $query->where('name', 'like', "%{$search}%");
        }

        $destinations = $query->latest()->paginate($perPage);

        return response()->json($destinations);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'activities' => 'required|array',
            'photo' => 'nullable|string', // Base64
        ]);

        $destination = new Destination();
        $destination->user_id = $request->user()->getAdminId();
        $destination->name = $validated['name'];
        $destination->activities = $validated['activities'];

        if ($request->filled('photo')) {
            $destination->image_path = $this->saveBase64Image($request->photo, 'destinations');
        }

        $destination->save();

        return response()->json($destination, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Destination $destination)
    {
        if ($destination->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        return response()->json($destination);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Destination $destination)
    {
        if ($destination->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'activities' => 'required|array',
            'photo' => 'nullable|string', // Base64
        ]);

        $destination->name = $validated['name'];
        $destination->activities = $validated['activities'];

        if ($request->filled('photo')) {
            $destination->image_path = $this->saveBase64Image($request->photo, 'destinations');
        }

        $destination->save();

        return response()->json($destination);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Destination $destination)
    {
        if ($destination->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        $destination->delete();
        return response()->json(null, 204);
    }
}
