<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\TripController;
use App\Http\Controllers\AgencySettingsController;
use App\Http\Controllers\DestinationController;
use App\Http\Controllers\VehicleController;
use App\Http\Controllers\HotelController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\PolicyController;
use App\Http\Controllers\SuperAdminController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Api\DemoRequestController;
use App\Http\Controllers\Api\LeadInquiryController;
use App\Http\Controllers\RazorpayController;
use App\Http\Controllers\ShowcaseItemController;
use App\Http\Controllers\BlogImageController;
use App\Http\Controllers\Admin\BlogPostController;
use App\Http\Controllers\Admin\BlogCategoryController;
use App\Http\Controllers\Admin\BlogTagController;
use App\Http\Controllers\TrustedCompanyController;
use App\Http\Controllers\Api\OAuthController;
use App\Http\Controllers\Api\WebhookController;
use App\Http\Controllers\AccountingLedgerController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\File;

Route::post('/otp/send', [AuthController::class, 'sendOtp'])->middleware('throttle:otp');
Route::post('/password/forgot', [AuthController::class, 'sendResetOtp'])->middleware('throttle:otp');
Route::post('/password/reset', [AuthController::class, 'resetPassword']);
Route::post('/signup', [AuthController::class, 'signup'])->middleware('throttle:api');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/demo-requests', [DemoRequestController::class, 'store']);

// Public inquiry endpoints (no auth required)
Route::post('/trip-inquiries/{identifier}', [LeadInquiryController::class, 'store']);
Route::post('/lead-inquiries/{identifier}', [LeadInquiryController::class, 'store']);
Route::post('/public-inquiries', [LeadInquiryController::class, 'storePublic']);

// Public routes for Trusted Companies and Showcase Items
Route::get('/trusted-companies', [TrustedCompanyController::class, 'publicIndex']);
Route::get('/showcase-items', [ShowcaseItemController::class, 'index']);

// Webhook Routes (must be publicly reachable by providers)
Route::get('/webhooks/meta', [WebhookController::class, 'verifyMeta']);
Route::post('/webhooks/meta', [WebhookController::class, 'handleMetaNotification']);

// Keep status public for guest offer popups, but wrap logic in controller to handle optional auth
Route::get('/subscription/status', [\App\Http\Controllers\SubscriptionController::class, 'status']);

// Storage Proxy (for CORS and consistent URL resolution)
Route::get('/storage/{path}', function ($path) {
    $fullPath = storage_path('app/public/' . $path);
    if (!File::exists($fullPath)) {
        abort(404);
    }
    return response()->file($fullPath);
})->where('path', '.*');

// OAuth Routes
Route::middleware(['auth:sanctum', 'single_device', 'check_status'])->group(function () {
    Route::get('/auth/{platform}/redirect', [OAuthController::class, 'redirect']);
});
Route::get('/auth/{platform}/callback', [OAuthController::class, 'callback']);

