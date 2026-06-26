<?php

namespace App\Http\Middleware;

use App\Models\UserActiveSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceSingleDeviceSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        $token = $user->currentAccessToken();
        if (!$token) {
            return response()->json([
                'message' => 'Session expired. Please login again.',
            ], 401);
        }

        $deviceId = trim((string) $request->header('X-Device-ID', ''));
        if ($deviceId === '') {
            return $next($request);
        }

        $activeSession = UserActiveSession::where('user_id', $user->id)->first();

        if (!$activeSession) {
            // Backward-compatible bootstrap for tokens issued before this guard.
            UserActiveSession::create([
                'user_id' => $user->id,
                'personal_access_token_id' => $token->id,
                'device_id' => $deviceId,
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
                'ip_address' => $request->ip(),
                'last_seen_at' => now(),
            ]);

            return $next($request);
        }

        if ((int) $activeSession->personal_access_token_id !== (int) $token->id || $activeSession->device_id !== $deviceId) {
            $token->delete();

            return response()->json([
                'message' => 'Your account was logged in from another device. Please login again.',
            ], 401);
        }

        $activeSession->forceFill([
            'last_seen_at' => now(),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
            'ip_address' => $request->ip(),
        ])->save();

        return $next($request);
    }
}
