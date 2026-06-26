<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(append: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'subscription_allows_trips' => \App\Http\Middleware\EnsureSubscriptionAllowsTripCreation::class,
            'check_status' => \App\Http\Middleware\CheckAccountStatus::class,
            'single_device' => \App\Http\Middleware\EnforceSingleDeviceSession::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'message' => 'Session expired. Please login again.'
                ], 401);
            }
        });

        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if (!$request->is('api/*') || config('app.debug')) {
                return null;
            }

            if ($e instanceof \Illuminate\Validation\ValidationException) {
                return null;
            }

            if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $message = match ($status) {
                    401 => 'Unauthorized.',
                    403 => 'Forbidden.',
                    404 => 'Not found.',
                    405 => 'Method not allowed.',
                    429 => 'Too many requests.',
                    default => 'Request failed.'
                };

                return response()->json(['message' => $message], $status);
            }

            return response()->json([
                'message' => 'Something went wrong. Please try again later.'
            ], 500);
        });
    })->create();
