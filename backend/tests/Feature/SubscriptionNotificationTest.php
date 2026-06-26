<?php

namespace Tests\Feature;

use App\Jobs\ProcessSuccessfulSubscriptionJob;
use App\Mail\NewSubscriptionAlertMail;
use App\Mail\SubscriptionConfirmationMail;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SubscriptionNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a default plan for testing
        Plan::create([
            'key' => 'eid-duo',
            'name' => 'Eid Duo Plan',
            'price' => 999.00,
            'duration_months' => 3,
            'trip_limit' => 100,
            'team_member_limit' => 2,
            'is_active' => true,
        ]);
    }

    /**
     * Test that upgrading a user to a plan dispatches the notification job.
     */
    public function test_upgrade_user_to_plan_dispatches_notification_job(): void
    {
        Bus::fake();

        $user = User::factory()->create([
            'role' => 'admin',
            'status' => 'active'
        ]);

        SubscriptionService::upgradeUserToPlan($user, 'eid-duo', 'pay_test_123');

        $subscription = $user->subscription()->first();
        $this->assertNotNull($subscription);
        $this->assertEquals('eid-duo', $subscription->plan_key);
        $this->assertEquals('pay_test_123', $subscription->razorpay_payment_id);

        Bus::assertDispatched(ProcessSuccessfulSubscriptionJob::class, function ($job) use ($user, $subscription) {
            return $job->userId === $user->id && $job->subscriptionId === $subscription->id;
        });
    }

    /**
     * Test that the ProcessSuccessfulSubscriptionJob sends the correct emails.
     */
    public function test_subscription_job_sends_emails(): void
    {
        Mail::fake();

        $user = User::factory()->create([
            'name' => 'Test Customer',
            'email' => 'customer@example.com',
            'role' => 'admin',
            'status' => 'active'
        ]);

        $subscription = Subscription::create([
            'user_id' => $user->id,
            'plan_key' => 'eid-duo',
            'status' => 'active',
            'paid_amount' => 999.00,
            'razorpay_payment_id' => 'pay_test_456',
            'starts_at' => now(),
            'ends_at' => now()->addMonths(3),
        ]);

        // Manually set config to avoid null issues during test
        config(['services.super_admin.email' => 'ViaItinerary.in@gmail.com']);

        $job = new ProcessSuccessfulSubscriptionJob($user->id, $subscription->id);
        $job->handle();

        // Assert confirmation email sent to customer
        Mail::assertSent(SubscriptionConfirmationMail::class, function ($mail) use ($user) {
            return $mail->hasTo($user->email) &&
                $mail->user->id === $user->id;
        });

        // Assert alert email sent to super admin
        $superAdminEmail = config('services.super_admin.email');
        Mail::assertSent(NewSubscriptionAlertMail::class, function ($mail) use ($superAdminEmail) {
            return $mail->hasTo($superAdminEmail);
        });
    }

    /**
     * Test email content rendering (Smoke test for Blade templates).
     */
    public function test_subscription_emails_render_correctly(): void
    {
        $user = User::factory()->create([
            'name' => 'John Doe',
            'email' => 'john@example.com'
        ]);

        $plan = Plan::where('key', 'eid-duo')->first();

        $subscription = Subscription::create([
            'user_id' => $user->id,
            'plan_key' => 'eid-duo',
            'status' => 'active',
            'paid_amount' => 999.00,
            'razorpay_payment_id' => 'pay_abc_123',
            'starts_at' => now(),
            'ends_at' => now()->addMonths(3),
        ]);

        $confirmationMail = new SubscriptionConfirmationMail($user, $subscription, $plan);
        $confirmationHtml = $confirmationMail->render();

        $this->assertStringContainsString('John Doe', $confirmationHtml);
        $this->assertStringContainsString('Eid Duo Plan', $confirmationHtml);
        $this->assertStringContainsString('999.00', $confirmationHtml);
        $this->assertStringContainsString('pay_abc_123', $confirmationHtml);

        $alertMail = new NewSubscriptionAlertMail($user, $subscription, $plan);
        $alertHtml = $alertMail->render();

        $this->assertStringContainsString('New Plan Purchase', $alertHtml);
        $this->assertStringContainsString('John Doe', $alertHtml);
        $this->assertStringContainsString('john@example.com', $alertHtml);
    }
}
