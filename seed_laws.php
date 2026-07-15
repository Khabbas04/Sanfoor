<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$engine = app(\App\Engines\DocumentRagEngine::class);

$laws = <<<EOT
**المادة 1**
يفصل الطالب من التخصص إذا حصل على ثلاثة إنذارات أكاديمية متتالية بسبب تدني معدله التراكمي عن 60%.
**المادة 2**
لا يجوز للطالب المُنذر أكاديمياً أن يسجل أكثر من 12 ساعة معتمدة في الفصل الدراسي الواحد.
**المادة 3**
يُسمح للطالب المُنذر بدراسة مادة خارج خطته الدراسية فقط إذا كانت ستساهم في رفع معدله التراكمي بموافقة العميد.
**المادة 4**
إذا انقطع الطالب عن الدراسة لمدة فصلين متتاليين بدون عذر قاهر، يُعتبر فاقداً لمقعده الجامعي ويُطوى قيده.
EOT;

$engine->ingestDocument("قوانين الجامعة - الإنذار والفصل", $laws);

echo "Laws ingested successfully!\n";
