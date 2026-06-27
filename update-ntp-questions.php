<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$course = \App\Models\Course::where('code', 'NTP2026')->first();
if (!$course) {
    echo "Course not found.\n";
    exit;
}

// Delete existing questions
\App\Models\Question::where('course_id', $course->id)->delete();

$chapter = \App\Models\Chapter::where('course_id', $course->id)->first();

$newQuestions = [
    [
        'question_text' => 'منظومة الذكاء الاصطناعي (Sanfoor AI Advisor) تعتمد على خوارزميات التوصية المتقدمة. أي من العوامل التالية يحمل الوزن الأكبر عند تقديم النصيحة لتسجيل مادة معينة؟',
        'option_a' => 'طول اسم المادة وعدد الشعب المتاحة',
        'option_b' => 'موقع المادة الاستراتيجي في "الشجرة" (كم مادة تفتح لاحقاً) ومعدل صعوبتها التاريخي',
        'option_c' => 'فقط عدد الساعات المعتمدة للمادة',
        'option_d' => 'المسافة الجغرافية بين القاعات',
        'correct_option' => 'b',
        'explanation' => 'يعتمد الذكاء الاصطناعي على خوارزمية (Node Unlock Weighting) مع دمج (Historical Difficulty Scores) لضمان عدم تأخر الطالب عن التخرج ورفع معدله.',
        'difficulty' => 'hard',
    ],
    [
        'question_text' => 'تم بناء المعمارية البرمجية لمنصة سنفور بالاعتماد على (Inertia.js & React) بدلاً من معمارية (Blade/MVC) التقليدية. ما هو الهدف التقني الأساسي من هذا القرار؟',
        'option_a' => 'لتقليل حجم قاعدة البيانات',
        'option_b' => 'لتحويل المنصة إلى (Single Page Application) لضمان سرعة فائقة في تنقلات المستخدم (Client-Side Routing) مع الحفاظ على قوة خوادم Laravel.',
        'option_c' => 'لتسهيل كتابة أوامر الـ SQL',
        'option_d' => 'لتخطي أنظمة الحماية الجدارية',
        'correct_option' => 'b',
        'explanation' => 'استخدام Inertia.js يوفر تجربة سلسة جداً (SPA) حيث لا يتم إعادة تحميل الصفحة أبداً، مما يوفر سرعة استجابة هائلة تناسب تطبيق تفاعلي معقد كالشجرة.',
        'difficulty' => 'hard',
    ],
    [
        'question_text' => 'كيف تتعامل منصة سنفور مع مشكلة "Data Bloat" (تضخم البيانات) الناتجة عن زوار النسخة التجريبية (Guest Demo) للحفاظ على نظافة النظام الأساسي؟',
        'option_a' => 'الاحتفاظ بهم إلى الأبد لزيادة أرقام المستخدمين الوهمية',
        'option_b' => 'تنفيذ آلية تدمير ذاتي (Self-Destruct) تقوم بمسح بيانات الضيف تماماً من قاعدة البيانات بمجرد انتهاء الجلسة أو تسجيل الخروج.',
        'option_c' => 'منع الضيوف من حفظ أي بيانات',
        'option_d' => 'إنشاء قاعدة بيانات منفصلة تماماً لكل ضيف',
        'correct_option' => 'b',
        'explanation' => 'هندسة المنصة تتضمن Trigger برمجي عند (Logout) يحذف كائن الـ User وكل علاقاته (Cascade Delete) لمنع تراكم الـ (Garbage Data).',
        'difficulty' => 'medium',
    ],
    [
        'question_text' => 'في محرك الامتحانات التفاعلي (Quiz Hub) الخاص بسنفور، كيف يتم تقييم "مستوى الطالب" ديناميكياً؟',
        'option_a' => 'عن طريق حساب نسبة مئوية ثابتة (عدد الإجابات الصحيحة / الإجمالي)',
        'option_b' => 'عن طريق نظام ربط متقدم يخزن (Quiz Attempts) ويحلل الأداء لكل (Chapter) بشكل منفصل لاكتشاف نقاط ضعف الطالب الدقيقة.',
        'option_c' => 'بشكل عشوائي',
        'option_d' => 'يعتمد على سرعة الطباعة على الكيبورد',
        'correct_option' => 'b',
        'explanation' => 'يتم حفظ الجلسات بجدول Attempts مع JSON Payload متكامل للإجابات، مما يتيح تقديم Feedback مفصل حول الفصول الدراسية التي تحتاج لتحسين.',
        'difficulty' => 'hard',
    ],
    [
        'question_text' => 'الشجرة الأكاديمية (Interactive Tree) تحتوي على قواعد عمل (Business Logic) معقدة جداً للتحقق من المتطلبات السابقة. أين يتم تطبيق هذه القواعد تقنياً في سنفور؟',
        'option_a' => 'في الـ Frontend فقط (بالجافاسكربت) لضمان السرعة',
        'option_b' => 'تطبيق مزدوج (Dual Validation): في الـ Frontend للتجربة اللحظية السلسة، وفي الـ Backend (Laravel API) لضمان أمن وسلامة البيانات ومنع التلاعب.',
        'option_c' => 'يتم إدخالها يدوياً من قبل المبرمجين لكل طالب',
        'option_d' => 'في الـ Database فقط عن طريق (Stored Procedures)',
        'correct_option' => 'b',
        'explanation' => 'التطبيق المزدوج هو أفضل الممارسات الهندسية (Best Practice) لحماية سلامة البيانات (Data Integrity) مع توفير تجربة مستخدم (UX) فائقة الاستجابة.',
        'difficulty' => 'medium',
    ],
];

foreach ($newQuestions as $q) {
    \App\Models\Question::firstOrCreate(
        ['course_id' => $course->id, 'question_text' => $q['question_text']],
        array_merge($q, ['chapter_id' => $chapter->id, 'is_active' => true])
    );
}

echo "Updated questions to professional tech level!\n";
