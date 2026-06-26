<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Imports\LeadInquiriesImport;
use App\Mail\NewLeadInquiryMail;
use App\Models\Trip;
use App\Models\LeadInquiry;
use App\Models\Team;
use App\Models\User;
use App\Notifications\LeadAssignedNotification;
use App\Notifications\NewLeadArrivedNotification;
use App\Support\AgencyMailer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class LeadInquiryController extends Controller
{
    /**
     * Display a listing of lead inquiries for the authenticated user.
     */
    public function index(Request $request)
    {
        $query = LeadInquiry::where('user_id', $request->user()->getAdminId())
            ->with(['assignee:id,name,email'])
            ->orderBy('created_at', 'desc');

        // Apply filters if provided
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('created_at', [
                $request->start_date,
                $request->end_date
            ]);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('client_name', 'like', $like)
                    ->orWhere('client_email', 'like', $like)
                    ->orWhere('client_phone', 'like', $like)
                    ->orWhere('destination', 'like', $like)
                    ->orWhere('inquiry_id', 'like', $like);
            });
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $like = '%' . $search . '%';
            $query->where(function ($q) use ($like) {
                $q->where('client_name', 'like', $like)
                    ->orWhere('client_email', 'like', $like)
                    ->orWhere('destination', 'like', $like)
                    ->orWhere('inquiry_id', 'like', $like);
            });
        }

        $inquiries = $query->paginate($request->per_page ?? 25);

        return response()->json($inquiries);
    }

    /**
     * Store a new lead inquiry manually by an admin.
     */
    public function storeManual(Request $request)
    {
        $adminId = $request->user()->getAdminId();

        $validated = $request->validate([
            'client_name'        => 'required|string|max:255',
            'client_email'       => 'required|email|max:255',
            'client_phone'       => 'nullable|string|max:20',
            'destination'        => 'required|string|max:255',
            'adults'             => 'nullable|integer|min:1',
            'kids_cnb'        => 'nullable|integer|min:0',
            'kids_5_to_12'       => 'nullable|integer|min:0',
            'start_date'         => 'nullable|date',
            'duration'           => 'nullable|integer|min:1|max:365',
            'approximate_budget' => 'nullable|numeric|min:0',
            'currency'           => 'nullable|string|max:50',
            'special_requests'   => 'nullable|string|max:2000',
            'status'             => 'nullable|string|in:new,contacted,quoted,converted,closed',
            'notes'              => 'nullable|string|max:2000',
        ]);

        $inquiry = LeadInquiry::create([
            'inquiry_id'         => LeadInquiry::generateInquiryId(),
            'user_id'            => $adminId,
            'client_name'        => $validated['client_name'],
            'client_email'       => $validated['client_email'],
            'client_phone'       => $validated['client_phone'] ?? null,
            'destination'        => $validated['destination'],
            'adults'             => $validated['adults'] ?? 1,
            'kids_cnb'        => $validated['kids_cnb'] ?? 0,
            'kids_5_to_12'       => $validated['kids_5_to_12'] ?? 0,
            'start_date'         => $validated['start_date'] ?? null,
            'duration'           => $validated['duration'] ?? null,
            'approximate_budget' => $validated['approximate_budget'] ?? null,
            'currency'           => $validated['currency'] ?? 'INR (₹)',
            'special_requests'   => $validated['special_requests'] ?? null,
            'status'             => $validated['status'] ?? 'new',
            'notes'              => $validated['notes'] ?? null,
            'is_public'          => false,
            'assigned_to'        => $request->user()->id, // Assign to the person who created it
        ]);

        $this->notifyAdminOfNewLead($adminId, $inquiry, 'Manual Entry');

        return response()->json([
            'message' => 'Lead inquiry created successfully.',
            'inquiry' => $inquiry,
        ], 201);
    }

    /**
     * Bulk import lead inquiries from an Excel file.
     */
    public function importBulk(Request $request)
    {
        if (!in_array($request->user()->role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'Only admin can import leads.'], 403);
        }

        $request->validate([
            'file' => 'required|mimes:xlsx,xls',
        ]);

        $adminId = $request->user()->getAdminId();

        try {
            Excel::import(
                new LeadInquiriesImport($adminId, $request->user()->id),
                $request->file('file')
            );

            return response()->json([
                'message' => 'Lead inquiries imported successfully.',
            ]);
        } catch (\Exception $e) {
            Log::error('Lead bulk import error: ' . $e->getMessage());

            return response()->json([
                'message' => 'Failed to import lead inquiries.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a new trip inquiry from public form (no authentication required).
     *
     * $identifier may be a UUID embed_token (new embeds) or a numeric user id
     * (legacy embeds already embedded on customer websites).
     */
    public function store(Request $request, string $identifier)
    {
        // --- Honeypot: bots fill hidden fields; humans leave them blank ----------
        if ($request->filled('website')) {
            // Silently succeed so bots get no useful signal
            return response()->json([
                'message' => 'Your trip inquiry has been submitted successfully! The agency will contact you soon.',
                'inquiry_id' => 'INQ000000',
            ], 201);
        }

        // --- Agency lookup: support UUID token (new) and numeric ID (legacy) ----
        $isUuid = (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
            $identifier
        );

        $agencyQuery = User::where('role', 'admin')->where('status', 'active');

        if ($isUuid) {
            $agencyQuery->where('embed_token', $identifier);
        } else {
            $agencyQuery->where('id', (int) $identifier);
        }

        $agency = $agencyQuery->first();

        if (!$agency) {
            return response()->json([
                'message' => 'Invalid agency or agency is not active.',
            ], 404);
        }

        // --- Validate the inquiry data ----------------------------------------
        $validated = $request->validate([
            'clientName'        => 'required|string|max:255',
            'clientEmail'       => 'required|email|max:255',
            'clientPhone'       => [
                'required',
                'string',
                'phone:AUTO',
            ],
            'destination'       => 'required|string|max:255',
            'adults'            => 'nullable|integer|min:1',
            'kidsUpto5'         => 'nullable|integer|min:0',
            'kids5to12'         => 'nullable|integer|min:0',
            'startDate'         => 'required|date|after_or_equal:today',
            'duration'          => 'required|integer|min:1|max:365',
            'approximateBudget' => 'nullable|numeric|min:0',
            'currency'          => 'nullable|string|max:50',
            'specialRequests'   => 'nullable|string|max:2000',
        ]);

        // --- Duplicate prevention: same email + agency within last 2 minutes ----
        $existing = LeadInquiry::where('user_id', $agency->id)
            ->where('client_email', $validated['clientEmail'])
            ->where('created_at', '>=', now()->subMinutes(2))
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'Your trip inquiry has been submitted successfully! The agency will contact you soon.',
                'inquiry_id' => $existing->inquiry_id,
            ], 201);
        }

        // --- Create the inquiry -----------------------------------------------
        $inquiry = LeadInquiry::create([
            'inquiry_id'         => LeadInquiry::generateInquiryId(),
            'user_id'            => $agency->id,
            'client_name'        => $validated['clientName'],
            'client_email'       => $validated['clientEmail'],
            'client_phone'       => $validated['clientPhone'],
            'destination'        => $validated['destination'],
            'adults'             => $validated['adults'] ?? 1,
            'kids_cnb'        => $validated['kidsUpto5'] ?? 0,
            'kids_5_to_12'       => $validated['kids5to12'] ?? 0,
            'start_date'         => $validated['startDate'],
            'duration'           => $validated['duration'],
            'approximate_budget' => $validated['approximateBudget'] ?? null,
            'currency'           => $validated['currency'] ?? 'INR (₹)',
            'special_requests'   => $validated['specialRequests'] ?? null,
            'status'             => 'new',
            'source_url'         => $request->header('Referer'),
            'ip_address'         => $request->ip(),
        ]);

        $this->notifyAdminOfNewLead($agency->id, $inquiry, 'Website Form');

        // Queue email notification to agency owner (non-blocking)
        try {
            [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($agency->id);
            Mail::mailer($mailer)->to($agency->email)->queue(new NewLeadInquiryMail($inquiry, $agency, $fromEmail, $fromName));
        } catch (\Exception $e) {
            Log::error('Failed to queue trip inquiry email: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Your trip inquiry has been submitted successfully! The agency will contact you soon.',
            'inquiry_id' => $inquiry->inquiry_id,
        ], 201);
    }

    /**
     * Update an inquiry's status and notes.
     */
    public function update(Request $request, $id)
    {
        $adminId = $request->user()->getAdminId();

        $inquiry = LeadInquiry::where('id', $id)
            ->where('user_id', $adminId)
            ->firstOrFail();

        $previousAssignedTo = $inquiry->assigned_to;

        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['new', 'contacted', 'quoted', 'converted', 'closed'])],
            'notes' => 'nullable|string|max:2000',
            'assigned_to' => 'nullable|integer',
        ]);

        if (isset($validated['status'])) {
            $inquiry->status = $validated['status'];
        }

        if (isset($validated['notes'])) {
            $inquiry->notes = $validated['notes'];
        }

        if (array_key_exists('assigned_to', $validated)) {
            $isConverted = $inquiry->status === 'converted' || (($validated['status'] ?? null) === 'converted');

            if ($isConverted) {
                throw ValidationException::withMessages([
                    'assigned_to' => ['Converted leads cannot be reassigned.'],
                ]);
            }

            $assignableUserIds = Team::where('created_by', $adminId)
                ->where('is_active', true)
                ->pluck('user_id')
                ->unique()
                ->values();

            if ($validated['assigned_to'] !== null && !$assignableUserIds->contains((int) $validated['assigned_to'])) {
                throw ValidationException::withMessages([
                    'assigned_to' => ['Selected assignee is not valid for your team.'],
                ]);
            }

            $inquiry->assigned_to = $validated['assigned_to'];
        }

        $inquiry->save();
        $inquiry->load('assignee:id,name,email');

        if (array_key_exists('assigned_to', $validated)) {
            $newAssignedTo = $validated['assigned_to'];

            if ($newAssignedTo !== null && (int) $previousAssignedTo !== (int) $newAssignedTo) {
                $assignee = User::where('id', $newAssignedTo)->first();
                if ($assignee) {
                    $assignee->notify(new LeadAssignedNotification($inquiry));
                }
            }
        }

        return response()->json([
            'message' => 'Inquiry updated successfully.',
            'inquiry' => $inquiry,
        ]);
    }

    /**
     * Get assignable members for lead ownership.
     */
    public function assignableMembers(Request $request)
    {
        $adminId = $request->user()->getAdminId();

        $memberIds = Team::where('created_by', $adminId)
            ->where('is_active', true)
            ->pluck('user_id')
            ->unique()
            ->values();

        $members = User::whereIn('id', $memberIds)
            ->select('id', 'name', 'email', 'role')
            ->orderBy('name')
            ->get();

        return response()->json([
            'members' => $members,
            'admin_id' => $adminId,
        ]);
    }

    /**
     * Delete an inquiry.
     */
    public function destroy(Request $request, $id)
    {
        $inquiry = LeadInquiry::where('id', $id)
            ->where('user_id', $request->user()->getAdminId())
            ->firstOrFail();

        $inquiry->delete();

        return response()->json([
            'message' => 'Inquiry deleted successfully.',
        ]);
    }

    /**
     * Convert an inquiry to a trip.
     */
    public function convertToTrip(Request $request, $id)
    {
        $inquiry = LeadInquiry::where('id', $id)
            ->where('user_id', $request->user()->getAdminId())
            ->firstOrFail();

        // Check if already converted
        if ($inquiry->status === 'converted') {
            return response()->json([
                'message' => 'This inquiry has already been converted to a trip.',
            ], 400);
        }

        // Get the admin user
        $admin = $request->user();
        $adminId = $admin->getAdminId();

        // Create a new trip from the inquiry
        $trip = new Trip();
        $trip->user_id = $adminId;
        $trip->team_id = $admin->getTeamId();

        // Collision-safe trip ID generation
        do {
            $tripId = 'TRP' . mt_rand(100000, 999999);
        } while (Trip::where('trip_id', $tripId)->exists());
        $trip->trip_id = $tripId;

        $trip->trip_title = $inquiry->destination . ' Trip for ' . $inquiry->client_name;
        $trip->destination = $inquiry->destination;
        $trip->client_name = $inquiry->client_name;
        $trip->client_email = $inquiry->client_email;
        $trip->client_phone = $inquiry->client_phone;
        $trip->adults = $inquiry->adults ?? 1;
        $trip->kids_cnb = $inquiry->kids_cnb ?? $inquiry->kids_upto_5 ?? 0;
        $trip->kids_5_to_12 = $inquiry->kids_5_to_12 ?? 0;
        $trip->start_date = $inquiry->start_date;
        $trip->duration = $inquiry->duration ?? '2';
        $trip->cost = $inquiry->approximate_budget ?? 0;
        $trip->currency = $inquiry->currency ?? 'INR (₹)';
        $trip->status = 'draft';
        $trip->template = 'ModernTemplate';
        $trip->slug = Str::slug($trip->trip_title . '-' . Str::random(6));

        $trip->save();

        // Update inquiry status to converted
        $inquiry->status = 'converted';
        $inquiry->save();

        return response()->json([
            'message' => 'Inquiry converted to trip successfully.',
            'trip_id' => $trip->trip_id,
            'trip' => $trip,
        ], 201);
    }

    /**
     * Store a public trip inquiry (no agency, goes to super admin).
     */
    public function storePublic(Request $request)
    {
        // Honeypot check
        if ($request->filled('website')) {
            return response()->json([
                'message' => 'Your trip inquiry has been submitted successfully! We will contact you soon.',
                'inquiry_id' => 'INQ000000',
            ], 201);
        }

        // Find the super admin user
        $superAdmin = User::where('role', 'super_admin')->first();

        if (!$superAdmin) {
            return response()->json([
                'message' => 'System configuration error. Please contact support.'
            ], 500);
        }

        // Validate the inquiry data — phone rules kept consistent with store()
        $validated = $request->validate([
            'clientName'        => 'required|string|max:255',
            'clientEmail'       => 'required|email|max:255',
            'clientPhone'       => [
                'required',
                'string',
                'max:20',
                'regex:/^([0-9\s\-\+\(\)]+)$/',
            ],
            'destination'       => 'required|string|max:255',
            'adults'            => 'required|integer|min:1',
            'kidsUpto5'         => 'nullable|integer|min:0',
            'kids5to12'         => 'nullable|integer|min:0',
            'startDate'         => 'required|date|after_or_equal:today',
            'duration'          => 'required|integer|min:1|max:365',
            'approximateBudget' => 'nullable|numeric|min:0',
            'currency'          => 'nullable|string|max:50',
            'specialRequests'   => 'nullable|string|max:2000',
        ]);

        // Create the inquiry assigned to super admin
        $inquiry = LeadInquiry::create([
            'inquiry_id'         => LeadInquiry::generateInquiryId(),
            'user_id'            => $superAdmin->id,
            'client_name'        => $validated['clientName'],
            'client_email'       => $validated['clientEmail'],
            'client_phone'       => $validated['clientPhone'],
            'destination'        => $validated['destination'],
            'adults'             => $validated['adults'] ?? 1,
            'kids_cnb'        => $validated['kidsUpto5'] ?? 0,
            'kids_5_to_12'       => $validated['kids5to12'] ?? 0,
            'start_date'         => $validated['startDate'],
            'duration'           => $validated['duration'],
            'approximate_budget' => $validated['approximateBudget'] ?? null,
            'currency'           => $validated['currency'] ?? 'INR (₹)',
            'special_requests'   => $validated['specialRequests'] ?? null,
            'status'             => 'new',
            'source_url'         => $request->header('Referer'),
            'ip_address'         => $request->ip(),
            'is_public'          => true,
        ]);

        $this->notifyAdminOfNewLead($superAdmin->id, $inquiry, 'Public Inquiry');

        return response()->json([
            'message' => 'Your trip inquiry has been submitted successfully! We will contact you soon.',
            'inquiry_id' => $inquiry->inquiry_id,
        ], 201);
    }

    /**
     * Get all public inquiries (for super admin).
     */
    public function publicInquiries(Request $request)
    {
        $query = LeadInquiry::where('is_public', true)
            ->with('user')
            ->orderBy('created_at', 'desc');

        // Apply filters if provided
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->has('assigned') && $request->assigned !== 'all') {
            if ($request->assigned === 'unassigned') {
                $query->whereNull('assigned_to');
            } else {
                $query->whereNotNull('assigned_to');
            }
        }

        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('created_at', [
                $request->start_date,
                $request->end_date
            ]);
        }

        $inquiries = $query->paginate($request->per_page ?? 25);

        return response()->json($inquiries);
    }

    /**
     * Assign a public inquiry to an admin.
     */
    public function assignInquiry(Request $request, $id)
    {
        $inquiry = LeadInquiry::where('id', $id)
            ->where('is_public', true)
            ->firstOrFail();

        $validated = $request->validate([
            'admin_id' => 'required|exists:users,id',
        ]);

        // Verify the target is an admin
        $admin = User::where('id', $validated['admin_id'])
            ->where('role', 'admin')
            ->firstOrFail();

        // Update the inquiry
        $inquiry->assigned_to = $admin->id;
        $inquiry->user_id = $admin->id;  // Transfer ownership to the admin
        $inquiry->is_public = false;  // Mark as no longer public
        $inquiry->save();

        // Queue email notification to the admin (non-blocking)
        try {
            [$mailer, $fromEmail, $fromName] = AgencyMailer::configureForAdminId($admin->id);
            Mail::mailer($mailer)->to($admin->email)->queue(new NewLeadInquiryMail($inquiry, $admin, $fromEmail, $fromName));
        } catch (\Exception $e) {
            Log::error('Failed to queue inquiry assignment email: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Inquiry assigned successfully.',
            'inquiry' => $inquiry,
        ]);
    }

    private function notifyAdminOfNewLead(int $adminId, LeadInquiry $inquiry, string $source): void
    {
        $admin = User::where('id', $adminId)->first();
        if ($admin) {
            $admin->notify(new NewLeadArrivedNotification($inquiry, $source));
        }
    }
}
