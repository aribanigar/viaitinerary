<?php

namespace App\Http\Controllers;

use App\Models\ShowcaseItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Traits\HandlesBase64Images;

class ShowcaseItemController extends Controller
{
    use HandlesBase64Images;

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = ShowcaseItem::query();

        // If 'all' parameter is provided, return all items regardless of status
        // This is typically used by the admin panel
        if (!$request->has('active_only')) {
            $query->orderBy('sort_order', 'asc');
        } else {
            $query->where('is_active', true)->orderBy('sort_order', 'asc');
        }

        return $query->get();
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'city' => 'required|string',
            'title' => 'required|string',
            'agency_name' => 'nullable|string',
            'whatsapp_number' => 'required|phone:AUTO',
            'price' => 'required|numeric',
            'image' => 'nullable|string', // Expecting Base64
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'integer',
        ]);

        if ($request->filled('image')) {
            $validated['image'] = $this->saveBase64Image($request->image, 'showcase');
        }

        return ShowcaseItem::create($validated);
    }

    /**
     * Display the specified resource.
     */
    public function show(ShowcaseItem $showcaseItem)
    {
        return $showcaseItem;
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, ShowcaseItem $showcaseItem)
    {
        $validated = $request->validate([
            'city' => 'string',
            'title' => 'string',
            'agency_name' => 'nullable|string',
            'whatsapp_number' => 'required|phone:AUTO',
            'price' => 'numeric',
            'image' => 'nullable|string', // Expecting Base64 or existing path
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'integer',
        ]);

        if ($request->filled('image')) {
            // saveBase64Image trait handles checking if it's already a URL or needs saving
            $newImagePath = $this->saveBase64Image($request->image, 'showcase');

            // If it's a new image and we had an old one on local storage, delete the old one
            if ($newImagePath !== $showcaseItem->image && $showcaseItem->image && !filter_var($showcaseItem->image, FILTER_VALIDATE_URL)) {
                Storage::disk('public')->delete($showcaseItem->image);
            }

            $validated['image'] = $newImagePath;
        }

        $showcaseItem->update($validated);

        return $showcaseItem;
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(ShowcaseItem $showcaseItem)
    {
        if ($showcaseItem->image && !filter_var($showcaseItem->image, FILTER_VALIDATE_URL)) {
            Storage::disk('public')->delete($showcaseItem->image);
        }
        $showcaseItem->delete();

        return response()->noContent();
    }
}
