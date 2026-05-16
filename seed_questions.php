<?php
use App\Models\Course;
use App\Models\Question;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$courses = Course::where('major_id', 2)->where('study_plan_version', 12)->get();
foreach($courses as $c) {
    Question::updateOrCreate(
        ['course_id' => $c->id, 'question_text' => 'سؤال تجريبي لمادة ' . $c->name],
        [
            'option_a' => 'أ',
            'option_b' => 'ب',
            'option_c' => 'ج',
            'option_d' => 'د',
            'correct_option' => 'a',
            'difficulty' => 'easy',
            'is_active' => true
        ]
    );
}
echo "Added questions to " . $courses->count() . " courses.\n";
