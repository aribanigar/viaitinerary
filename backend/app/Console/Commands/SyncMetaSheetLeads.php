<?php

namespace App\Console\Commands;

use App\Models\Integration;
use App\Services\MetaSheetLeadImporter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SyncMetaSheetLeads extends Command
{
    protected $signature = 'app:sync-meta-sheet-leads';

    protected $description = 'Sync Meta leads from connected Google Sheets';

    public function handle(MetaSheetLeadImporter $importer): int
    {
        $integrations = Integration::where('platform', 'facebook')
            ->where('is_active', true)
            ->get()
            ->filter(function (Integration $integration) {
                $settings = is_array($integration->settings) ? $integration->settings : [];
                return trim((string) ($settings['sheet_url'] ?? '')) !== '';
            })
            ->values();

        if ($integrations->isEmpty()) {
            $this->info('No Meta Google Sheet integrations found.');
            return self::SUCCESS;
        }

        $totalImported = 0;

        foreach ($integrations as $integration) {
            try {
                $summary = $importer->syncForIntegration($integration);

                $settings = is_array($integration->settings) ? $integration->settings : [];
                $settings['sheet_last_synced_at'] = now()->toIso8601String();
                $settings['sheet_last_error'] = null;
                $settings['sheet_last_import_summary'] = $summary;

                $integration->settings = $settings;
                $integration->save();

                $totalImported += $summary['imported'];

                $this->line(sprintf(
                    'Integration #%d: imported %d, skipped %d, total rows %d',
                    $integration->id,
                    $summary['imported'],
                    $summary['skipped'],
                    $summary['total']
                ));
            } catch (\Throwable $e) {
                $settings = is_array($integration->settings) ? $integration->settings : [];
                $settings['sheet_last_synced_at'] = now()->toIso8601String();
                $settings['sheet_last_error'] = $e->getMessage();
                $settings['sheet_last_import_summary'] = [
                    'imported' => 0,
                    'skipped' => 0,
                    'total' => 0,
                    'skip_reason_counts' => [],
                    'skipped_rows' => [],
                ];
                $integration->settings = $settings;
                $integration->save();

                Log::error('Meta sheet sync failed', [
                    'integration_id' => $integration->id,
                    'user_id' => $integration->user_id,
                    'error' => $e->getMessage(),
                ]);

                $this->error(sprintf('Integration #%d failed: %s', $integration->id, $e->getMessage()));
            }
        }

        $this->info('Meta sheet sync complete. Total imported: ' . $totalImported);

        return self::SUCCESS;
    }
}
