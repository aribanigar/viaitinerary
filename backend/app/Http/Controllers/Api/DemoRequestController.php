<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemoRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DemoRequestController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->query('per_page', 25);
        $demoRequests = DemoRequest::latest()->paginate($perPage);

        return response()->json($demoRequests);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'contact_number' => 'required|string|phone:AUTO',
            'invite_guests' => 'nullable|string|max:255',
            'company_name' => 'required|string|max:255',
            'no_of_employees' => 'required|integer|min:1',
            'agency_type' => 'required|string|max:255',
            'destinations' => 'required|string',
            'processes' => 'required|array',
            'office_location' => 'required|string|max:255',
            'referral_source' => 'required|string|max:255',
            'scheduled_at' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $demoRequest = DemoRequest::create($validator->validated());

            return response()->json([
                'status' => 'success',
                'message' => 'Demo request submitted successfully.',
                'data' => $demoRequest
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to submit demo request.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function updateStatus(Request $request, DemoRequest $demoRequest)
    {
        $request->validate([
            'status' => 'required|in:pending,contacted,completed,cancelled'
        ]);

        $demoRequest->update(['status' => $request->status]);

        return response()->json([
            'status' => 'success',
            'message' => 'Status updated successfully',
            'data' => $demoRequest
        ]);
    }

    public function destroy(DemoRequest $demoRequest)
    {
        $demoRequest->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Demo request deleted successfully'
        ]);
    }
}
