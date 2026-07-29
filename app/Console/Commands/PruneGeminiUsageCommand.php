<?php

namespace App\Console\Commands;

use App\Models\ApiKeyUsageLog;
use Illuminate\Console\Command;

/**
 * Keeps the usage log bounded.
 *
 * One row per API call adds up: without pruning, a busy term leaves a table that
 * slows down the very dashboard it feeds. The retention window lives in
 * config/gemini.php.
 */
class PruneGeminiUsageCommand extends Command
{
    protected $signature = 'gemini:prune-usage {--days= : Override the configured retention window}';

    protected $description = 'Delete Gemini usage log rows older than the retention window';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?: config('gemini.usage_retention_days', 120));

        if ($days < 1) {
            $this->error('Retention must be at least one day.');

            return self::FAILURE;
        }

        $cutoff = now()->subDays($days);
        // Chunked so a large backlog cannot lock the table for the whole delete.
        $deleted = 0;
        do {
            $batch = ApiKeyUsageLog::where('created_at', '<', $cutoff)->limit(5000)->delete();
            $deleted += $batch;
        } while ($batch > 0);

        $this->info("Pruned {$deleted} usage rows older than {$days} days.");

        return self::SUCCESS;
    }
}
