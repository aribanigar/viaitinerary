<?php

namespace App\Services;

use App\Models\AccountingObligation;
use App\Models\AccountingSettlement;
use App\Models\Accommodation;
use App\Models\Transportation;
use App\Models\Trip;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AccountingLedgerService
{
    public function isReady(): bool
    {
        // MongoDB collections are created on first write, so they're always
        // "ready" — no relational table check is needed.
        return true;
    }

    public function syncTrip(Trip $trip, ?int $fallbackUserId = null, ?int $fallbackTeamId = null): void
    {
        if (!$this->isReady()) {
            return;
        }

        $resolvedUserId = $this->resolveOwnerUserId($trip, $fallbackUserId);
        if (!$resolvedUserId) {
            return;
        }

        $resolvedTeamId = $this->resolveOwnerTeamId($trip, $fallbackTeamId);

        $trip->loadMissing(['accommodations.hotel', 'transportations.vehicle']);

        DB::transaction(function () use ($trip, $resolvedUserId, $resolvedTeamId) {
            $this->syncClientReceivable($trip, $resolvedUserId, $resolvedTeamId);
            $this->syncAccommodationPayables($trip, $resolvedUserId, $resolvedTeamId);
            $this->syncTransportationPayables($trip, $resolvedUserId, $resolvedTeamId);
        });
    }

    public function recordSettlement(AccountingObligation $obligation, array $data, int $actorId): AccountingSettlement
    {
        $settlementType = $data['settlement_type'] ?? ($obligation->direction === 'receivable' ? 'receipt' : 'payment');

        $settlement = AccountingSettlement::create([
            'obligation_id' => $obligation->id,
            'trip_id' => $obligation->trip_id,
            'user_id' => $obligation->user_id,
            'created_by' => $actorId,
            'amount' => (float) $data['amount'],
            'settlement_type' => $settlementType,
            'settlement_date' => $data['settlement_date'] ?? now()->toDateString(),
            'method' => $data['method'] ?? null,
            'notes' => $data['notes'] ?? null,
        ]);

        if ($obligation->direction === 'receivable' && $obligation->source_type === 'trip') {
            $trip = $obligation->trip;
            if ($trip) {
                if ($settlementType === 'refund') {
                    $trip->refunded_amount = (float) ($trip->refunded_amount ?? 0) + (float) $settlement->amount;
                } else {
                    $trip->paid_amount = (float) ($trip->paid_amount ?? 0) + (float) $settlement->amount;
                }
                $trip->save();
            }
        }

        $this->recalculateObligation($obligation->fresh());

        return $settlement;
    }

    public function updateSettlement(AccountingSettlement $settlement, array $data): AccountingSettlement
    {
        $settlement->fill([
            'amount' => (float) ($data['amount'] ?? $settlement->amount),
            'settlement_type' => $data['settlement_type'] ?? $settlement->settlement_type,
            'settlement_date' => $data['settlement_date'] ?? $settlement->settlement_date,
            'method' => $data['method'] ?? $settlement->method,
            'notes' => $data['notes'] ?? $settlement->notes,
        ]);

        $settlement->save();

        $this->recalculateObligation($settlement->obligation);

        return $settlement;
    }

    public function deleteSettlement(AccountingSettlement $settlement): void
    {
        $obligation = $settlement->obligation;
        $settlement->delete();
        $this->recalculateObligation($obligation);
    }

    public function recalculateObligation(AccountingObligation $obligation): void
    {
        if ($obligation->direction === 'receivable' && $obligation->source_type === 'trip') {
            $trip = $obligation->trip;
            $settledFromTrip = max(0, (float) ($trip?->paid_amount ?? 0) - (float) ($trip?->refunded_amount ?? 0));
            $expected = (float) $obligation->expected_amount;

            $obligation->settled_amount = round($settledFromTrip, 2);
            $obligation->status = $this->statusFromAmounts($expected, $settledFromTrip);
            $obligation->save();

            return;
        }

        $settled = (float) $obligation->settlements()->get()->sum(function ($row) {
            $amount = (float) $row->amount;
            if ($row->settlement_type === 'refund') {
                return -1 * $amount;
            }
            return $amount;
        });

        $expected = (float) $obligation->expected_amount;
        $status = 'pending';

        if ($settled >= $expected && $expected > 0) {
            $status = 'settled';
        } elseif ($settled > 0) {
            $status = 'partial';
        }

        if ($expected <= 0 && $settled <= 0) {
            $status = 'settled';
        }

        $obligation->settled_amount = max(0, round($settled, 2));
        $obligation->status = $status;
        $obligation->save();
    }

    private function syncClientReceivable(Trip $trip, int $ownerUserId, ?int $ownerTeamId): void
    {
        $expected = round((float) ($trip->cost ?? 0), 2);
        $settled = round(max(0, (float) ($trip->paid_amount ?? 0) - (float) ($trip->refunded_amount ?? 0)), 2);

        $obligation = AccountingObligation::updateOrCreate(
            [
                'trip_id' => $trip->id,
                'direction' => 'receivable',
                'source_type' => 'trip',
                'source_id' => $trip->id,
            ],
            [
                'user_id' => $ownerUserId,
                'team_id' => $ownerTeamId,
                'party_type' => 'client',
                'party_id' => null,
                'party_name' => $trip->client_name ?: 'Client',
                'expected_amount' => $expected,
                'settled_amount' => $settled,
                'status' => $this->statusFromAmounts($expected, $settled),
            ]
        );

        $this->recalculateWithoutSettlementsIfManual($obligation, $settled);
    }

    private function syncAccommodationPayables(Trip $trip, int $ownerUserId, ?int $ownerTeamId): void
    {
        $activeIds = [];

        foreach ($trip->accommodations as $accommodation) {
            $activeIds[] = $accommodation->id;
            $expected = round($this->calculateAccommodationCost($accommodation), 2);
            $existing = AccountingObligation::where('trip_id', $trip->id)
                ->where('direction', 'payable')
                ->where('source_type', 'accommodation')
                ->where('source_id', $accommodation->id)
                ->first();

            $settledAmount = $existing ? (float) $existing->settled_amount : 0;

            AccountingObligation::updateOrCreate(
                [
                    'trip_id' => $trip->id,
                    'direction' => 'payable',
                    'source_type' => 'accommodation',
                    'source_id' => $accommodation->id,
                ],
                [
                    'user_id' => $ownerUserId,
                    'team_id' => $ownerTeamId,
                    'party_type' => 'hotel',
                    'party_id' => $accommodation->hotel_id,
                    'party_name' => $accommodation->name ?: ($accommodation->hotel->name ?? 'Hotel'),
                    'expected_amount' => $expected,
                    'settled_amount' => $settledAmount,
                    'status' => $this->statusFromAmounts($expected, $settledAmount),
                ]
            );
        }

        AccountingObligation::where('trip_id', $trip->id)
            ->where('direction', 'payable')
            ->where('source_type', 'accommodation')
            ->when(!empty($activeIds), function ($query) use ($activeIds) {
                $query->whereNotIn('source_id', $activeIds);
            }, function ($query) {
                $query->whereNotNull('source_id');
            })
            ->update([
                'expected_amount' => 0,
                'status' => 'settled',
            ]);
    }

    private function syncTransportationPayables(Trip $trip, int $ownerUserId, ?int $ownerTeamId): void
    {
        $activeIds = [];

        foreach ($trip->transportations as $transportation) {
            $activeIds[] = $transportation->id;
            $expected = round($this->calculateTransportationCost($transportation), 2);
            $existing = AccountingObligation::where('trip_id', $trip->id)
                ->where('direction', 'payable')
                ->where('source_type', 'transportation')
                ->where('source_id', $transportation->id)
                ->first();

            $settledAmount = $existing ? (float) $existing->settled_amount : 0;

            AccountingObligation::updateOrCreate(
                [
                    'trip_id' => $trip->id,
                    'direction' => 'payable',
                    'source_type' => 'transportation',
                    'source_id' => $transportation->id,
                ],
                [
                    'user_id' => $ownerUserId,
                    'team_id' => $ownerTeamId,
                    'party_type' => 'cab',
                    'party_id' => $transportation->vehicle_id,
                    'party_name' => $transportation->vehicle_type ?: ($transportation->vehicle->name ?? 'Cab'),
                    'expected_amount' => $expected,
                    'settled_amount' => $settledAmount,
                    'status' => $this->statusFromAmounts($expected, $settledAmount),
                ]
            );
        }

        AccountingObligation::where('trip_id', $trip->id)
            ->where('direction', 'payable')
            ->where('source_type', 'transportation')
            ->when(!empty($activeIds), function ($query) use ($activeIds) {
                $query->whereNotIn('source_id', $activeIds);
            }, function ($query) {
                $query->whereNotNull('source_id');
            })
            ->update([
                'expected_amount' => 0,
                'status' => 'settled',
            ]);
    }

    private function calculateAccommodationCost(Accommodation $accommodation): float
    {
        $checkIn = $accommodation->getRawOriginal('check_in');
        $checkOut = $accommodation->getRawOriginal('check_out');
        $nights = 1;

        if (!empty($checkIn) && !empty($checkOut)) {
            try {
                $start = \Carbon\Carbon::parse($checkIn);
                $end = \Carbon\Carbon::parse($checkOut);
                $diff = (int) $start->diffInDays($end, false);
                $nights = $diff > 0 ? $diff : 1;
            } catch (\Throwable $e) {
                $nights = 1;
            }
        }

        $rooms = (float) ($accommodation->rooms ?: 1);
        if ($rooms <= 0) {
            $rooms = 1;
        }

        $pricePerRoom = (float) ($accommodation->price_per_room ?: 0);
        $roomSubtotal = $rooms * $pricePerRoom * $nights;

        $bedPrices = is_array($accommodation->bed_prices) ? $accommodation->bed_prices : [];

        $cnbPrice = (float) $this->resolveBedPrice($bedPrices, ['cnb']);
        $extra512Price = (float) $this->resolveBedPrice($bedPrices, ['5-12', '5 to 12']);
        $extraAbove12Price = (float) $this->resolveBedPrice($bedPrices, ['above 12', '12+']);

        $cnbCount = (float) ($accommodation->cnb_count ?: 0);
        $extra512Count = (float) ($accommodation->extra_beds_5_to_12_count ?: 0);
        $extraAbove12Count = (float) ($accommodation->extra_beds_above_12_count ?: 0);

        $cnbCost = $cnbPrice * $cnbCount * $nights;
        $extra512Cost = $extra512Price * $extra512Count * $nights;
        $extraAbove12Cost = $extraAbove12Price * $extraAbove12Count * $nights;

        return max(0, $roomSubtotal + $cnbCost + $extra512Cost + $extraAbove12Cost);
    }

    private function calculateTransportationCost(Transportation $transportation): float
    {
        $price = (float) ($transportation->vehicle->price ?? 0);
        $qty = (float) ($transportation->quantity ?: 1);
        if ($qty <= 0) {
            $qty = 1;
        }
        return max(0, $price * $qty);
    }

    private function resolveBedPrice(array $bedPrices, array $needleTokens): float
    {
        foreach ($bedPrices as $entry) {
            $category = strtolower((string) ($entry['category'] ?? ''));
            foreach ($needleTokens as $token) {
                if (str_contains($category, strtolower($token))) {
                    return (float) ($entry['price'] ?? 0);
                }
            }
        }
        return 0;
    }

    private function statusFromAmounts(float $expected, float $settled): string
    {
        if ($expected <= 0) {
            return 'settled';
        }
        if ($settled <= 0) {
            return 'pending';
        }
        if ($settled >= $expected) {
            return 'settled';
        }
        return 'partial';
    }

    private function recalculateWithoutSettlementsIfManual(AccountingObligation $obligation, float $settled): void
    {
        if ($obligation->settlements()->count() === 0) {
            $obligation->settled_amount = $settled;
            $obligation->status = $this->statusFromAmounts((float) $obligation->expected_amount, $settled);
            $obligation->save();
        }
    }

    private function resolveOwnerUserId(Trip $trip, ?int $fallbackUserId): ?int
    {
        if (!empty($trip->user_id)) {
            return (int) $trip->user_id;
        }

        $trip->loadMissing('user');
        if ($trip->user) {
            if (method_exists($trip->user, 'getAdminId')) {
                $adminId = (int) $trip->user->getAdminId();
                if ($adminId > 0) {
                    return $adminId;
                }
            }

            if (!empty($trip->user->id)) {
                return (int) $trip->user->id;
            }
        }

        if (!empty($fallbackUserId)) {
            return (int) $fallbackUserId;
        }

        if (Auth::check()) {
            $authUser = Auth::user();
            if (is_object($authUser) && is_callable([$authUser, 'getAdminId'])) {
                $adminId = (int) call_user_func([$authUser, 'getAdminId']);
                if ($adminId > 0) {
                    return $adminId;
                }
            }

            if (!empty($authUser->id)) {
                return (int) $authUser->id;
            }
        }

        return null;
    }

    private function resolveOwnerTeamId(Trip $trip, ?int $fallbackTeamId): ?int
    {
        if (!empty($trip->team_id)) {
            return (int) $trip->team_id;
        }

        if (!empty($fallbackTeamId)) {
            return (int) $fallbackTeamId;
        }

        if (Auth::check()) {
            $authUser = Auth::user();
            if (!(is_object($authUser) && is_callable([$authUser, 'getTeamId']))) {
                return null;
            }

            $teamId = call_user_func([$authUser, 'getTeamId']);
            if (!empty($teamId)) {
                return (int) $teamId;
            }
        }

        return null;
    }
}
