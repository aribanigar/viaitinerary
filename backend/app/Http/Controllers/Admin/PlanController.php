<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PlanController extends Controller
{
    private function normalizeCountry(?string $country): ?string
    {
        if (!$country) {
            return null;
        }

        $normalized = strtoupper(trim($country));
        return $normalized === '' ? null : $normalized;
    }

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(
            Plan::orderByRaw('CASE WHEN country IS NULL THEN 1 ELSE 0 END')
                ->orderBy('country')
                ->orderBy('price')
                ->get()
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string',
            'price' => 'nullable|numeric',
            'original_price' => 'required|numeric',
            'duration_months' => 'required|integer',
            'trip_limit' => 'nullable|integer',
            'features' => 'nullable|array',
            'badge_label' => 'nullable|string',
            'recommended' => 'nullable|boolean',
            'is_active' => 'boolean',
            'country' => 'nullable|string|max:10',
            'is_offer' => 'boolean',
            'offer_starts_at' => 'nullable|date',
            'offer_expires_at' => 'nullable|date',
            'team_member_limit' => 'nullable|integer',
            'offer_image_file' => 'nullable|image|mimes:jpeg,jpg,png,webp|max:2048',
        ]);

        $validated['country'] = $this->normalizeCountry($validated['country'] ?? null);

        if ($request->hasFile('offer_image_file')) {
            $path = $request->file('offer_image_file')->store('offers', 'public');
            // Store ONLY the path (e.g. "offers/filename.png"), NOT the full URL
            $validated['offer_image'] = $path;
        }

        if ($request->has('key')) {
            $validated['key'] = $request->key;
        }

        // If price is not provided, use original_price
        if (empty($validated['price']) && !empty($validated['original_price'])) {
            $validated['price'] = $validated['original_price'];
        }

        // Auto-generate key if not provided
        if (empty($validated['key'])) {
            $validated['key'] = Str::snake(Str::lower($validated['name']));
        }

        // Ensure key is unique
        $originalKey = $validated['key'];
        $count = 1;
        while (Plan::where('key', $validated['key'])->exists()) {
            $validated['key'] = $originalKey . '_' . $count++;
        }

        $plan = Plan::create($validated);
        return response()->json($plan, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Plan $plan)
    {
        return response()->json($plan);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Plan $plan)
    {
        $validated = $request->validate([
            'is_offer' => 'sometimes|boolean',
            'offer_starts_at' => 'nullable|date',
            'offer_expires_at' => 'nullable|date',
            'team_member_limit' => 'nullable|integer',
            'offer_image_file' => 'nullable|image|mimes:jpeg,jpg,png,webp|max:2048',
        ]);

        if ($request->hasFile('offer_image_file')) {
            // Delete old image if exists
            if ($plan->offer_image) {
                // If it was stored as a URL before, extract the path
                $oldPath = str_replace(['/storage/', 'storage/'], '', $plan->getRawOriginal('offer_image'));
                Storage::disk('public')->delete($oldPath);
            }
            $path = $request->file('offer_image_file')->store('offers', 'public');
            // Store ONLY the path (e.g. "offers/filename.png"), NOT the full URL
            $validated['offer_image'] = $path;
        }

        $validated = array_merge($validated, $request->validate([
            'name' => 'sometimes|string',
            'price' => 'nullable|numeric',
            'original_price' => 'sometimes|numeric',
            'duration_months' => 'sometimes|integer',
            'trip_limit' => 'nullable|integer',
            'features' => 'nullable|array',
            'badge_label' => 'nullable|string',
            'recommended' => 'nullable|boolean',
            'is_active' => 'sometimes|boolean',
            'country' => 'nullable|string|max:10',
        ]));

        if ($request->has('country')) {
            $validated['country'] = $this->normalizeCountry($validated['country'] ?? null);
        }

        $plan->update($validated);

        // If price is missing after update (e.g. cleared), default to original_price
        if (empty($plan->price) && !empty($plan->original_price)) {
            $plan->update(['price' => $plan->original_price]);
        }

        return response()->json($plan);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Plan $plan)
    {
        $plan->delete();
        return response()->json(null, 204);
    }
}
