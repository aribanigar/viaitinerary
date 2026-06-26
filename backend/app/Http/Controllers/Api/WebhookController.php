<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadInquiry;
use App\Models\Integration;
use App\Models\User;
use App\Notifications\NewLeadArrivedNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class WebhookController extends Controller
{
    private const META_GRAPH_VERSION = 'v22.0';

    /**
     * Meta Lead Ads Verification
     */
    public function verifyMeta(Request $request)
    {
        // Hub parameters from Meta
        // Meta uses: hub.mode, hub.verify_token, hub.challenge
        $mode = $request->query('hub.mode') ?? $request->query('hub_mode');
        $token = $request->query('hub.verify_token') ?? $request->query('hub_verify_token');
        $challenge = $request->query('hub.challenge') ?? $request->query('hub_challenge');

        Log::info('Meta Webhook Verification Attempt', [
            'hub_mode' => $mode,
            'hub_verify_token' => $token,
            'hub_challenge' => $challenge,
            'expected_token' => env('META_VERIFY_TOKEN')
        ]);

        if ($mode === 'subscribe' && $token === env('META_VERIFY_TOKEN')) {
            Log::info('Meta Webhook verified successfully');
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        Log::warning('Meta Webhook verification failed', [
            'provided' => $token,
            'expected' => env('META_VERIFY_TOKEN')
        ]);

        return response('Forbidden', 403);
    }

    /**
     * Handle Meta Lead Notification
     */
    public function handleMetaNotification(Request $request)
    {
        Log::info('Meta Webhook Payload Received:', [
            'headers' => $request->headers->all(),
            'body' => $request->all(),
            'raw' => $request->getContent()
        ]);

        if (!$this->verifyMetaSignature($request)) {
            Log::warning('Meta webhook signature verification failed');
            return response('Forbidden', 403);
        }

        Log::info('Meta Notification Signature Verified');

        if ($request->input('object') === 'page') {
            foreach ($request->input('entry') as $entry) {
                foreach ($entry['changes'] as $change) {
                    Log::info('Checking Meta entry change:', ['field' => $change['field'] ?? 'unknown']);
                    if ($change['field'] === 'leadgen') {
                        $this->fetchMetaLead($change['value']);
                    }
                }
            }
        } else {
            Log::info('Meta Webhook "object" is not "page":', ['object' => $request->input('object')]);
        }

        return response('OK', 200);
    }

    private function verifyMetaSignature(Request $request): bool
    {
        $appSecret = config('services.facebook.client_secret') ?: env('FACEBOOK_CLIENT_SECRET');

        if (!$appSecret) {
            Log::error('Meta webhook signature check skipped: missing Facebook app secret');
            return false;
        }

        $signatureHeader = $request->header('X-Hub-Signature-256');

        if (!$signatureHeader || !str_starts_with($signatureHeader, 'sha256=')) {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), $appSecret);

        return hash_equals($expected, $signatureHeader);
    }

    private function fetchMetaLead($data)
    {
        $leadId = $data['leadgen_id'] ?? null;
        $pageId = $data['page_id'] ?? null;

        if (!$leadId || !$pageId) {
            Log::warning('Meta webhook lead payload missing leadgen_id or page_id', ['value' => $data]);
            return;
        }

        // Find the agency integration based on the PageID
        $integration = Integration::where('platform', 'facebook')
            ->where('settings->page_id', $pageId)
            ->first();

        Log::info('Meta Integration lookup:', [
            'page_id' => $pageId,
            'found' => (bool)$integration,
            'user_id' => $integration->user_id ?? 'N/A'
        ]);

        if (!$integration) {
            Log::warning("No integration found for Meta Page ID: {$pageId}");
            return;
        }

        $accessToken = $integration->access_token;
        Log::info('Attempting Meta Graph API fetch for lead:', ['lead_id' => $leadId]);

        $response = Http::get("https://graph.facebook.com/" . self::META_GRAPH_VERSION . "/{$leadId}", [
            'access_token' => $accessToken,
            'fields' => 'id,created_time,ad_id,form_id,field_data',
        ]);

        if ($response->successful()) {
            Log::info('Successfully fetched Meta Lead details:', $response->json());
            $leadData = $response->json();
            $this->saveLeadToCrm($leadData, $integration->user_id, 'meta', [
                'page_id' => $pageId,
                'ad_id' => $data['ad_id'] ?? null,
                'form_id' => $data['form_id'] ?? null,
            ]);
        } else {
            Log::error("Failed to fetch Meta Lead info for ID: {$leadId}", [
                'status' => $response->status(),
                'error' => $response->json()
            ]);
        }
    }

    private function saveLeadToCrm($data, $userId, $source, array $context = [])
    {
        // Internal logic to transform Meta/Google fields into LeadInquiry
        $leadId = $data['id'] ?? null;

        if ($source === 'meta' && $leadId) {
            $exists = LeadInquiry::where('user_id', $userId)
                ->where('fb_lead_id', $leadId)
                ->exists();

            if ($exists) {
                Log::info('Skipping duplicate Meta lead', ['user_id' => $userId, 'fb_lead_id' => $leadId]);
                return;
            }
        }

        $clientName = '';
        $clientEmail = '';
        $clientPhone = '';

        Log::info('Saving Lead to CRM:', [
            'raw_data' => $data,
            'source' => $source,
            'user_id' => $userId
        ]);

        foreach (($data['field_data'] ?? []) as $field) {
            $name = $field['name'] ?? null;
            $value = $field['values'][0] ?? null;
            Log::info("Mapping field: {$name} -> {$value}");
            if (!$name || $value === null) {
                continue;
            }

            if ($name === 'full_name') {
                $clientName = $value;
            }
            if ($name === 'email') {
                $clientEmail = $value;
            }
            if ($name === 'phone_number') {
                $clientPhone = $value;
            }
        }

        $lead = LeadInquiry::create([
            'user_id' => $userId,
            'client_name' => $clientName ?: 'Ads Lead',
            'client_email' => $clientEmail ?: '',
            'client_phone' => $clientPhone ?: '',
            'destination' => 'Social Media Lead',
            'inquiry_id' => 'ADS' . strtoupper(uniqid()),
            'status' => 'new',
            'source_url' => $source === 'meta' ? 'Facebook/Instagram Ad' : 'Google Ad',
            'external_id' => $leadId,
            'fb_lead_id' => $source === 'meta' ? $leadId : null,
            // Add other data mapping here
        ]);

        $admin = User::where('id', $userId)->first();
        if ($admin) {
            $admin->notify(new NewLeadArrivedNotification($lead, 'Meta Lead Ad'));
        }

        Log::info('Lead successfully created in DB:', ['id' => $lead->id, 'inquiry_id' => $lead->inquiry_id]);
    }
}
