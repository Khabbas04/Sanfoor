<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class UnbanUserCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:unban {email}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Remove an email from the banned users list';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = $this->argument('email');

        $bannedRecord = \App\Models\BannedUser::where('email', $email)->first();
        
        if (!$bannedRecord) {
            $this->warn("The email {$email} is not in the banned list.");
            return;
        }

        $bannedRecord->delete();

        $this->info("Successfully unbanned {$email}. They can now register and login again.");
    }
}
