<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\File;

class ReactController extends Controller
{
    public function index()
    {
        // Try multiple potential paths for index.html based on development vs production layout
        $paths = [
            realpath(__DIR__ . '/../../../frontend/dist/index.html'), // Local dev
            realpath(base_path('../public_html/index.html')),           // Production
            realpath(base_path('public/index.html')),                   // Flat structure
        ];

        foreach ($paths as $path) {
            if ($path && file_exists($path)) {
                return file_get_contents($path);
            }
        }

        // Detailed error message if not found
        $tried = implode(", ", array_map(fn($p) => $p ?: 'invalid-path', $paths));
        return response("React index.html not found. Tried paths: " . $tried, 404);
    }
}
