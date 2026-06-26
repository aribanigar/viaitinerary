<?php

// Test Razorpay API credentials
require __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$key = $_ENV['RAZORPAY_KEY'] ?? 'not_set';
$secret = $_ENV['RAZORPAY_SECRET'] ?? 'not_set';

echo "Testing Razorpay Credentials\n";
echo "============================\n\n";
echo "Key: " . $key . "\n";
echo "Secret: " . substr($secret, 0, 4) . "****" . substr($secret, -4) . "\n\n";

if ($key === 'not_set' || $secret === 'not_set') {
    echo "❌ ERROR: Razorpay credentials not configured!\n";
    exit(1);
}

if (!str_starts_with($key, 'rzp_test_') && !str_starts_with($key, 'rzp_live_')) {
    echo "❌ ERROR: Invalid Razorpay key format!\n";
    exit(1);
}

// Test 1: Basic API Authentication
echo "Test 1: Testing basic API authentication (no extra headers)...\n";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.razorpay.com/v1/orders');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_HTTPGET, 1);
curl_setopt($ch, CURLOPT_USERPWD, $key . ':' . $secret);
// Try with NO custom headers
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_HEADER, 1);

$fullResponse = curl_exec($ch);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($fullResponse, 0, $headerSize);
$response = substr($fullResponse, $headerSize);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($curlError) {
    echo "❌ CURL Error: " . $curlError . "\n";
    exit(1);
}

echo "HTTP Status Code: " . $httpCode . "\n";
echo "Response Headers:\n" . $headers . "\n";
echo "Response Body: " . ($response ?: '(empty)') . "\n";
echo "SSL Verification: " . ($info['ssl_verify_result'] === 0 ? 'OK' : 'Failed') . "\n\n";

if ($httpCode === 401) {
    echo "❌ AUTHENTICATION FAILED: Invalid credentials!\n";
    echo "   Please check your Razorpay dashboard and regenerate keys.\n";
    exit(1);
} elseif ($httpCode === 403) {
    echo "❌ ACCESS DENIED: Account not activated or API access disabled.\n";
    exit(1);
} elseif ($httpCode === 406) {
    echo "❌ NOT ACCEPTABLE: There's an issue with the request format or headers.\n";
    echo "   This might indicate account configuration issues.\n";
    exit(1);
} elseif ($httpCode === 200) {
    echo "✓ Authentication successful!\n\n";
} else {
    echo "⚠ Unexpected status code: " . $httpCode . "\n";
    echo "Response: " . substr($response, 0, 200) . "\n\n";
}

// Test 2: Create a test order
echo "Test 2: Creating a test order...\n";

$orderData = json_encode([
    'amount' => 100000, // ₹1000 in paise
    'currency' => 'INR',
    'receipt' => 'test_' . time(),
    'notes' => [
        'test' => 'true'
    ]
]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.razorpay.com/v1/orders');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $orderData);
curl_setopt($ch, CURLOPT_USERPWD, $key . ':' . $secret);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$info = curl_getinfo($ch);
curl_close($ch);

echo "HTTP Status Code: " . $httpCode . "\n";
echo "Response Body: " . $response . "\n";
echo "Content Type: " . $info['content_type'] . "\n\n";

if ($httpCode === 200) {
    echo "✓ Test order created successfully!\n";
    $data = json_decode($response, true);
    echo "  Order ID: " . $data['id'] . "\n";
    echo "  Amount: ₹" . ($data['amount'] / 100) . "\n";
    echo "\n✓ ALL TESTS PASSED! Your Razorpay integration is working correctly.\n";
} else {
    echo "❌ Failed to create order\n";
    echo "Response: " . $response . "\n\n";

    $data = json_decode($response, true);
    if (isset($data['error'])) {
        echo "Error Details:\n";
        echo "  Code: " . ($data['error']['code'] ?? 'N/A') . "\n";
        echo "  Description: " . ($data['error']['description'] ?? 'N/A') . "\n";
    }
}
