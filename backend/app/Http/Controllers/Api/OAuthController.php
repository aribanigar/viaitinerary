<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use App\Services\MetaSheetLeadImporter;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OAuthController extends Controller
{
    private const META_GRAPH_VERSION = 'v22.0';
    private const STATE_TTL_SECONDS = 600;

    private function getStateSecret(): string
    {
        $appKey = (string) config('app.key', '');

        if (str_starts_with($appKey, 'base64:')) {
            $decoded = base64_decode(substr($appKey, 7), true);
            if ($decoded !== false) {
                return $decoded;
            }
        }

        return $appKey;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $value): string|false
    {
        $padding = strlen($value) % 4;
        if ($padding > 0) {
            $value .= str_repeat('=', 4 - $padding);
        }

        return base64_decode(strtr($value, '-_', '+/'), true);
    }

    private function buildSignedState(int $userId): string
    {
        $payload = json_encode([
            'uid' => $userId,
            'ts' => time(),
            'nonce' => bin2hex(random_bytes(8)),
        ], JSON_UNESCAPED_SLASHES);

        $payloadEncoded = $this->base64UrlEncode((string) $payload);
        $signature = hash_hmac('sha256', $payloadEncoded, $this->getStateSecret());

        return $payloadEncoded . '.' . $signature;
    }

    private function resolveUserIdFromState(?string $state): ?int
    {
        if (!$state || !str_contains($state, '.')) {
            return null;
        }

        [$payloadEncoded, $signature] = explode('.', $state, 2);

        $expected = hash_hmac('sha256', $payloadEncoded, $this->getStateSecret());
        if (!hash_equals($expected, (string) $signature)) {
            return null;
        }

        $payloadJson = $this->base64UrlDecode($payloadEncoded);
        if ($payloadJson === false) {
            return null;
        }

        $payload = json_decode($payloadJson, true);
        if (!is_array($payload) || !isset($payload['uid'], $payload['ts'])) {
            return null;
        }

        $ts = (int) $payload['ts'];
        if ($ts <= 0 || (time() - $ts) > self::STATE_TTL_SECONDS) {
            return null;
        }

        $uid = (int) $payload['uid'];
        return $uid > 0 ? $uid : null;
    }

    public function index(Request $request)
    {
        $integrations = Integration::where('user_id', $request->user()->getAdminId())
            ->get()
            ->mapWithKeys(function ($item) {
                $safeSettings = [];
                if (is_array($item->settings)) {
                    $safeSettings = array_intersect_key($item->settings, array_flip([
                        'page_id',
                        'form_ids',
                        'token_type',
                        'sheet_url',
                        'sheet_last_synced_at',
                        'sheet_last_error',
                        'sheet_last_import_summary',
                    ]));
                }

                return [$item->platform => [
                    'connected' => $item->is_active,
                    'expires_at' => $item->expires_at,
                    'settings' => $safeSettings,
                ]];
            });

        return response()->json($integrations);
    }

    public function destroy(Request $request, string $platform)
    {
        Integration::where('user_id', $request->user()->getAdminId())
            ->where('platform', $platform)
            ->delete();

        return response()->json(['message' => 'Integration removed']);
    }

    public function redirect(string $platform, Request $request)
    {
        if (!in_array($platform, ['facebook', 'google'])) {
            return response()->json(['error' => 'Unsupported platform'], 400);
        }

        // Store the current user's ID in the state to retrieve it in callback
        // Use $request->user() if available, otherwise check Sanctum guard explicitly
        $user = $request->user() ?: auth('sanctum')->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $state = $this->buildSignedState((int) $user->id);

        // Facebook/Meta scopes:
        // In many Meta app configurations, requesting advanced permissions before approval can hard-fail
        // with "Invalid Scopes" and block the OAuth dialog.
        // We therefore request only the safest baseline scope by default, and allow opt-in via env flags.
        $scopes = $platform === 'facebook'
            ? array_values(array_filter([
                'public_profile',
                env('META_INCLUDE_EMAIL') ? 'email' : null,
                env('META_INCLUDE_PAGES_SCOPES') ? 'pages_show_list' : null,
                env('META_INCLUDE_PAGES_SCOPES') ? 'pages_read_engagement' : null,
                env('META_INCLUDE_LEADS_RETRIEVAL') ? 'leads_retrieval' : null,
            ]))
            : ['https://www.googleapis.com/auth/adwords'];

        /** @var \Laravel\Socialite\Two\AbstractProvider $driver */
        $driver = Socialite::driver($platform);

        $redirectUrl = $driver->scopes($scopes)
            ->with(['state' => $state])
            ->stateless()
            ->redirect()
            ->getTargetUrl();

        return response()->json(['url' => $redirectUrl]);
    }

    public function callback(string $platform, Request $request)
    {
        try {
            if (!in_array($platform, ['facebook', 'google'])) {
                throw new \Exception('Unsupported platform');
            }

            if (!$request->has('code') || $request->has('error')) {
                throw new \Exception($request->get('error_description', $request->get('error', 'Missing authorization code.')));
            }

            $userId = $this->resolveUserIdFromState($request->get('state'));
            if (!$userId) {
                throw new \Exception('Invalid or expired OAuth state. Please retry.');
            }

            $targetUser = \App\Models\User::find($userId);
            if (!$targetUser) {
                throw new \Exception('Target user not found for integration callback.');
            }

            /** @var \Laravel\Socialite\Two\AbstractProvider $driver */
            $driver = Socialite::driver($platform);
            $socialUser = $driver->stateless()->user();

            // Logic to find/update integration
            $integration = Integration::updateOrCreate(
                [
                    'platform' => $platform,
                    'user_id' => $targetUser->id,
                ],
                [
                    'platform_id' => $socialUser->getId(),
                    'access_token' => $socialUser->token,
                    'refresh_token' => $socialUser->refreshToken,
                    'expires_at' => property_exists($socialUser, 'expiresIn') ? now()->addSeconds($socialUser->expiresIn) : null,
                    'is_active' => true,
                    'settings' => [
                        'name' => $socialUser->getName(),
                        'email' => $socialUser->getEmail(),
                        'avatar' => $socialUser->getAvatar(),
                    ]
                ]
            );

            \Illuminate\Support\Facades\Log::info("Integration saved for user {$targetUser->id} on platform {$platform}", ['integration_id' => $integration->id]);

            $frontendUrl = rtrim(config('app.frontend_url') ?: config('app.url'), " \t\n\r\0\x0B");

            // Capture the token if it was passed via state or session (placeholder for now)
            // For fixing the "Missing Authorization Code" flow as requested:
            // return redirect()->to("{$frontendUrl}/integrations?token={$token}&platform={$platform}");

            $frontendPlatform = $platform === 'facebook' ? 'meta' : $platform;
            return redirect($frontendUrl . '/integrations?success=1&platform=' . $frontendPlatform . '&code=' . $request->get('code'));
        } catch (\Exception $e) {
            $frontendUrl = rtrim(config('app.frontend_url') ?: config('app.url'), " \t\n\r\0\x0B");
            $errorMessage = rawurlencode($e->getMessage());
            return redirect($frontendUrl . '/integrations?error=' . $errorMessage);
        }
    }

    /**
     * Update Meta/Facebook Lead Ads settings (page_id, optional form_ids).
     * Also attempts to store a Page access token (required for lead retrieval).
     */
    public function updateFacebookSettings(Request $request)
    {
        $adminId = $request->user()->getAdminId();

        $validated = $request->validate([
            'page_id' => 'nullable|string|max:50',
            'form_ids' => 'nullable|array',
            'form_ids.*' => 'string|max:50',
            'sheet_url' => 'nullable|string|max:2000',
            'subscribe' => 'nullable|boolean',
        ]);

        $sheetUrl = isset($validated['sheet_url']) ? trim((string) $validated['sheet_url']) : null;
        $pageId = isset($validated['page_id']) ? trim((string) $validated['page_id']) : null;

        if (($sheetUrl === null || $sheetUrl === '') && ($pageId === null || $pageId === '')) {
            return response()->json([
                'error' => 'Provide either a Meta Page ID or a Google Sheet URL',
            ], 422);
        }

        $integration = Integration::firstOrNew([
            'user_id' => $adminId,
            'platform' => 'facebook',
        ]);

        if (!$integration->exists) {
            $integration->access_token = '';
            $integration->is_active = true;
        }

        $settings = $integration->settings ?? [];
        if ($pageId) {
            $settings['page_id'] = $pageId;
        }

        if ($sheetUrl !== null) {
            if ($sheetUrl === '') {
                unset($settings['sheet_url']);
            } else {
                $settings['sheet_url'] = $sheetUrl;
                $settings['token_type'] = 'sheet';
            }
        }

        if (isset($validated['form_ids'])) {
            $settings['form_ids'] = $validated['form_ids'];
        }

        $pageToken = null;
        if ($pageId && !empty($integration->access_token)) {
            // Attempt to exchange the stored user token for a Page token when available.
            $pageToken = $this->getPageAccessToken($integration->access_token, $pageId);
            if ($pageToken) {
                $integration->access_token = $pageToken;
                $settings['token_type'] = 'page';
            } else {
                $settings['token_type'] = $settings['token_type'] ?? 'user';
            }
        }

        $integration->is_active = true;
        $integration->settings = $settings;
        $integration->save();

        if (!empty($validated['subscribe']) && $pageToken && $pageId) {
            $this->subscribePageToLeadgen($validated['page_id'], $pageToken);
        }

        $syncSummary = null;
        if (!empty($settings['sheet_url'])) {
            try {
                $syncSummary = app(MetaSheetLeadImporter::class)->syncForIntegration($integration, (string) $settings['sheet_url']);
                $settings['sheet_last_synced_at'] = now()->toIso8601String();
                $settings['sheet_last_error'] = null;
                $settings['sheet_last_import_summary'] = $syncSummary;
            } catch (\Throwable $e) {
                $settings['sheet_last_synced_at'] = now()->toIso8601String();
                $settings['sheet_last_error'] = $e->getMessage();
                $settings['sheet_last_import_summary'] = [
                    'imported' => 0,
                    'skipped' => 0,
                    'total' => 0,
                    'skip_reason_counts' => [],
                    'skipped_rows' => [],
                ];
                Log::warning('Meta sheet sync failed during settings save', [
                    'user_id' => $adminId,
                    'integration_id' => $integration->id,
                    'error' => $e->getMessage(),
                ]);
            }

            $integration->settings = $settings;
            $integration->save();
        }

        return response()->json([
            'message' => 'Meta settings saved',
            'settings' => $integration->settings,
            'sync_summary' => $syncSummary,
        ]);
    }

    private function getPageAccessToken(string $userAccessToken, string $pageId): ?string
    {
        try {
            $response = Http::get('https://graph.facebook.com/' . self::META_GRAPH_VERSION . '/me/accounts', [
                'access_token' => $userAccessToken,
                'fields' => 'id,access_token',
            ]);

            if (!$response->successful()) {
                Log::warning('Meta page token exchange failed', ['status' => $response->status(), 'body' => $response->json()]);
                return null;
            }

            foreach (($response->json('data') ?? []) as $page) {
                if (($page['id'] ?? null) === $pageId) {
                    return $page['access_token'] ?? null;
                }
            }

            Log::warning('Meta page_id not found in /me/accounts response', ['page_id' => $pageId]);
            return null;
        } catch (\Exception $e) {
            Log::error('Meta page token exchange exception: ' . $e->getMessage());
            return null;
        }
    }

    private function subscribePageToLeadgen(string $pageId, string $pageAccessToken): void
    {
        try {
            $response = Http::asForm()->post('https://graph.facebook.com/' . self::META_GRAPH_VERSION . "/{$pageId}/subscribed_apps", [
                'subscribed_fields' => 'leadgen',
                'access_token' => $pageAccessToken,
            ]);

            if (!$response->successful()) {
                Log::warning('Meta subscribed_apps failed', ['status' => $response->status(), 'body' => $response->json()]);
            }
        } catch (\Exception $e) {
            Log::error('Meta subscribed_apps exception: ' . $e->getMessage());
        }
    }
}
