<?php

namespace App\Traits;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait HandlesBase64Images
{
    /**
     * Decode a Base64 string and save it to the public disk.
     *
     * @param string|null $base64String
     * @param string $folder
     * @return string|null The relative path to the saved file (e.g., 'trips/photo.jpg')
     */
    protected function saveBase64Image(?string $base64String, string $folder): ?string
    {
        if (!$base64String) {
            return null;
        }

        // Match data:image/[type];base64,[data]
        if (!preg_match('/^data:image\/([^;]+);base64,/', $base64String, $matches)) {
            // If it's not a base64 image string, return as is (could be an existing path or URL)
            return $base64String;
        }

        $type = strtolower($matches[1]);
        $data = substr($base64String, strpos($base64String, ',') + 1);

        // Filter valid image types
        $extension = $type;
        if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'])) {
            // If it's a base64 string but not an allowed image type, don't store the raw string in the DB
            return null;
        }

        $data = base64_decode($data);
        if ($data === false) {
            return null;
        }

        $filename = Str::random(40) . '.' . $extension;
        $path = $folder . '/' . $filename;

        Storage::disk('public')->put($path, $data);

        return $path;
    }

    protected function getImageUrl(?string $path): ?string
    {
        if (!$path) return null;
        if (filter_var($path, FILTER_VALIDATE_URL)) return $path;
        return url('/api/storage/' . $path);
    }

    protected function deleteStoredImage(?string $path): void
    {
        if (!$path) {
            return;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return;
        }

        Storage::disk('public')->delete($path);
    }
}
