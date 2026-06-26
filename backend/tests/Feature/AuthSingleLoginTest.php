<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthSingleLoginTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test single active login per user.
     */
    public function test_user_can_only_have_one_active_login()
    {
        $password = 'password123';
        $user = User::factory()->create([
            'password' => \Illuminate\Support\Facades\Hash::make($password),
        ]);

        // 1. First login
        $response1 = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => $password,
        ]);

        $response1->assertStatus(200);
        $token1 = $response1->json('access_token');
        $this->assertEquals(1, $user->tokens()->count(), 'Should have 1 token after first login');

        // Verify token1 works
        $this->getJson('/api/user', [
            'Authorization' => 'Bearer ' . $token1,
        ])->assertStatus(200);

        // 2. Second login (same user)
        $response2 = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => $password,
        ]);

        $response2->assertStatus(200);
        $token2 = $response2->json('access_token');
        $this->assertEquals(1, $user->tokens()->count(), 'Should still have only 1 token (the new one)');
        $this->assertNotEquals($token1, $token2);

        // 3. Verify token1 is now invalid
        \Illuminate\Support\Facades\Auth::forgetUser();
        $responseToken1 = $this->getJson('/api/user', [
            'Authorization' => 'Bearer ' . $token1,
        ]);

        $responseToken1->assertStatus(401)
            ->assertJson(['message' => 'Session expired. Please login again.']);

        // 4. Verify token2 works
        $this->getJson('/api/user', [
            'Authorization' => 'Bearer ' . $token2,
        ])->assertStatus(200);
    }

    /**
     * Test logout revokes all tokens.
     */
    public function test_logout_revokes_all_tokens()
    {
        $password = 'password123';
        $user = User::factory()->create([
            'password' => \Illuminate\Support\Facades\Hash::make($password),
        ]);

        // Login
        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => $password,
        ]);
        $token = $response->json('access_token');

        // Logout
        $this->postJson('/api/logout', [], [
            'Authorization' => 'Bearer ' . $token,
        ])->assertStatus(200);

        \Illuminate\Support\Facades\Auth::forgetUser();

        // Verify token no longer works
        $this->getJson('/api/user', [
            'Authorization' => 'Bearer ' . $token,
        ])->assertStatus(401);

        // Verify no tokens exist in database for this user
        $this->assertEquals(0, $user->tokens()->count());
    }
}
