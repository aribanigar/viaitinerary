<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\EmailOtp;
use App\Models\AgencySetting;
use App\Mail\SendOtpMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use App\Services\SubscriptionService;
use App\Traits\HandlesBase64Images;
use App\Models\UserActiveSession;
use App\Support\PasswordPolicy;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    use HandlesBase64Images;
    /**
     * Send OTP to Email
     */
    public function sendOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Check if user already exists
        if (User::where('email', $request->email)->exists()) {
            return response()->json(['message' => 'Email already registered.'], 400);
        }

        $otp = sprintf("%06d", mt_rand(1, 999999));

        // Delete previous OTPs for this email
        EmailOtp::where('email', $request->email)->delete();

        EmailOtp::create([
            'email' => $request->email,
            'otp' => $otp,
            'expires_at' => Carbon::now()->addMinutes(10),
        ]);

        try {
            Mail::mailer('otp')->to($request->email)->send(new SendOtpMail($otp));
        } catch (\Throwable $e) {
            Log::error('Failed to send OTP email', [
                'email' => $request->email,
                'error' => $e->getMessage(),
                'class' => get_class($e),
            ]);
            return response()->json(['message' => 'Failed to send OTP. Please try again later.'], 500);
        }

        return response()->json(['message' => 'OTP sent successfully.']);
    }

    /**
     * Create a new user (Sign UP)
     */
    public function signup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'phone' => 'required|string|phone:AUTO',
            'password' => PasswordPolicy::requiredConfirmed(),
            'otp' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Verify OTP
        $otpRecord = EmailOtp::where('email', $request->email)
            ->where('otp', $request->otp)
            ->where('expires_at', '>', Carbon::now())
            ->first();

        if (!$otpRecord) {
            return response()->json(['errors' => ['otp' => ['Invalid or expired OTP.']]], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'email_verified_at' => Carbon::now(),
            'role' => 'admin',
        ]);

        // Create default agency settings
        AgencySetting::create([
            'user_id' => $user->id,
            'agency_name' => $user->name . ' Travels',
            'contact_email' => $user->email,
            'contact_phone' => $request->phone,
            'website' => 'www.youragency.com',
            'whatsapp' => $request->phone,
            'brand_color' => '#FAA61A',
            'footer_text' => 'THANK YOU FOR TRAVELING WITH US!',
        ]);

        // Delete OTP after successful signup
        $otpRecord->delete();

        // BUG-3 fix: Initialize the trial subscription eagerly at signup time
        // so trial_started_at is always the exact moment the account was created.
        SubscriptionService::initializeTrial($user);

        $deviceId = $this->resolveDeviceId($request);

        $token = $user->createToken('auth_token')->plainTextToken;
        $tokenId = $this->extractTokenId($token);

        UserActiveSession::updateOrCreate(
            ['user_id' => $user->id],
            [
                'personal_access_token_id' => $tokenId,
                'device_id' => $deviceId,
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'ip_address' => $request->ip(),
                'last_seen_at' => now(),
            ]
        );

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'device_id' => $deviceId,
            'user' => $user,
        ]);
    }

    /**
     * Log in an existing user
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|max:255',
            'password' => 'required|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Invalid login details'
            ], 401);
        }

        // Check account status
        if (in_array($user->status, ['inactive', 'suspended'])) {
            return response()->json([
                'message' => 'Your account has been ' . $user->status . '. Please contact support.'
            ], 403);
        }

        if ($user->role === 'team') {
            $adminId = $user->getAdminId();
            $admin = User::find($adminId);
            if ($admin && in_array($admin->status, ['inactive', 'suspended'])) {
                return response()->json([
                    'message' => 'Your workspace admin account has been ' . $admin->status . '. Please contact them.'
                ], 403);
            }

            // Check team member subscription using the central service
            $team = $user->teamRecord;
            if ($team && !$team->is_active) {
                return response()->json([
                    'message' => 'Your team account has been deactivated. Please contact your admin.'
                ], 403);
            }

            $result = \App\Services\SubscriptionService::canLogin($user);
            if (!$result['allowed']) {
                return response()->json(['message' => ucfirst($result['reason'])], 403);
            }
        }

        $passwordPolicyFailed = false;

        if (config('security.passwords.check_on_login', true)) {
            $passwordPolicyFailed = !$this->passwordMeetsPolicy((string) $request->password);

            if ($passwordPolicyFailed) {
                Log::warning('User logged in with password that no longer meets policy.', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                ]);

                if (config('security.passwords.enforce_on_login', false)) {
                    return response()->json([
                        'message' => 'Your password no longer meets security policy. Please reset your password.',
                        'password_reset_required' => true,
                    ], 403);
                }
            }
        }

        $deviceId = $this->resolveDeviceId($request);
        $token = null;

        DB::transaction(function () use ($user, $request, $deviceId, &$token) {
            // Serialize concurrent logins to avoid duplicate active tokens.
            $lockedUser = User::whereKey($user->id)->lockForUpdate()->firstOrFail();

            // Revoke all existing tokens for single active login.
            $lockedUser->tokens()->delete();

            $token = $lockedUser->createToken('auth_token')->plainTextToken;
            $tokenId = $this->extractTokenId($token);

            UserActiveSession::updateOrCreate(
                ['user_id' => $lockedUser->id],
                [
                    'personal_access_token_id' => $tokenId,
                    'device_id' => $deviceId,
                    'user_agent' => substr((string) $request->userAgent(), 0, 255),
                    'ip_address' => $request->ip(),
                    'last_seen_at' => now(),
                ]
            );
        });

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'device_id' => $deviceId,
            'password_update_required' => $passwordPolicyFailed,
            'user' => $user,
        ]);
    }

    /**
     * Log out the current user (Revoke all tokens)
     */
    public function logout(Request $request)
    {
        // Option B: Revoke all tokens on logout
        $request->user()->tokens()->delete();
        UserActiveSession::where('user_id', $request->user()->id)->delete();

        return response()->json([
            'message' => 'Successfully logged out'
        ]);
    }

    /**
     * Get the authenticated User
     */
    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    /**
     * Update User Profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'password' => PasswordPolicy::sometimesConfirmed(),
            'profile_picture' => 'sometimes|string', // Base64
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = [];

        if ($request->has('name')) {
            $data['name'] = $request->name;
        }

        if ($request->has('password')) {
            $data['password'] = Hash::make($request->password);
        }

        if ($request->filled('profile_picture')) {
            $data['profile_picture'] = $this->saveBase64Image($request->profile_picture, 'profile_pictures');
        }

        $user->update($data);

        return response()->json(['message' => 'Profile updated successfully.', 'user' => $user]);
    }

    /**
     * Send Reset Password OTP
     */
    public function sendResetOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Check if user exists
        if (!User::where('email', $request->email)->exists()) {
            return response()->json(['message' => 'Email not found.'], 404);
        }

        $otp = sprintf("%06d", mt_rand(1, 999999));

        // Delete previous OTPs for this email
        EmailOtp::where('email', $request->email)->delete();

        EmailOtp::create([
            'email' => $request->email,
            'otp' => $otp,
            'expires_at' => Carbon::now()->addMinutes(10),
        ]);

        try {
            Mail::mailer('otp')->to($request->email)->send(new SendOtpMail($otp));
        } catch (\Throwable $e) {
            Log::error('Failed to send reset OTP email', [
                'email' => $request->email,
                'error' => $e->getMessage(),
                'class' => get_class($e),
            ]);
            return response()->json(['message' => 'Failed to send OTP. Please try again later.'], 500);
        }

        return response()->json(['message' => 'OTP sent successfully.']);
    }

    private function resolveDeviceId(Request $request): string
    {
        $headerDeviceId = trim((string) $request->header('X-Device-ID', ''));
        if ($headerDeviceId !== '') {
            return substr($headerDeviceId, 0, 128);
        }

        return Str::uuid()->toString();
    }

    private function extractTokenId(string $plainTextToken): ?int
    {
        if (!str_contains($plainTextToken, '|')) {
            return null;
        }

        [$tokenId] = explode('|', $plainTextToken, 2);

        return is_numeric($tokenId) ? (int) $tokenId : null;
    }

    /**
     * Reset Password
     */
    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|max:255',
            'otp' => 'required|string|size:6',
            'password' => PasswordPolicy::requiredConfirmed(),
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Verify OTP
        $otpRecord = EmailOtp::where('email', $request->email)
            ->where('otp', $request->otp)
            ->where('expires_at', '>', Carbon::now())
            ->first();

        if (!$otpRecord) {
            return response()->json(['errors' => ['otp' => ['Invalid or expired OTP.']]], 422);
        }

        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $user->password = Hash::make($request->password);
        $user->save();

        // Delete OTP after successful reset
        $otpRecord->delete();

        return response()->json(['message' => 'Password reset successfully.']);
    }

    private function passwordMeetsPolicy(string $password): bool
    {
        $validator = Validator::make(
            ['password' => $password],
            ['password' => ['required', 'string', PasswordPolicy::rule()]]
        );

        return !$validator->fails();
    }
}
