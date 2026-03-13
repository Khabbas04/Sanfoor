<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Spatie\Sitemap\SitemapGenerator;

class GenerateSitemap extends Command
{
    protected $signature = 'sitemap:generate';
    protected $description = 'Generate sitemap';

    public function handle()
    {
        SitemapGenerator::create('https://sanfoor.me')
            ->writeToFile(public_path('sitemap.xml'));

        $this->info('Sitemap generated!');
    }
}
