<?php

namespace App\Http\Controllers;

use App\Models\AccountingObligation;
use App\Models\AccountingSettlement;
use App\Models\Trip;
use App\Services\AccountingLedgerService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AccountingLedgerController extends Controller
{
    public function __construct(private AccountingLedgerService $ledgerService) {}

    public function index(Request $request)
    {
        if (!$this->ledgerService->isReady()) {
            return response()->json([
                'message' => 'Accounting tables are not available yet. Please run migrations first.',
                'data' => [],
            ], 503);
        }

        $adminId = (int) $request->user()->getAdminId();
        $teamId = $request->user()->getTeamId();

        $perPage = min((int) $request->input('per_page', 25), 500);
        $status = $request->input('status');
        $query = trim((string) $request->input('query', ''));

        $tripPage = Trip::query()
            ->select(['id', 'trip_id', 'trip_title', 'client_name', 'start_date', 'status', 'currency', 'cost', 'paid_amount'])
            ->when($query !== '', function (Builder $builder) use ($query) {
                $builder->where(function (Builder $q) use ($query) {
                    $q->where('trip_id', 'like', '%' . $query . '%')
                        ->orWhere('trip_title', 'like', '%' . $query . '%')
                        ->orWhere('client_name', 'like', '%' . $query . '%');
                });
            })
            ->latest('updated_at')
            ->paginate($perPage);

        $trips = collect($tripPage->items());

        foreach ($trips as $trip) {
            $this->ledgerService->syncTrip($trip, $adminId, $teamId);
        }

        $tripIds = $trips->pluck('id')->values()->all();

        $totalsByTrip = AccountingObligation::query()
            ->selectRaw("trip_id,
                SUM(CASE WHEN direction = 'receivable' THEN expected_amount ELSE 0 END) as receivable_expected,
                SUM(CASE WHEN direction = 'receivable' THEN settled_amount ELSE 0 END) as receivable_settled,
                SUM(CASE WHEN direction = 'payable' AND party_type = 'hotel' THEN expected_amount ELSE 0 END) as hotel_expected,
                SUM(CASE WHEN direction = 'payable' AND party_type = 'hotel' THEN settled_amount ELSE 0 END) as hotel_settled,
                SUM(CASE WHEN direction = 'payable' AND party_type = 'cab' THEN expected_amount ELSE 0 END) as cab_expected,
                SUM(CASE WHEN direction = 'payable' AND party_type = 'cab' THEN settled_amount ELSE 0 END) as cab_settled,
                SUM(CASE WHEN direction = 'payable' THEN expected_amount ELSE 0 END) as payable_expected,
                SUM(CASE WHEN direction = 'payable' THEN settled_amount ELSE 0 END) as payable_settled")
            ->whereIn('trip_id', $tripIds)
            ->groupBy('trip_id')
            ->get()
            ->keyBy('trip_id');

        $receivableByTrip = AccountingObligation::query()
            ->whereIn('trip_id', $tripIds)
            ->where('direction', 'receivable')
            ->where('source_type', 'trip')
            ->get()
            ->keyBy('trip_id');

        $rows = $trips->map(function (Trip $trip) use ($totalsByTrip, $receivableByTrip, $status) {
            $totals = $totalsByTrip->get($trip->id);
            $receivable = $receivableByTrip->get($trip->id);

            if ($receivable && $status && $receivable->status !== $status) {
                return null;
            }

            $receivableExpected = (float) ($totals->receivable_expected ?? $receivable->expected_amount ?? 0);
            $receivableSettled = (float) ($totals->receivable_settled ?? $receivable->settled_amount ?? 0);
            $hotelExpected = (float) ($totals->hotel_expected ?? 0);
            $hotelSettled = (float) ($totals->hotel_settled ?? 0);
            $cabExpected = (float) ($totals->cab_expected ?? 0);
            $cabSettled = (float) ($totals->cab_settled ?? 0);
            $payableExpected = (float) ($totals->payable_expected ?? 0);
            $payableSettled = (float) ($totals->payable_settled ?? 0);

            return [
                'trip_id' => $trip->trip_id,
                'trip_title' => $trip->trip_title,
                'client_name' => $trip->client_name,
                'status' => $trip->status,
                'start_date' => $trip->start_date,
                'currency' => $trip->currency,
                'receivable_expected' => $receivableExpected,
                'receivable_settled' => $receivableSettled,
                'receivable_remaining' => max(0, $receivableExpected - $receivableSettled),
                'hotel_expected' => $hotelExpected,
                'hotel_settled' => $hotelSettled,
                'hotel_remaining' => max(0, $hotelExpected - $hotelSettled),
                'cab_expected' => $cabExpected,
                'cab_settled' => $cabSettled,
                'cab_remaining' => max(0, $cabExpected - $cabSettled),
                'payable_expected' => $payableExpected,
                'payable_settled' => $payableSettled,
                'payable_remaining' => max(0, $payableExpected - $payableSettled),
                'net_position' => max(0, $receivableExpected - $receivableSettled) - max(0, $payableExpected - $payableSettled),
            ];
        })->filter()->values();

        return response()->json([
            'data' => $rows,
            'current_page' => $tripPage->currentPage(),
            'last_page' => $tripPage->lastPage(),
            'per_page' => $tripPage->perPage(),
            'total' => $tripPage->total(),
        ]);
    }

    public function show(Request $request, Trip $trip)
    {
        $this->authorize('view', $trip);

        if (!$this->ledgerService->isReady()) {
            return response()->json([
                'message' => 'Accounting tables are not available yet. Please run migrations first.',
            ], 503);
        }

        $this->ledgerService->syncTrip($trip, (int) $request->user()->getAdminId(), $request->user()->getTeamId());

        $obligations = AccountingObligation::query()
            ->with(['settlements' => function ($q) {
                $q->orderByDesc('settlement_date')->orderByDesc('id');
            }])
            ->where('trip_id', $trip->id)
            ->orderByRaw("FIELD(direction, 'receivable', 'payable')")
            ->orderByRaw("FIELD(party_type, 'client', 'hotel', 'cab', 'manual')")
            ->orderBy('id')
            ->get();

        $summary = [
            'receivable_expected' => (float) $obligations->where('direction', 'receivable')->sum('expected_amount'),
            'receivable_settled' => (float) $obligations->where('direction', 'receivable')->sum('settled_amount'),
            'payable_expected' => (float) $obligations->where('direction', 'payable')->sum('expected_amount'),
            'payable_settled' => (float) $obligations->where('direction', 'payable')->sum('settled_amount'),
        ];
        $summary['receivable_remaining'] = max(0, $summary['receivable_expected'] - $summary['receivable_settled']);
        $summary['payable_remaining'] = max(0, $summary['payable_expected'] - $summary['payable_settled']);

        return response()->json([
            'trip' => [
                'trip_id' => $trip->trip_id,
                'trip_title' => $trip->trip_title,
                'client_name' => $trip->client_name,
                'status' => $trip->status,
                'start_date' => $trip->start_date,
                'currency' => $trip->currency,
            ],
            'summary' => $summary,
            'obligations' => $obligations,
        ]);
    }

    public function storeSettlement(Request $request)
    {
        if (!$this->ledgerService->isReady()) {
            return response()->json([
                'message' => 'Accounting tables are not available yet. Please run migrations first.',
            ], 503);
        }

        $validated = $request->validate([
            'obligation_id' => 'required|exists:accounting_obligations,id',
            'amount' => 'required|numeric|min:0.01',
            'settlement_type' => 'nullable|in:receipt,payment,refund,adjustment',
            'settlement_date' => 'nullable|date',
            'method' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $adminId = $request->user()->getAdminId();

        $obligation = AccountingObligation::query()
            ->where('id', $validated['obligation_id'])
            ->where('user_id', $adminId)
            ->firstOrFail();

        $settlement = $this->ledgerService->recordSettlement($obligation, $validated, $request->user()->id);

        return response()->json([
            'message' => 'Settlement recorded successfully.',
            'settlement' => $settlement,
            'obligation' => $obligation->fresh('settlements'),
        ]);
    }

    public function updateSettlement(Request $request, AccountingSettlement $settlement)
    {
        if (!$this->ledgerService->isReady()) {
            return response()->json([
                'message' => 'Accounting tables are not available yet. Please run migrations first.',
            ], 503);
        }

        $adminId = $request->user()->getAdminId();
        $settlement->load('obligation');

        if ((int) $settlement->obligation->user_id !== (int) $adminId) {
            abort(403);
        }

        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'settlement_type' => 'required|in:receipt,payment,refund,adjustment',
            'settlement_date' => 'required|date',
            'method' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $updated = $this->ledgerService->updateSettlement($settlement, $validated);

        return response()->json([
            'message' => 'Settlement updated successfully.',
            'settlement' => $updated,
            'obligation' => $updated->obligation->fresh('settlements'),
        ]);
    }

    public function destroySettlement(Request $request, AccountingSettlement $settlement)
    {
        if (!$this->ledgerService->isReady()) {
            return response()->json([
                'message' => 'Accounting tables are not available yet. Please run migrations first.',
            ], 503);
        }

        $adminId = $request->user()->getAdminId();
        $settlement->load('obligation');

        if ((int) $settlement->obligation->user_id !== (int) $adminId) {
            abort(403);
        }

        $this->ledgerService->deleteSettlement($settlement);

        return response()->json([
            'message' => 'Settlement deleted successfully.',
        ]);
    }
}
