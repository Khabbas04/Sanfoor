<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::where('code', 'DEMO2026')->first();
if (!$course) {
    echo "Course not found.\n";
    exit;
}

// Delete existing questions
\App\Models\Question::where('course_id', $course->id)->delete();

$chapter = \App\Models\Chapter::where('course_id', $course->id)->first();

$newQuestions = [
    [
        'question_text' => 'ما هو الهدف الأساسي من منصة سنفور؟',
        'option_a' => 'مساعدة الطلاب في اختيار وتسجيل موادهم الجامعية بذكاء',
        'option_b' => 'حجز المطاعم وتوصيل الطلبات',
        'option_c' => 'دفع الرسوم الجامعية',
        'option_d' => 'حجز قاعات الجامعة',
        'correct_option' => 'a',
        'explanation' => 'منصة سنفور صُممت خصيصاً لتكون المرشد الأكاديمي الذكي للطالب الجامعي.',
        'difficulty' => 'easy',
    ],
    [
        'question_text' => 'كيف تعرض منصة سنفور المواد الدراسية للطلاب؟',
        'option_a' => 'على شكل ملف PDF عادي',
        'option_b' => 'على شكل شجرة تفاعلية ذكية تفتح المواد تدريجياً بناءً على متطلباتها',
        'option_c' => 'كجدول إكسيل معقد',
        'option_d' => 'على شكل قائمة نصية طويلة جداً',
        'correct_option' => 'b',
        'explanation' => 'نستخدم الشجرة الأكاديمية التفاعلية عشان الطالب يشوف مساره الجامعي بكل وضوح وسهولة.',
        'difficulty' => 'easy',
    ],
    [
        'question_text' => 'ما الذي يميز حاسبة المعدل التنبؤية في سنفور؟',
        'option_a' => 'تحسب المعدل الحالي فقط',
        'option_b' => 'لا تعمل إلا للطلاب الخريجين',
        'option_c' => 'تقدر تتنبأ بالمعدل وتخبرك بالعلامات اللي بتحتاجها مستقبلاً لتصل لمعدل هدف معين',
        'option_d' => 'تحسب فقط تكلفة الساعات المالية',
        'correct_option' => 'c',
        'explanation' => 'حاسبة المعدل في سنفور ذكية جداً وتقدر تحسب بالعكس عشان تساعدك تخطط لمعدلك الجاي.',
        'difficulty' => 'easy',
    ],
    [
        'question_text' => 'كيف يساعدك بنك الأسئلة (Quiz Hub) في سنفور على الدراسة؟',
        'option_a' => 'يعطيك الإجابات جاهزة لتغش بالامتحان',
        'option_b' => 'يقدم لك امتحانات تجريبية تفاعلية ويحلل أداءك لتعرف نقاط ضعفك',
        'option_c' => 'ينجحك بالمادة تلقائياً',
        'option_d' => 'يحتوي فقط على أسئلة مقالية',
        'correct_option' => 'b',
        'explanation' => 'بنك الأسئلة بيعطيك تجربة امتحان حقيقية عشان تختبر معلوماتك قبل امتحان الجامعة.',
        'difficulty' => 'easy',
    ],
    [
        'question_text' => 'لما تستخدم المرشد الذكي بالذكاء الاصطناعي في سنفور، شو رح تستفيد؟',
        'option_a' => 'بيقترح عليك أفضل المواد اللي تسجلها بناءً على خطتك عشان تتخرج بأسرع وقت',
        'option_b' => 'بيحل الواجبات عنك',
        'option_c' => 'بيتواصل مع الدكاترة بالنيابة عنك',
        'option_d' => 'بيختارلك أصدقاء بالجامعة',
        'correct_option' => 'a',
        'explanation' => 'المرشد الذكي بحلل خطتك وعلاماتك وبيعطيك التوصية المثالية للتسجيل.',
        'difficulty' => 'easy',
    ],
];

foreach ($newQuestions as $q) {
    \App\Models\Question::firstOrCreate(
        ['course_id' => $course->id, 'question_text' => $q['question_text']],
        array_merge($q, ['chapter_id' => $chapter->id, 'is_active' => true])
    );
}

echo "Updated questions to be simpler and general!\n";
