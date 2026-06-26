# Razorpay 406 Error - Fix Guide

## Problem

Your Razorpay integration is failing with a 406 (Not Acceptable) error because the API credentials are invalid or the account has configuration issues.

## Diagnosis

- API Key: `rzp_test_RbETEJXv2x8lAy`
- Error: 406 from AWS ELB (Razorpay's load balancer)
- Empty response body indicates credentials are being rejected before reaching the API

## Solution

### Step 1: Check Razorpay Dashboard

1. Go to https://dashboard.razorpay.com
2. Login to your account
3. Check if there are any alerts or verification requirements

### Step 2: Verify Test Mode

1. Look for a "Test Mode" toggle in the dashboard header
2. Make sure it's ENABLED (turned ON)
3. If disabled, enable it and wait a few minutes

### Step 3: Regenerate API Keys

1. Go to **Settings** → **API Keys** in the Razorpay dashboard
2. Under "Test Keys" section, click **Regenerate Key**
3. Copy the new Key ID and Key Secret
4. Update your `.env` file in the backend folder:

```env
RAZORPAY_KEY=rzp_test_YOUR_NEW_KEY_HERE
RAZORPAY_SECRET=YOUR_NEW_SECRET_HERE
```

5. Clear Laravel cache:

```powershell
cd backend
php artisan config:clear
php artisan cache:clear
```

### Step 4: Verify Account Activation

1. In Razorpay dashboard, go to **Account & Settings**
2. Check if KYC/verification is complete
3. Ensure there are no pending activations or restrictions
4. Contact Razorpay support if account shows "Under Review" or "Suspended"

### Step 5: Test Again

Run the test script:

```powershell
cd backend
php test-razorpay-simple.php
```

You should see:

```
✓ SUCCESS! Order created: order_XXXXX
```

## Common Issues

### Issue 1: Old/Invalid Keys

**Symptom:** 406 error
**Fix:** Regenerate keys from dashboard

### Issue 2: Test Mode Not Enabled

**Symptom:** 406 or 403 error  
**Fix:** Enable test mode toggle in dashboard

### Issue 3: Account Not Activated

**Symptom:** 406 error, dashboard shows pending verification
**Fix:** Complete KYC/verification, or contact Razorpay support

### Issue 4: Keys from Different Account

**Symptom:** 406 error
**Fix:** Ensure you're using keys from the correct Razorpay account

## Alternative: Use Live Mode (if account is activated for production)

If test mode doesn't work but your account is activated for live mode:

1. Get live keys: `rzp_live_XXXXX`
2. Update `.env`:

```env
RAZORPAY_KEY=rzp_live_YOUR_LIVE_KEY
RAZORPAY_SECRET=YOUR_LIVE_SECRET
```

**WARNING:** Live mode will process real payments. Only use for testing if you understand the implications.

## Contact Razorpay Support

If none of the above works:

1. Email: support@razorpay.com
2. Phone: Check dashboard for support number
3. Mention: "Getting 406 error on API calls, keys might be invalid"

## For Development: Mock Payment (Temporary Workaround)

If you need to continue development while fixing Razorpay:

See `MOCK_PAYMENT_MODE.md` for instructions on using a temporary mock payment system.
