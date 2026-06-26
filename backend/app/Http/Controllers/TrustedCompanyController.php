<?php

namespace App\Http\Controllers;

use App\Models\TrustedCompany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TrustedCompanyController extends Controller
{
    public function index(Request $request)
    {
        $query = TrustedCompany::query();

        if ($request->has('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $companies = $query->latest()->paginate($request->get('per_page', 25));

        return response()->json($companies);
    }

    public function publicIndex()
    {
        $companies = TrustedCompany::where('is_active', true)->get();
        return response()->json($companies);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'logo' => 'required|image|mimes:jpeg,jpg,png,webp|max:2048',
            'is_active' => 'boolean'
        ]);

        $path = $request->file('logo')->store('trusted-companies', 'public');

        $company = TrustedCompany::create([
            'name' => $request->name,
            'logo_path' => $path,
            'is_active' => $request->get('is_active', true),
        ]);

        return response()->json($company, 201);
    }

    public function show(TrustedCompany $trustedCompany)
    {
        return response()->json($trustedCompany);
    }

    public function update(Request $request, TrustedCompany $trustedCompany)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'logo' => 'nullable|image|mimes:jpeg,jpg,png,webp|max:2048',
            'is_active' => 'boolean'
        ]);

        if ($request->hasFile('logo')) {
            // Delete old logo
            if ($trustedCompany->logo_path) {
                Storage::disk('public')->delete($trustedCompany->logo_path);
            }
            $trustedCompany->logo_path = $request->file('logo')->store('trusted-companies', 'public');
        }

        $trustedCompany->name = $request->name;
        $trustedCompany->is_active = $request->get('is_active', $trustedCompany->is_active);
        $trustedCompany->save();

        return response()->json($trustedCompany);
    }

    public function destroy(TrustedCompany $trustedCompany)
    {
        if ($trustedCompany->logo_path) {
            Storage::disk('public')->delete($trustedCompany->logo_path);
        }
        $trustedCompany->delete();
        return response()->json(null, 204);
    }
}
