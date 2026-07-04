<?php

use App\Models\Course;
use App\Models\Question;
use App\Models\Chapter;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = Course::firstOrCreate(
    ['code' => 'DEMO2026'],
    [
        'name' => 'تحدي سنفور التجريبي 🏆',
        'credit_hours' => 0,
        'type' => 'university_elective',
        'semester' => 1,
        'is_quiz_only' => true,
        'study_plan_version' => 12, // Match the guest's default version
        'has_prerequisites' => false,
    ]
);

// Create a chapter for it
$chapter = Chapter::firstOrCreate(
    ['course_id' => $course->id, 'title' => 'أسئلة التجربة الذكية'],
    ['order' => 1, 'is_active' => true]
);

$questions = [
    [
        'question_text' => 'ما هي الميزة الرئيسية لمنصة سنفور التي تمنع تعارض المواد للطلاب؟',
        'option_a' => 'الخطة الشجرية التفاعلية',
        'option_b' => 'بنك الأسئلة',
        'option_c' => 'دفع الرسوم إلكترونياً',
        'option_d' => 'الجدول الأسبوعي',
        'correct_option' => 'a',
        'explanation' => 'الخطة الشجرية التفاعلية تمنع تعارض المواد وتضمن تسجيل الطالب للمواد بوجود المتطلبات السابقة.',
        'difficulty' => 'easy',
    ],
    [
        'question_text' => 'إذا قام الذكاء الاصطناعي (AI Advisor) في منصة سنفور بتحليل أداء الطالب ووجد أنه ضعيف في مواد البرمجة، بمَ سينصحه؟',
        'option_a' => 'تأجيل مواد البرمجة لنهاية الخطة',
        'option_b' => 'تسجيل مادة برمجة واحدة فقط مع مواد سهلة من متطلبات الجامعة لرفع المعدل',
        'option_c' => 'التحويل لتخصص آخر',
        'option_d' => 'تسجيل 18 ساعة لتعويض التراجع',
        'correct_option' => 'b',
        'explanation' => 'الذكاء الاصطناعي مبرمج لإعطاء نصائح استراتيجية لموازنة العبء الأكاديمي ورفع المعدل التراكمي.',
        'difficulty' => 'medium',
    ],
    [
        'question_text' => 'ما هو أقصى عدد ساعات يمكن تسجيله في الفصل الصيفي حسب معظم الخطط الدراسية؟',
        'option_a' => '9',
        'option_b' => '12',
        'option_c' => '18',
        'option_d' => '15',
        'correct_option' => 'a',
        'explanation' => 'الفصل الصيفي أقصر من الفصول العادية، لذا يكون الحد الأقصى عادة 9 ساعات.',
        'difficulty' => 'easy',
    ],
    [
        'question_text' => 'كيف يمكن تقييم سرعة استجابة منصة سنفور مقارنة بالأنظمة التقليدية؟',
        'option_a' => 'أبطأ بسبب الخوارزميات المعقدة',
        'option_b' => 'نفس السرعة',
        'option_c' => 'أسرع بكثير لأنها تعتمد على React و Inertia (SPA)',
        'option_d' => 'تعمل في أوقات الدوام الرسمي فقط',
        'correct_option' => 'c',
        'explanation' => 'تم بناء المنصة بتكنولوجيا Single Page Application (SPA) لضمان سرعة فائقة في التنقل بين الصفحات.',
        'difficulty' => 'medium',
    ],
    [
        'question_text' => 'كيف يمكن لطالب هندسة البرمجيات أن يستفيد من ميزة "حاسبة المعدل" قبل بدء التسجيل الفعلي؟',
        'option_a' => 'لا يمكنه ذلك',
        'option_b' => 'يمكنه تجربة سيناريوهات وهمية للعلامات لمعرفة المعدل المتوقع بدقة',
        'option_c' => 'يمكنه فقط حساب معدل الفصول السابقة',
        'option_d' => 'الحاسبة تعمل فقط بعد رصد العلامات الرسمية',
        'correct_option' => 'b',
        'explanation' => 'حاسبة المعدل تتيح للطالب إدخال علامات افتراضية (Target Grades) للتخطيط للمعدل التراكمي المستهدف.',
        'difficulty' => 'hard',
    ],
];

foreach ($questions as $q) {
    Question::firstOrCreate(
        ['course_id' => $course->id, 'question_text' => $q['question_text']],
        array_merge($q, ['chapter_id' => $chapter->id, 'is_active' => true])
    );
}

echo "Seeded Demo Quiz Challenge successfully!\n";