Route::middleware(['auth:sanctum', 'single_device', 'check_status'])->group(function () {
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/user/update-profile', [AuthController::class, 'updateProfile']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Integrations
    Route::get('/integrations', [OAuthController::class, 'index']);
    Route::patch('/integrations/facebook/settings', [OAuthController::class, 'updateFacebookSettings']);
    Route::delete('/integrations/{platform}', [OAuthController::class, 'destroy']);

    Route::post('/subscription/upgrade', [\App\Http\Controllers\SubscriptionController::class, 'upgrade']);
    Route::post('/subscription/assign-member', [\App\Http\Controllers\SubscriptionController::class, 'assignMember']);

    Route::get('/builder/init', [TripController::class, 'builderInit']);
    Route::get('/trips/{trip}/pdf', [TripController::class, 'downloadPdf']);
    Route::get('/trips/{trip}/confirmation-pdf', [TripController::class, 'downloadConfirmationPdf']);
    Route::get('/trips/{trip}/payment-voucher-pdf', [TripController::class, 'downloadPaymentVoucherPdf']);
    Route::get('/trips/{trip}/invoice-pdf', [TripController::class, 'downloadInvoicePdf']);
    Route::post('/trips/{trip}/send-confirmation', [TripController::class, 'sendConfirmationEmail']);
    Route::post('/trips/{trip}/duplicate', [TripController::class, 'duplicate']);
    Route::apiResource('trips', TripController::class)->only(['index', 'show', 'update', 'destroy']);
    Route::post('trips', [TripController::class, 'store'])->middleware('subscription_allows_trips');

    Route::get('/accounting/ledger', [AccountingLedgerController::class, 'index']);
    Route::get('/accounting/ledger/{trip}', [AccountingLedgerController::class, 'show']);
    Route::post('/accounting/settlements', [AccountingLedgerController::class, 'storeSettlement']);
    Route::put('/accounting/settlements/{settlement}', [AccountingLedgerController::class, 'updateSettlement']);
    Route::delete('/accounting/settlements/{settlement}', [AccountingLedgerController::class, 'destroySettlement']);

    Route::get('/settings', [AgencySettingsController::class, 'show']);
    Route::match(['post', 'put'], '/settings', [AgencySettingsController::class, 'update']);
    Route::post('/settings/smtp/test', [AgencySettingsController::class, 'testSmtp']);
    Route::get('/settings/verify-ifsc', [AgencySettingsController::class, 'verifyIfsc']);

    Route::get('/policies', [PolicyController::class, 'show']);
    Route::match(['post', 'put'], '/policies', [PolicyController::class, 'update']);

    Route::apiResource('destinations', DestinationController::class);
    Route::apiResource('vehicles', VehicleController::class);
    Route::apiResource('hotels', HotelController::class);
    Route::apiResource('teams', TeamController::class);
    Route::patch('/teams/{team}/toggle-status', [TeamController::class, 'toggleStatus']);

    // Bulk Import
    Route::post('/bulk-import', [\App\Http\Controllers\BulkImportController::class, 'import']);
    Route::get('/bulk-export', [\App\Http\Controllers\BulkImportController::class, 'export']);
    Route::get('/bulk-import/template', [\App\Http\Controllers\BulkImportController::class, 'downloadTemplate']);

    // Trip Inquiries Management
    Route::get('/lead-inquiries', [LeadInquiryController::class, 'index']);
    Route::get('/lead-inquiries/assignable-members', [LeadInquiryController::class, 'assignableMembers']);
    Route::post('/lead-inquiries-bulk-import', [LeadInquiryController::class, 'importBulk']);
    Route::post('/lead-inquiries', [LeadInquiryController::class, 'storeManual']);
    Route::patch('/lead-inquiries/{id}', [LeadInquiryController::class, 'update']);
    Route::delete('/lead-inquiries/{id}', [LeadInquiryController::class, 'destroy']);
    Route::post('/lead-inquiries/{id}/convert-to-trip', [LeadInquiryController::class, 'convertToTrip']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);

    // Razorpay Integration
    Route::prefix('razorpay')->group(function () {
        Route::post('/create-order', [RazorpayController::class, 'createOrder']);
        Route::post('/verify-payment', [RazorpayController::class, 'verifyPayment']);
    });

    // Super Admin routes
    Route::middleware('role:super_admin')->group(function () {
        Route::get('/super-admin/dashboard', [SuperAdminController::class, 'dashboard']);
        Route::get('/super-admin/businesses', [SuperAdminController::class, 'businesses']);
        Route::get('/super-admin/businesses/{user}', [SuperAdminController::class, 'showBusiness']);
        Route::post('/super-admin/businesses', [SuperAdminController::class, 'storeBusiness']);
        Route::put('/super-admin/businesses/{user}', [SuperAdminController::class, 'updateBusiness']);
        Route::delete('/super-admin/businesses/{user}', [SuperAdminController::class, 'destroyBusiness']);
        Route::patch('/super-admin/businesses/{user}/status', [SuperAdminController::class, 'updateStatus']);
        Route::patch('/super-admin/businesses/{user}/bypass-subscription', [SuperAdminController::class, 'toggleBypassSubscription']);
        Route::post('/super-admin/businesses/{user}/assign-member', [SuperAdminController::class, 'assignBusinessMemberSeat']);

        // Public Leads Management
        Route::get('/super-admin/public-inquiries', [LeadInquiryController::class, 'publicInquiries']);
        Route::post('/super-admin/public-inquiries/{id}/assign', [LeadInquiryController::class, 'assignInquiry']);

        // Demo Requests Management
        Route::get('/demo-requests', [DemoRequestController::class, 'index']);
        Route::patch('/demo-requests/{demoRequest}/status', [DemoRequestController::class, 'updateStatus']);
        Route::delete('/demo-requests/{demoRequest}', [DemoRequestController::class, 'destroy']);

        // Showcase Items Management
        Route::apiResource('showcase-items', ShowcaseItemController::class)->except(['index']);

        // Subscription Plans Management
        Route::apiResource('plans', \App\Http\Controllers\Admin\PlanController::class);

        // Trusted Companies Management
        Route::apiResource('trusted-companies-admin', TrustedCompanyController::class)->parameters([
            'trusted-companies-admin' => 'trusted_company'
        ]);

        // Blog Management (Super Admin only)
        Route::prefix('super-admin/blog')->group(function () {
            // Posts
            Route::get('/posts', [BlogPostController::class, 'index']);
            Route::post('/posts', [BlogPostController::class, 'store']);
            Route::get('/posts/{post}', [BlogPostController::class, 'show']);
            Route::put('/posts/{post}', [BlogPostController::class, 'update']);
            Route::delete('/posts/{post}', [BlogPostController::class, 'destroy']);
            Route::post('/posts/{post}/publish', [BlogPostController::class, 'publish']);
            Route::post('/posts/{post}/unpublish', [BlogPostController::class, 'unpublish']);

            // Categories
            Route::apiResource('categories', BlogCategoryController::class);
            Route::post('/categories/reorder', [BlogCategoryController::class, 'reorder']);

            // Tags
            Route::get('/tags', [BlogTagController::class, 'index']);
            Route::post('/tags', [BlogTagController::class, 'store']);
            Route::delete('/tags/{tag}', [BlogTagController::class, 'destroy']);
            Route::post('/tags/merge', [BlogTagController::class, 'merge']);

            // Image Uploads
            Route::post('/images', [BlogImageController::class, 'upload']);
            Route::delete('/images', [BlogImageController::class, 'destroy']);
        });
    });
});
