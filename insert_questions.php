<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$course = App\Models\Course::find(2);

if (!$course) {
    echo "Course not found!\n";
    exit;
}

echo "Found Course: {$course->name} (ID: {$course->id})\n";

$chapter = App\Models\Chapter::where('course_id', $course->id)
    ->where(function ($query) {
        $query->where('title', 'like', '%الاول%')
              ->orWhere('title', 'like', '%1%')
              ->orWhere('title', 'like', '%first%')
              ->orWhere('title', 'like', '%أول%');
    })
    ->first();

if (!$chapter) {
    echo "Chapter 1 not found for this course!\n";
    echo "Creating it...\n";
    $chapter = App\Models\Chapter::create([
        'course_id' => $course->id,
        'title' => 'الشابتر الأول',
        'description' => 'مقدمة',
        'order' => 1,
        'is_active' => true,
    ]);
}

echo "Found/Created Chapter: {$chapter->title} (ID: {$chapter->id})\n";

$questions = [
    [
        'question_text' => 'Which of the following data types in Java is used to store a text value?',
        'option_a' => 'int',
        'option_b' => 'char',
        'option_c' => 'String',
        'option_d' => 'boolean',
        'correct_option' => 'c',
        'explanation' => 'The String class in Java is specifically designed to handle sequences of characters (text). In contrast, int is for integers, char is for a single character, and boolean holds true/false values.',
    ],
    [
        'question_text' => 'What is the main entry point for any Java application where execution begins?',
        'option_a' => 'public void start()',
        'option_b' => 'public static void main(String[] args)',
        'option_c' => 'private void main()',
        'option_d' => 'class Main',
        'correct_option' => 'b',
        'explanation' => 'The public static void main(String[] args) method signature is the standard entry point recognized by the Java Virtual Machine (JVM) to start executing any standalone application.',
    ]
];

foreach ($questions as $q) {
    App\Models\Question::create([
        'course_id' => $course->id,
        'chapter_id' => $chapter->id,
        'question_text' => $q['question_text'],
        'option_a' => $q['option_a'],
        'option_b' => $q['option_b'],
        'option_c' => $q['option_c'],
        'option_d' => $q['option_d'],
        'correct_option' => $q['correct_option'],
        'explanation' => $q['explanation'],
        'difficulty' => 'easy',
        'is_active' => true,
    ]);
}

echo "Questions inserted successfully!\n";
