<?php
$projectRoot = dirname(__DIR__);
require $projectRoot . '/vendor/autoload.php';
$app = require $projectRoot . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$hasYear = Illuminate\Support\Facades\Schema::hasColumn('user_carts','academic_year') ? 'yes' : 'no';
$hasTerm = Illuminate\Support\Facades\Schema::hasColumn('user_carts','academic_term') ? 'yes' : 'no';
echo "academic_year: $hasYear\n";
echo "academic_term: $hasTerm\n";
