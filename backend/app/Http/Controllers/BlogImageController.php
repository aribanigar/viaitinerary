<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BlogImageController extends Controller
{
    /**
     * Upload a blog image
     */
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'image' => 'required|file|mimes:jpeg,jpg,png,webp|max:5120',
            'type' => 'nullable|in:featured,content,og',
        ]);

        $type = $request->input('type', 'content');
        $file = $request->file('image');

        // Generate unique filename
        $filename = Str::random(40) . '.' . $file->getClientOriginalExtension();
        $path = "blog/{$type}/" . $filename;

        // Store in public disk
        Storage::disk('public')->put($path, file_get_contents($file));

        // Return URL for editor insertion
        return response()->json([
            'url' => url('/api/storage/' . $path),
            'path' => $path,
        ], 201);
    }

    /**
     * Delete a blog image
     */
    public function destroy(Request $request)
    {
        $validated = $request->validate([
            'path' => 'required|string',
        ]);

        $path = $request->input('path');

        // Security: Only allow deletion from blog folder
        if (!str_starts_with($path, 'blog/')) {
            return response()->json(['error' => 'Invalid path'], 400);
        }

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
            return response()->json(['message' => 'Image deleted'], 200);
        }

        return response()->json(['error' => 'Image not found'], 404);
    }
}
