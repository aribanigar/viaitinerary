<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Razorpay\Api\Api;
use Exception;
use Illuminate\Support\Facades\Log;
use App\Models\Plan;
use App\Models\User;
use App\Services\SubscriptionService;

class RazorpayController extends Controller
{
    private $razorpayKey;
    private $razorpaySecret;

    private function normalizeCountry(?string $country): ?string
    {
        if (!$country) {
            return null;
        }

        $normalized = strtoupper(trim($country));
        return $normalized === '' ? null : $normalized;
    }

    public function __construct()
    {
        $this->razorpayKey = config('services.razorpay.key');
        $this->razorpaySecret = config('services.razorpay.secret');
    }

    private function resolveAuthorizedMemberUser(Request $request): ?User
    {
        if (!$request->filled('member_user_id')) {
            return null;
        }

        $caller = $request->user();
        if ($caller->role !== 'admin') {
            abort(403, 'Only admins can manage team member subscriptions.');
        }

        $member = User::find($request->member_user_id);
        if (!$member) {
            abort(404, 'Member not found.');
        }

        $team = $member->teamRecord;
        if (!$team || (int) $team->created_by !== (int) $caller->id) {
            abort(403, 'Access denied for selected team member.');
        }

        return $member;
    }

    public function createOrder(Request $request)
    {
        if (empty($this->razorpayKey) || empty($this->razorpaySecret)) {
            Log::error('Razorpay keys not configured. Set RAZORPAY_KEY and RAZORPAY_SECRET in .env');
            return response()->json(['error' => 'Payment gateway is not configured. Please contact support.'], 503)
                ->header('Content-Type', 'application/json')
                ->header('Accept', 'application/json');
        }

        $request->validate([
            'plan' => 'required|string|max:50',
            'member_user_id' => 'nullable|integer|exists:users,id',
            'seats_needed' => 'nullable|integer|min:1|max:100',
            'country' => 'nullable|string|max:10',
        ]);

        $memberUser = $this->resolveAuthorizedMemberUser($request);

        $plan = $request->plan;
        $country = $this->normalizeCountry(
            $request->input('country') ?? $request->header('X-Country-Code')
        );

        $planQuery = Plan::where('key', $plan)->where('is_active', true);

        if ($country) {
            $planQuery->where(function ($query) use ($country) {
                $query->where('country', $country)
                    ->orWhereNull('country');
            })->orderByRaw('CASE WHEN country = ? THEN 0 ELSE 1 END', [$country]);
        }

        $planConfig = $planQuery->first();

        if (!$planConfig) {
            return response()->json(['error' => 'Invalid plan.'], 400)
                ->header('Content-Type', 'application/json');
        }

        $amountPaise = (int)(($planConfig->price ?? 0) * 100);

        if ($amountPaise < 100) {
            return response()->json(['error' => 'Invalid amount. Minimum order is ₹1.'], 400)
                ->header('Content-Type', 'application/json');
        }

        $currency = 'INR';

        try {
            Log::info('Creating Razorpay order...', [
                'amount_paise' => $amountPaise,
                'currency' => $currency,
            ]);

            $api = new Api($this->razorpayKey, $this->razorpaySecret);
            \Razorpay\Api\Request::addHeader('Accept', 'application/json');

            $orderData = [
                'receipt'         => 'rcpt_' . time(),
                'amount'          => $amountPaise,
                'currency'        => $currency,
                'notes'           => [
                    'plan' => (string)$plan,
                    'country' => (string)($country ?? ''),
                    'member_user_id' => (string)($memberUser?->id),
                    'user_id' => (string)$request->user()->id
                ]
            ];

            $razorpayOrder = $api->order->create($orderData);

            Log::info('Razorpay order created successfully', [
                'order_id' => $razorpayOrder['id'],
                'amount' => $razorpayOrder['amount'],
            ]);

            return response()->json([
                'order_id' => $razorpayOrder['id'],
                'amount' => $razorpayOrder['amount'],
                'currency' => $razorpayOrder['currency'],
                'key' => $this->razorpayKey,
                'plan' => $plan,
                'country' => $country,
                'member_user_id' => $memberUser?->id
            ])->header('Content-Type', 'application/json');
        } catch (Exception $e) {
            Log::error('Razorpay SDK error: ' . $e->getMessage());
            return $this->createOrderManual($amountPaise, $currency, $plan, $country, $memberUser?->id, $request->user()->id);
        }
    }

    private function createOrderManual($amountPaise, $currency, $plan, $country, $memberId, $userId)
    {
        Log::info('Attempting manual CURL order creation...');
        $url = 'https://api.razorpay.com/v1/orders';
        $data = json_encode([
            'receipt'  => 'rcpt_' . time(),
            'amount'   => $amountPaise,
            'currency' => $currency,
            'notes'    => [
                'plan' => (string)$plan,
                'country' => (string)($country ?? ''),
                'member_user_id' => (string)$memberId,
                'user_id' => (string)$userId
            ]
        ]);

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_USERPWD, $this->razorpayKey . ':' . $this->razorpaySecret);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Accept: application/json',
            'User-Agent: Mozilla/5.0'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            Log::error('Manual CURL Fail: ' . $curlError);
            return response()->json(['error' => 'Connection failed: ' . $curlError], 500)
                ->header('Content-Type', 'application/json');
        }

        $responseData = json_decode($response, true);
        if ($httpCode !== 200) {
            Log::error('Manual CURL API error', ['code' => $httpCode, 'response' => $responseData]);
            return response()->json([
                'error' => 'Razorpay API Error',
                'details' => $responseData['error']['description'] ?? 'Unknown error'
            ], $httpCode)->header('Content-Type', 'application/json');
        }

        Log::info('Manual order created successfully', ['order_id' => $responseData['id']]);

        return response()->json([
            'order_id' => $responseData['id'],
            'amount' => $responseData['amount'],
            'currency' => $responseData['currency'],
            'key' => $this->razorpayKey,
            'plan' => $plan,
            'country' => $country,
            'member_user_id' => $memberId
        ])->header('Content-Type', 'application/json');
    }

    public function verifyPayment(Request $request)
    {
        $request->validate([
            'razorpay_order_id'   => 'required|string',
            'razorpay_payment_id' => 'required|string',
            'razorpay_signature'  => 'required|string',
            'plan'                => 'required|string|exists:plans,key',
            'member_user_id'      => 'nullable|integer|exists:users,id',
        ]);

        $memberUser = $this->resolveAuthorizedMemberUser($request);

        $api = new Api($this->razorpayKey, $this->razorpaySecret);
        try {
            $attributes = [
                'razorpay_order_id'   => $request->razorpay_order_id,
                'razorpay_payment_id' => $request->razorpay_payment_id,
                'razorpay_signature'  => $request->razorpay_signature
            ];
            $api->utility->verifyPaymentSignature($attributes);

            $user = $request->user();
            $plan = $request->plan;

            if ($memberUser) {
                SubscriptionService::upgradeUserToPlan($memberUser, $plan, $request->razorpay_payment_id);
            } else {
                SubscriptionService::upgradeUserToPlan($user, $plan, $request->razorpay_payment_id);
            }

            Log::info('Payment verified and subscription updated', [
                'user_id' => $user->id,
                'plan' => $plan,
                'payment_id' => $request->razorpay_payment_id
            ]);

            return response()->json(['success' => true])->header('Content-Type', 'application/json');
        } catch (Exception $e) {
            Log::error('Signature verify failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['success' => false, 'error' => $e->getMessage()], 400)
                ->header('Content-Type', 'application/json');
        }
    }
}
