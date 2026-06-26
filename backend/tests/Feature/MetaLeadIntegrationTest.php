<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Integration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

class MetaLeadIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected $user;

    protected function setUp(): void
    {
        parent::setUp();
        // Create a test user (agency)
        $this->user = User::factory()->create();
    }

    /** @test */
    public function it_verifies_meta_webhook_successfully()
    {
        $verifyToken = 'viakashmir_leadgen_verify_2026';
        config(['services.facebook.verify_token' => $verifyToken]);
        // Mock the env() check in controller if needed or set it in phpunit.xml
        putenv("META_VERIFY_TOKEN=$verifyToken");

        $response = $this->getJson("/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=$verifyToken&hub.challenge=12345");

        $response->assertStatus(200);
        $this->assertEquals('12345', $response->getContent());
    }

    /** @test */
    public function it_fails_meta_webhook_verification_with_wrong_token()
    {
        $response = $this->getJson("/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=12345");

        $response->assertStatus(403);
    }

    /** @test */
    public function it_receives_webhook_and_creates_lead()
    {
        config(['services.facebook.client_secret' => 'test_facebook_app_secret']);

        // 1. Setup an Integration record for this user
        $pageId = '123456789';
        $integration = Integration::create([
            'user_id' => $this->user->id,
            'platform' => 'facebook',
            'access_token' => 'mock_page_access_token',
            'settings' => ['page_id' => $pageId]
        ]);

        // 2. Mock the Meta Graph API response for fetching lead details
        $leadId = 'lead_999';
        Http::fake([
            "graph.facebook.com/v22.0/{$leadId}*" => Http::response([
                'id' => $leadId,
                'created_time' => '2026-03-17T12:00:00+0000',
                'field_data' => [
                    ['name' => 'full_name', 'values' => ['John Doe']],
                    ['name' => 'email', 'values' => ['john@example.com']],
                    ['name' => 'phone_number', 'values' => ['+919876543210']]
                ]
            ], 200)
        ]);

        // 3. Simulate the Meta Webhook payload
        $payload = [
            'object' => 'page',
            'entry' => [
                [
                    'id' => $pageId,
                    'time' => time(),
                    'changes' => [
                        [
                            'field' => 'leadgen',
                            'value' => [
                                'ad_id' => 'ad_123',
                                'form_id' => 'form_456',
                                'leadgen_id' => $leadId,
                                'page_id' => $pageId,
                                'created_time' => time(),
                            ]
                        ]
                    ]
                ]
            ]
        ];

        $signature = 'sha256=' . hash_hmac('sha256', json_encode($payload), 'test_facebook_app_secret');

        // 4. Fire the webhook request
        $response = $this->withHeader('X-Hub-Signature-256', $signature)
            ->postJson('/api/webhooks/meta', $payload);

        $response->assertStatus(200);

        // 5. Verify the Lead was created in our database
        $this->assertDatabaseHas('trip_inquiries', [
            'user_id' => $this->user->id,
            'client_name' => 'John Doe',
            'client_email' => 'john@example.com',
            'source_url' => 'Facebook/Instagram Ad'
        ]);
    }
}
