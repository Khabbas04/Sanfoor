<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$chapter1 = App\Models\Chapter::where('course_id', 2)->where('title', 'like', '%CHAPTER 1%')->first();
if ($chapter1) {
    App\Models\Question::where('course_id', 2)->update(['chapter_id' => $chapter1->id]);
    echo "Questions moved to: " . $chapter1->title . "\n";
    // Delete the incorrectly created one
    App\Models\Chapter::where('title', 'الشابتر الأول')->where('course_id', 2)->delete();
} else {
    echo "Could not find CHAPTER 1\n";
}
