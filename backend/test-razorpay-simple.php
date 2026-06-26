<?php

// Simple direct POST test
$key = 'rzp_live_Ri5P4vvELKgTEE';
$secret = '2DLlXX1rSlRwzeQkimh2rLQ8';

echo "Direct POST Test to Create Order (using LIVE keys)\n";
echo "==================================\n\n";

$data = json_encode([
    'amount' => 100000,
    'currency' => 'INR',
    'receipt' => 'test_' . time(),
]);

echo "Request Data: " . $data . "\n\n";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'https://api.razorpay.com/v1/orders');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_USERPWD, $key . ':' . $secret);
$authHeader = base64_encode($key . ':' . $secret);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Basic ' . $authHeader,
    'X-Razorpay-Account: ' . $key,
]);
curl_setopt($ch, CURLOPT_HEADER, 1);

$fullResponse = curl_exec($ch);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$headers = substr($fullResponse, 0, $headerSize);
$response = substr($fullResponse, $headerSize);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Status Code: " . $httpCode . "\n";
echo "Response Headers:\n" . $headers . "\n";
echo "Response Body: " . ($response ?: '(empty)') . "\n\n";

if ($httpCode == 200) {
    $data = json_decode($response, true);
    echo "✓ SUCCESS! Order created: " . $data['id'] . "\n";
} elseif ($httpCode == 401) {
    echo "❌ INVALID CREDENTIALS - Your API keys are incorrect!\n";
    echo "\nACTION REQUIRED:\n";
    echo "1. Log into https://dashboard.razorpay.com\n";
    echo "2. Go to Settings > API Keys\n";
    echo "3. Click 'Regenerate Test Key' to get fresh keys\n";
    echo "4. Update your backend/.env file with new keys\n";
} elseif ($httpCode == 406) {
    echo "❌ NOT ACCEPTABLE - This usually means invalid/expired keys\n";
    echo "\nPOSSIBLE CAUSES:\n";
    echo "1. API keys are from a deactivated/suspended Razorpay account\n";
    echo "2. Test mode is not enabled on your Razorpay dashboard\n";
    echo "3. Geographic restrictions on your Razorpay account\n";
    echo "4. Your IP/region is blocked by Razorpay\n";
    echo "\nNEXT STEPS:\n";
    echo "1. Visit https://dashboard.razorpay.com and login\n";
    echo "2. Check account status and activation\n";
    echo "3. Enable 'Test Mode' toggle in the dashboard\n";
    echo "4. Regenerate API keys from Settings > API Keys\n";
    echo "5. If issue persists, contact Razorpay support\n";
}
