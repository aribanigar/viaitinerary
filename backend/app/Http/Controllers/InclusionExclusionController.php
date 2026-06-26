<?php

namespace App\Http\Controllers;

use App\Models\InclusionExclusion;
use Illuminate\Http\Request;

class InclusionExclusionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $items = InclusionExclusion::where('user_id', $request->user()->getAdminId())
            ->orderBy('type')
            ->orderBy('sort_order')
            ->get()
            ->groupBy('type');

        return response()->json($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $adminId = $request->user()->getAdminId();
        $validated = $request->validate([
            'type' => 'required|in:inclusion,exclusion',
            'content' => 'required|string',
        ]);

        $maxSortOrder = InclusionExclusion::where('user_id', $adminId)
            ->where('type', $validated['type'])
            ->max('sort_order') ?? 0;

        $item = InclusionExclusion::create([
            'user_id' => $adminId,
            'type' => $validated['type'],
            'content' => $validated['content'],
            'sort_order' => $maxSortOrder + 1,
        ]);

        return response()->json($item, 201);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, InclusionExclusion $inclusionExclusion)
    {
        if ($inclusionExclusion->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'content' => 'required|string',
            'sort_order' => 'nullable|integer',
        ]);

        $inclusionExclusion->update($validated);

        return response()->json($inclusionExclusion);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, InclusionExclusion $inclusionExclusion)
    {
        if ($inclusionExclusion->user_id !== $request->user()->getAdminId()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $inclusionExclusion->delete();

        return response()->json(['message' => 'Deleted successfully']);
    }
}
