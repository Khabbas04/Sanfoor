<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class BanUserCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:ban {email} {--reason= : The reason for banning the user}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Ban a user by email to prevent them from registering via Microsoft';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = $this->argument('email');
        $reason = $this->option('reason');

        $exists = \App\Models\BannedUser::where('email', $email)->exists();
        
        if ($exists) {
            $this->warn("The email {$email} is already banned.");
            return;
        }

        \App\Models\BannedUser::create([
            'email' => $email,
            'reason' => $reason
        ]);

        // Optionally, delete the user if they exist in the DB
        $user = \App\Models\User::where('email', $email)->first();
        if ($user) {
            $user->delete();
            $this->info("User found and deleted from the database.");
        }

        $this->info("Successfully banned {$email}. They will no longer be able to login or register.");
    }
}
