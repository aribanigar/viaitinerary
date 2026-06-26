<?php

namespace App\Http\Controllers;

use App\Models\Hotel;
use Illuminate\Http\Request;
use App\Traits\HandlesBase64Images;

class HotelController extends Controller
{
    use HandlesBase64Images;

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);
        $search = $request->input('search');

        $query = Hotel::where('user_id', $request->user()->getAdminId())
            ->with('user:id,name,email')
            ->select(
                'id',
                'user_id',
                'name',
                'city',
                'email',
                'phone',
                'price_sections',
                'image_path'
            );

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%");
            });
        }

        $hotels = $query->latest()->paginate($perPage);

        return response()->json($hotels);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'city' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|phone:AUTO',
            'price_sections' => 'nullable|array',
            'photo' => 'nullable|string', // Base64
        ]);

        $hotel = new Hotel();
        $hotel->user_id = $request->user()->getAdminId();
        $hotel->name = $validated['name'];
        $hotel->city = $validated['city'];
        $hotel->email = $validated['email'] ?? null;
        $hotel->phone = $validated['phone'] ?? null;
        $hotel->price_sections = $validated['price_sections'] ?? [];

        if ($request->filled('photo')) {
            $hotel->image_path = $this->saveBase64Image($request->photo, 'hotels');
        }

        $hotel->save();

        return response()->json($hotel, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Hotel $hotel)
    {
        if ($hotel->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        return response()->json($hotel);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Hotel $hotel)
    {
        if ($hotel->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'city' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|phone:AUTO',
            'price_sections' => 'nullable|array',
            'photo' => 'nullable|string', // Base64
        ]);

        $hotel->name = $validated['name'];
        $hotel->city = $validated['city'];
        $hotel->email = $validated['email'] ?? null;
        $hotel->phone = $validated['phone'] ?? null;
        $hotel->price_sections = $validated['price_sections'] ?? [];

        if ($request->filled('photo')) {
            $hotel->image_path = $this->saveBase64Image($request->photo, 'hotels');
        }

        $hotel->save();

        return response()->json($hotel);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Hotel $hotel)
    {
        if ($hotel->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        $hotel->delete();
        return response()->json(null, 204);
    }
}
