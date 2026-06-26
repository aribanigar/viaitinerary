<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('app:check-trial-expiries')->daily();
Schedule::command('app:process-trip-follow-ups')->hourly();
Schedule::command('app:sync-meta-sheet-leads')->everyMinute();
