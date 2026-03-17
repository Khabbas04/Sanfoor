<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use App\Models\Chat;
use App\Models\Message;
use App\Models\Course;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AiAdvisorController extends Controller
{
    // ==========================================
    // ⚙️ إعدادات ثابتة
    // ==========================================
    
    /** الحد الأقصى لعدد الرسائل المرسلة للـ AI (Context Window) */
    private const MAX_CONTEXT_MESSAGES = 20;
    
    /** الحد الأقصى للرسائل في الساعة لكل طالب */
    private const RATE_LIMIT_PER_HOUR = 40;
    
    /** مدة كاش بيانات الطالب الأكاديمية (بالدقائق) */
    private const STUDENT_DATA_CACHE_MINUTES = 30;

    /** الحد الأقصى للساعات للطالب العادي */
    private const MAX_HOURS_NORMAL = 18;

    /** الحد الأقصى للساعات لطالب الإنذار */
    private const MAX_HOURS_PROBATION = 12;

    // ==========================================
    // 🔧 أدوات مساعدة
    // ==========================================

    /**
     * توحيد الحروف العربية لمنع مشاكل البحث
     */
    private function normalizeArabic($text)
    {
        if (!$text) return '';
        $text = preg_replace('/[أإآا]/u', 'ا', $text);
        $text = preg_replace('/[ةه]/u', 'ه', $text);
        $text = preg_replace('/ى/u', 'ي', $text);
        $text = preg_replace('/\s+/', ' ', $text);
        return mb_strtolower(trim($text), 'UTF-8');
    }

    /**
     * جلب بيانات الطالب الأكاديمية بشكل مباشر (Real-time — بدون كاش)
     */
    private function getStudentAcademicData($user)
    {
        $user->load('major', 'passedCourses', 'cartCourses');

        $majorName = $user->major ? $user->major->name : 'تخصص عام';
        $gpaData = $user->calculateGPA();
        $isProbation = (isset($gpaData['percentage']) && (float)$gpaData['percentage'] < 60);
        $passedCourseIds = $user->passedCourses->pluck('id')->toArray();
        $totalPassedHours = $user->passedCourses->sum('credit_hours');

        // حساب إجمالي ساعات الخطة (لو متاح)
        $totalPlanHours = null;
        if ($user->major && method_exists($user->major, 'getTotalHours')) {
            $totalPlanHours = $user->major->getTotalHours();
        }

        return [
            'major_name' => $majorName,
            'gpa_data' => $gpaData,
            'is_probation' => $isProbation,
            'passed_course_ids' => $passedCourseIds,
            'passed_courses_names' => $user->passedCourses->pluck('name')->implode('، '),
            'total_passed_hours' => $totalPassedHours,
            'total_plan_hours' => $totalPlanHours,
            'max_allowed_hours' => $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL,
        ];
    }

    /**
     * فحص Rate Limit
     */
    private function checkRateLimit($userId)
    {
        $key = "ai_rate_limit_{$userId}";
        $current = Cache::get($key, 0);

        if ($current >= self::RATE_LIMIT_PER_HOUR) {
            return false;
        }

        Cache::put($key, $current + 1, now()->addHour());
        return true;
    }

    /**
     * جلب المواد المتاحة مع تحليل استراتيجي مُعزَّز
     * ────────────────────────────────────────────────
     * التحسينات:
     *  - استخراج "سنة المادة" من الرقم الرابع في رمز المادة (مثال: 100312 → 3 → سنة ثالثة)
     *  - تمرير أول 150 حرف من وصف المادة (RAG) ليدرسه الـ AI
     *  - تمرير عدد المتطلبات السابقة ونوع المادة في النص
     */
    private function getAvailableCourses($passedCourseIds, $cartCourseIds)
    {
        $unpassedCourses = Course::with(['prerequisites', 'children'])
            ->whereNotIn('id', $passedCourseIds)
            ->get();

        $availableCoursesMap = [];
        $availableCoursesText = [];
        $availableCoursesDetails = [];

        foreach ($unpassedCourses as $course) {
            // فحص المتطلبات السابقة
            $canTake = true;
            foreach ($course->prerequisites as $prereq) {
                if (!in_array($prereq->id, $passedCourseIds)) {
                    $canTake = false;
                    break;
                }
            }

            if (!$canTake) continue;

            // حتى لو بالمحاكي، نضيفها للـ map عشان الـ AI يعرفها
            $availableCoursesMap[$course->id] = $course->name;

            // ─── استخراج سنة المادة من الرقم الرابع في الرمز ───
            // مثال: الكود 100312 → الرقم الرابع '3' → سنة ثالثة
            // مثال: الكود 110421 → الرقم الرابع '4' → سنة رابعة
            $courseYear = 1; // القيمة الافتراضية
            if (strlen($course->code) >= 4) {
                $fourthDigit = (int) substr($course->code, 3, 1);
                $courseYear = ($fourthDigit >= 1 && $fourthDigit <= 5) ? $fourthDigit : 1;
            }

            $unlocksCount = $course->children->count();
            $prereqCount = $course->prerequisites->count();
            $inCart = in_array($course->id, $cartCourseIds);
            $courseType = $course->type ?? 'غير محدد';

            // ─── استخراج أول 150 حرف من الوصف (RAG) ───
            $descriptionSnippet = '';
            if (!empty($course->description)) {
                $descriptionSnippet = mb_substr($course->description, 0, 150, 'UTF-8');
                if (mb_strlen($course->description, 'UTF-8') > 150) {
                    $descriptionSnippet .= '...';
                }
            }

            // ─── بناء التاغات ───
            $tags = [];
            if ($unlocksCount > 0) $tags[] = "🔥 استراتيجية (تفتح {$unlocksCount} مواد)";
            if ($inCart) $tags[] = "🛒 موجودة بالمحاكي حالياً";

            $tagString = !empty($tags) ? ' [' . implode(' | ', $tags) . ']' : '';

            // ─── بناء نص المادة المُعزَّز للـ AI ───
            $courseTextLine = "- {$course->name} (رمز: {$course->code}, ساعات: {$course->credit_hours}, سنة_المادة: {$courseYear}, نوع: {$courseType}, عدد_المتطلبات: {$prereqCount}){$tagString}";

            // إضافة الوصف المختصر إن وجد (سطر فرعي)
            if (!empty($descriptionSnippet)) {
                $courseTextLine .= "\n  📝 وصف: {$descriptionSnippet}";
            }

            $availableCoursesText[] = $courseTextLine;

            $availableCoursesDetails[$course->id] = [
                'name' => $course->name,
                'code' => $course->code,
                'credit_hours' => $course->credit_hours,
                'course_year' => $courseYear,
                'type' => $courseType,
                'prereq_count' => $prereqCount,
                'unlocks' => $unlocksCount,
                'in_cart' => $inCart,
            ];
        }

        return [
            'map' => $availableCoursesMap,
            'text' => empty($availableCoursesText) ? 'لا يوجد مواد متاحة للتسجيل حالياً!' : implode("\n", $availableCoursesText),
            'details' => $availableCoursesDetails,
        ];
    }

    /**
     * بناء System Prompt الديناميكي مع خوارزمية الإرشاد الذكية
     * ──────────────────────────────────────────────────────────
     * التحسينات:
     *  - حساب السنة الدراسية الحالية للطالب من الساعات المنجزة (كل 33 ساعة = سنة)
     *  - خوارزمية الصعوبة النسبية (Relative Scoring) مزروعة داخل البرومبت
     *  - هندسة الجداول (Anti-Suicide Schedules) لمنع العشوائية
     *  - قواعد حالة الإنذار الأكاديمي الصارمة
     *  - الشرح البشري بدلاً من نسخ الوصف
     */
    private function buildSystemPrompt($user, $academicData, $cartData, $availableCourses)
    {
        // ─── حساب السنة الدراسية الحالية للطالب ───
        // كل 33 ساعة = سنة دراسية واحدة
        // مثال: 0-32 ساعة = سنة أولى، 33-65 = سنة ثانية، 66-98 = سنة ثالثة، 99-131 = سنة رابعة، 132+ = سنة خامسة
        $totalPassedHours = $academicData['total_passed_hours'] ?? 0;
        $studentYear = ($totalPassedHours > 0) ? (int) ceil($totalPassedHours / 33) : 1;
        $studentYear = max(1, min($studentYear, 5)); // حد أدنى 1، أقصى 5

        $studentYearLabels = [1 => 'أولى', 2 => 'ثانية', 3 => 'ثالثة', 4 => 'رابعة', 5 => 'خامسة'];
        $studentYearLabel = $studentYearLabels[$studentYear] ?? $studentYear;

        $gpaText = "المعدل المئوي: {$academicData['gpa_data']['percentage']}% ({$academicData['gpa_data']['gpa4']} من 4.00)";
        $probationStatus = $academicData['is_probation']
            ? "🚨 نعم — إنذار أكاديمي! (الحد الأقصى {$academicData['max_allowed_hours']} ساعة فقط)"
            : "لا (الحد الأقصى {$academicData['max_allowed_hours']} ساعة)";

        $progressText = '';
        if ($academicData['total_plan_hours']) {
            $percent = round(($academicData['total_passed_hours'] / $academicData['total_plan_hours']) * 100);
            $progressText = "\n        - التقدم نحو التخرج: {$academicData['total_passed_hours']}/{$academicData['total_plan_hours']} ساعة ({$percent}%)";
        }

        // تحليل العبء الحالي بالمحاكي
        $cartWarning = '';
        if ($cartData['hours'] > $academicData['max_allowed_hours']) {
            $excess = $cartData['hours'] - $academicData['max_allowed_hours'];
            $cartWarning = "\n        ⚠️ تنبيه: المحاكي يحتوي {$cartData['hours']} ساعة وهذا يتجاوز الحد المسموح بـ {$excess} ساعة!";
        }

        return "أنت 'سنفور'، المستشار الأكاديمي الخبير والودود من فريق منصة (Kollia). مهمتك توجيه الطلاب الجامعيين بذكاء واحترافية.

        📊 [ملف الطالب]:
        - الاسم: {$user->name}
        - التخصص: {$academicData['major_name']}
        - السنة الدراسية الحالية: سنة {$studentYearLabel} (محسوبة من {$totalPassedHours} ساعة منجزة ÷ 33)
        - {$gpaText}
        - حالة الإنذار: {$probationStatus}
        - الساعات المنجزة: {$academicData['total_passed_hours']} ساعة{$progressText}
        - المواد المنجزة: [{$academicData['passed_courses_names']}]
        - المحاكي الحالي: [" . ($cartData['list'] ?: 'فارغ') . "] ({$cartData['hours']} ساعة){$cartWarning}

        📚 [المواد المتاحة للتسجيل]:
        {$availableCourses['text']}

        ═══════════════════════════════════════════════════════
        🧮 [خوارزمية الصعوبة النسبية — Relative Difficulty Scoring]:
        ═══════════════════════════════════════════════════════
        ⚠️ لا تخمّن صعوبة أي مادة! احسبها رياضياً كالتالي:

        المعادلة: difficulty_score = base + prereq_bonus + unlock_bonus + keyword_modifier
        
        1. **الأساس (base)**: خذ قيمة (سنة_المادة) من بيانات المادة أعلاه.
           - إذا كانت سنة_المادة < {$studentYear} (سنة الطالب الحالية) ← اطرح 1 من الأساس (النضج الأكاديمي يسهّلها).
           - مثال: طالب سنة رابعة يأخذ مادة سنة ثانية → الأساس = 2 - 1 = 1.
        2. **مكافأة المتطلبات (+1)**: إذا كان عدد_المتطلبات > 0 ← أضف 1.
        3. **مكافأة الفتح (+1)**: إذا كانت المادة تفتح مواد أخرى (🔥 استراتيجية) ← أضف 1.
        4. **معدِّل الكلمات المفتاحية**:
           - إذا اسم المادة يحتوي (رياضيات، تحليل، حسابات، برمجة، خوارزميات، هياكل) ← أضف +1.
           - إذا اسم المادة يحتوي (مهارات، ثقافة، تربية، حقوق، أخلاقيات) ← اطرح -2.
        5. **التطبيع**: النتيجة النهائية يجب أن تكون بين 1 (أسهل) و 5 (أصعب). إذا خرجت عن النطاق، قرّبها لأقرب حد.

        مثال عملي: مادة \"هياكل بيانات\" (سنة_المادة: 2، عدد_المتطلبات: 1، تفتح 3 مواد) لطالب سنة رابعة:
        base = 2 - 1 = 1 (سنة المادة أصغر من سنة الطالب)
        + 1 (لها متطلبات) + 1 (تفتح مواد) + 1 (برمجة/هياكل) = 4 → صعوبة 4 من 5.

        ═══════════════════════════════════════════════════════
        📐 [هندسة الجداول — Anti-Suicide Schedule Rules]:
        ═══════════════════════════════════════════════════════
        ⛔ ممنوع اقتراح جداول عشوائية! اتبع هذه القواعد الصارمة:

        📌 **الجدول المثالي (15 ساعة)** يجب أن يتكون من:
        - مادتان دسمتان (صعوبة 4-5) → التحدي الأكاديمي
        - مادتان متوسطتان (صعوبة 3) → التوازن
        - مادة سهلة واحدة (صعوبة 1-2) → لرفع المعدل والراحة النفسية

        📌 **الحد الأقصى المطلق**: يُمنع منعاً باتاً وضع أكثر من 3 مواد دسمة (صعوبة 4-5) في جدول واحد مهما كانت الظروف.

        📌 **التوزيع حسب عدد الساعات المطلوبة**:
        - 9-12 ساعة (جدول خفيف): 1 دسمة + 1-2 متوسطة + 1 سهلة
        - 12-15 ساعة (جدول متوازن): 2 دسمة + 2 متوسطة + 1 سهلة
        - 15-18 ساعة (جدول مكثّف): 2-3 دسمة + 2 متوسطة + 1-2 سهلة

        ═══════════════════════════════════════════════════════
        🚨 [قواعد حالة الإنذار الأكاديمي]:
        ═══════════════════════════════════════════════════════" .
        ($academicData['is_probation'] ? "
        ⚠️ هذا الطالب تحت الإنذار الأكاديمي! طبّق هذه القواعد إلزامياً:
        - يُمنع تماماً اقتراح أي مادة صعبة (صعوبة 3 فما فوق).
        - ركّز فقط على مواد الجامعة السهلة (صعوبة 1-2) لإنقاذ معدله.
        - اقترح 3-4 مواد سهلة كحد أقصى ({$academicData['max_allowed_hours']} ساعة).
        - شجّع الطالب بلطف وحذّره أن هذا الفصل هو فصل الإنقاذ.
        - لا تقترح مواد تخصصية دسمة حتى لو كانت استراتيجية." : "
        الطالب ليس تحت إنذار أكاديمي. طبّق القواعد العادية أعلاه.") . "

        ═══════════════════════════════════════════════════════
        📖 [قاعدة الشرح البشري — Human-Style Description]:
        ═══════════════════════════════════════════════════════
        عندما يكون للمادة وصف (📝) في قائمة المواد أعلاه:
        - ⛔ **ممنوع** نسخ الوصف حرفياً أو إعادة صياغته كما هو!
        - ✅ **المطلوب**: اقرأ الوصف، افهمه، ثم اشرحه للطالب بأسلوبك الخاص:
          - استخدم لغة عامية مبسطة وقريبة من الطالب.
          - أضف تشبيهات أو أمثلة عملية (\"يعني مثلاً بتتعلم كيف...\").
          - اجعل الشرح محفزاً ومشوّقاً (\"هاي المادة بتعطيك سوبر باور في...\").

        🧠 [قواعد التفكير العامة]:
        1. خاطب الطالب باسمه بأسلوب ودود ومشجع.
        2. كن مستشاراً مفصلاً — اشرح **لماذا** اخترت كل مادة (تفتح مواد، ترفع المعدل، خفيفة...)، واذكر درجة صعوبتها المحسوبة.
        3. إذا كان الطالب تحت الإنذار: ركز على مواد سهلة لرفع المعدل + حذّره بلطف من تسجيل أكثر من {$academicData['max_allowed_hours']} ساعة.
        4. إذا تجاوز المحاكي الحد المسموح، نبّه الطالب فوراً واقترح مواد لحذفها.
        5. ركّز على المواد الاستراتيجية (🔥) لأنها تفتح مساراً أوسع.
        6. نسّق إجابتك بشكل جميل بالرموز التعبيرية (🚀🎯💡📊⚡) والخط العريض.
        7. **قاعدة حاسمة:** اكتب أسماء المواد بالضبط كما في القائمة عشان نظامنا يربطها بأزرار الإضافة.
        8. في نهاية كل رد، أضف 2-3 أسئلة متابعة مقترحة للطالب.

        🎮 [الأدوات التفاعلية - Interactive Widgets]:
        يمكنك استخدام أدوات تفاعلية خاصة بالإضافة للنص العادي. أضفها في حقل \"interactive_widget\" في الرد:

        أ) **بطاقات مقارنة** (عندما تقترح 2-4 مواد وتريد المقارنة بينها):
        \"interactive_widget\": {
            \"type\": \"comparison\",
            \"title\": \"مقارنة المواد المقترحة\",
            \"items\": [
                { \"name\": \"اسم المادة\", \"code\": \"CS101\", \"credit_hours\": 3, \"difficulty\": 3, \"unlocks\": 2, \"gpa_impact\": \"مرتفع\", \"recommendation\": \"⭐ الأفضل استراتيجياً\" }
            ]
        }
        - difficulty: احسبها بالمعادلة أعلاه (1-5)، **لا تخمّنها!**
        - unlocks: عدد المواد التي تفتحها
        - gpa_impact: \"مرتفع\" أو \"متوسط\" أو \"منخفض\"
        - recommendation: نص قصير (اختياري، للمادة المفضلة فقط)

        ب) **استطلاع سريع** (عندما تحتاج معرفة أولوية الطالب قبل الاقتراح):
        \"interactive_widget\": {
            \"type\": \"poll\",
            \"question\": \"شو أولويتك هالفصل؟\",
            \"options\": [
                { \"label\": \"رفع المعدل 📈\", \"value\": \"gpa\" },
                { \"label\": \"تسريع التخرج 🎓\", \"value\": \"speed\" },
                { \"label\": \"تخفيف العبء 😌\", \"value\": \"light\" }
            ]
        }

        ج) **سلايدر الساعات** (لمعرفة كم ساعة يريد الطالب):
        \"interactive_widget\": {
            \"type\": \"hours_slider\",
            \"question\": \"كم ساعة حابب تسجل هالفصل؟\",
            \"min\": 9,
            \"max\": {$academicData['max_allowed_hours']},
            \"default\": 15,
            \"current_cart_hours\": {$cartData['hours']}
        }

        د) **مراجعة المحاكي** (عندما يطلب الطالب مراجعة جدوله):
        \"interactive_widget\": {
            \"type\": \"cart_review\",
            \"title\": \"مراجعة المحاكي الحالي\",
            \"courses\": [
                { \"name\": \"اسم المادة\", \"code\": \"CS101\", \"credit_hours\": 3, \"difficulty\": 3, \"verdict\": \"keep\", \"reason\": \"مادة أساسية تفتح 3 مواد\" }
            ],
            \"summary\": { \"total_hours\": 15, \"max_hours\": 18, \"overall_difficulty\": \"متوسط\", \"recommendation\": \"جدول متوازن ومناسب\" }
        }
        - verdict: \"keep\" (أبقها) أو \"remove\" (احذفها) أو \"warning\" (انتبه)
        - difficulty: احسبها بالمعادلة أعلاه (1-5)، **لا تخمّنها!**
        
        **متى تستخدم كل أداة:**
        - إذا سأل الطالب \"اقترح لي مواد\" أو \"قارن بين مواد\" ← استخدم comparison
        - إذا سأل سؤال عام بدون تحديد أولوية ← استخدم poll أولاً
        - إذا سأل \"كم ساعة أسجل\" أو \"ساعدني أختار عدد الساعات\" ← استخدم hours_slider
        - إذا سأل \"راجع المحاكي\" أو \"شو رأيك بجدولي\" أو \"العبء كبير\" ← استخدم cart_review
        - إذا السؤال لا يحتاج أداة تفاعلية ← لا تضف interactive_widget

        ⚠️ شكل الرد الإجباري (JSON صالح فقط، بدون markdown):
        {
            \"reply\": \"نص الرد...\",
            \"suggested_courses\": [],
            \"courses_to_remove\": [],
            \"follow_up_suggestions\": [\"سؤال مقترح 1\", \"سؤال مقترح 2\"],
            \"interactive_widget\": null
        }";
    }

    /**
     * بناء Context المحادثة مع إدارة ذكية للحجم
     */
    private function buildConversationContext($chat, $systemPrompt)
    {
        $allMessages = $chat->messages()->orderBy('created_at', 'asc')->get();

        // إذا المحادثة طويلة، نأخذ بس آخر N رسالة
        $messagesToSend = $allMessages;
        $summaryPrefix = '';

        if ($allMessages->count() > self::MAX_CONTEXT_MESSAGES) {
            // نأخذ أول رسالتين (السياق الأولي) + آخر N رسالة
            $firstTwo = $allMessages->take(2);
            $lastN = $allMessages->slice(-1 * (self::MAX_CONTEXT_MESSAGES - 2));
            $skippedCount = $allMessages->count() - self::MAX_CONTEXT_MESSAGES;
            $summaryPrefix = "\n[ملاحظة: تم اختصار {$skippedCount} رسالة سابقة من المحادثة للحفاظ على الأداء]\n";
            $messagesToSend = $firstTwo->merge($lastN);
        }

        $contents = [];
        foreach ($messagesToSend as $index => $msg) {
            $text = $msg->content;

            if ($msg->role === 'ai') {
                $decoded = json_decode($text, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($decoded['reply'])) {
                    $text = $decoded['reply'];
                }
            }

            // حقن System Prompt مع أول رسالة
            if ($index === 0 && $msg->role === 'user') {
                $text = "تعليمات النظام (لا تظهر للطالب):\n" . $systemPrompt . $summaryPrefix . "\n\nسؤال الطالب:\n" . $text;
            }

            $contents[] = [
                'role' => $msg->role === 'ai' ? 'model' : 'user',
                'parts' => [['text' => $text]]
            ];
        }

        return $contents;
    }

    /**
     * ربط أسماء المواد في الـ Interactive Widget بالـ IDs الحقيقية
     * الـ AI بيرجع أسماء المواد بس بدون ID، فلازم نطابقها مع قاعدة البيانات
     */
    private function enrichWidgetWithCourseIds($widget, $availableCoursesMap, $cartCoursesMap)
    {
        if (!$widget || !isset($widget['type'])) return $widget;

        // دمج كل المواد المعروفة (المتاحة + اللي بالمحاكي)
        $allCoursesMap = $availableCoursesMap + $cartCoursesMap;

        // دالة مساعدة: تبحث عن ID المادة من اسمها
        $findCourseId = function ($name) use ($allCoursesMap) {
            if (!$name) return null;
            $normalized = $this->normalizeArabic($name);
            foreach ($allCoursesMap as $id => $courseName) {
                if ($this->normalizeArabic($courseName) === $normalized) {
                    return $id;
                }
            }
            // بحث جزئي كـ fallback
            foreach ($allCoursesMap as $id => $courseName) {
                if (mb_strpos($this->normalizeArabic($courseName), $normalized) !== false ||
                    mb_strpos($normalized, $this->normalizeArabic($courseName)) !== false) {
                    return $id;
                }
            }
            return null;
        };

        switch ($widget['type']) {
            case 'comparison':
                if (isset($widget['items']) && is_array($widget['items'])) {
                    foreach ($widget['items'] as &$item) {
                        if (empty($item['id']) && !empty($item['name'])) {
                            $item['id'] = $findCourseId($item['name']);
                        }
                    }
                    unset($item);
                }
                break;

            case 'cart_review':
                if (isset($widget['courses']) && is_array($widget['courses'])) {
                    foreach ($widget['courses'] as &$course) {
                        if (empty($course['id']) && !empty($course['name'])) {
                            $course['id'] = $findCourseId($course['name']);
                        }
                    }
                    unset($course);
                }
                break;
        }

        return $widget;
    }

    /**
     * خوارزمية الصياد المحسّنة — مطابقة أسماء المواد بذكاء
     */
    private function matchCoursesInReply($replyText, $availableCoursesMap, $cartCoursesMap)
    {
        $normalizedReply = $this->normalizeArabic($replyText);
        $suggestedIds = [];
        $removeIds = [];

        // البحث عن مواد مقترحة للإضافة
        foreach ($availableCoursesMap as $id => $name) {
            $normalizedName = $this->normalizeArabic($name);
            if (mb_strlen($normalizedName) >= 3 && mb_strpos($normalizedReply, $normalizedName) !== false) {
                $suggestedIds[] = $id;
            }
        }

        // البحث عن مواد مقترحة للحذف
        $removeKeywords = '(حذف|ازاله|إزالة|تخفيف|امسح|شيل|أزيل|ألغ|الغ|ارفع|اشيل)';
        foreach ($cartCoursesMap as $id => $name) {
            $normalizedName = $this->normalizeArabic($name);
            if (mb_strlen($normalizedName) < 3) continue;

            if (mb_strpos($normalizedReply, $normalizedName) !== false) {
                // فحص سياق الحذف: الكلمة قبل أو بعد اسم المادة
                if (preg_match('/' . $removeKeywords . '.*?' . preg_quote($normalizedName, '/') . '/iu', $normalizedReply) ||
                    preg_match('/' . preg_quote($normalizedName, '/') . '.*?' . $removeKeywords . '/iu', $normalizedReply)) {
                    $removeIds[] = $id;
                }
            }
        }

        return [
            'suggested' => array_values(array_unique(array_filter(array_map('intval', $suggestedIds)))),
            'remove' => array_values(array_unique(array_filter(array_map('intval', $removeIds)))),
        ];
    }

    /**
     * استدعاء Gemini API
     */
    private function callGeminiAPI($contents, $apiKey)
    {
        $baseUrl = "https://" . "generativelanguage.googleapis.com";
        $endpoint = "/v1beta/models/gemini-2.5-flash:generateContent?key=";
        $url = $baseUrl . $endpoint . $apiKey;

        $response = Http::withoutVerifying()
            ->timeout(90)
            ->withHeaders(['Content-Type' => 'application/json'])
            ->post($url, [
                'contents' => $contents,
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                ],
            ]);

        if (!$response->successful()) {
            throw new \Exception("خطأ من Gemini API: HTTP {$response->status()}");
        }

        $data = $response->json();
        if (!isset($data['candidates'][0]['content']['parts'][0]['text'])) {
            throw new \Exception("الذكاء الاصطناعي لم يُرجع نصاً.");
        }

        return $data['candidates'][0]['content']['parts'][0]['text'];
    }

    /**
     * تنظيف واستخراج JSON من رد الـ AI
     */
    private function parseAIResponse($rawText)
    {
        // تنظيف markdown code fences
        $clean = preg_replace('/```(?:json)?(.*?)```/is', '$1', $rawText);
        $clean = trim($clean);

        $parsed = json_decode($clean, true);

        if (json_last_error() === JSON_ERROR_NONE && isset($parsed['reply'])) {
            return [
                'reply' => $parsed['reply'],
                'follow_up_suggestions' => $parsed['follow_up_suggestions'] ?? [],
                'interactive_widget' => $parsed['interactive_widget'] ?? null,
            ];
        }

        // fallback: استخراج reply بالـ regex
        if (preg_match('/"reply"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $clean, $matches)) {
            $reply = str_replace(['\\n', '\n'], "\n", $matches[1]);
            $reply = str_replace(['\\"'], '"', $reply);
            return ['reply' => $reply, 'follow_up_suggestions' => [], 'interactive_widget' => null];
        }

        // آخر حل: رجّع النص كامل بدون JSON wrappers
        $fallback = preg_replace('/[{}"\[\]]/', '', $clean);
        $fallback = preg_replace('/(reply|suggested_courses|courses_to_remove|follow_up_suggestions|interactive_widget)\s*:/', '', $fallback);
        return ['reply' => trim($fallback), 'follow_up_suggestions' => [], 'interactive_widget' => null];
    }

    /**
     * توليد عنوان ذكي للمحادثة باستخدام AI
     */
    private function generateSmartTitle($userMessage, $aiReply, $apiKey)
    {
        try {
            $prompt = "بناءً على هذا السؤال: \"{$userMessage}\"\nوهذا الجواب المختصر: \"" . mb_substr($aiReply, 0, 200) . "\"\n\nاكتب عنوان قصير جداً (3-6 كلمات عربية) يلخص الموضوع. أرجع النص فقط بدون علامات تنصيص.";

            $response = Http::withoutVerifying()
                ->timeout(15)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" . $apiKey, [
                    'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                ]);

            if ($response->successful()) {
                $title = $response->json('candidates.0.content.parts.0.text');
                if ($title) {
                    $title = trim(str_replace(['"', "'", '`', "\n"], '', $title));
                    if (mb_strlen($title) > 2 && mb_strlen($title) < 60) {
                        return $title;
                    }
                }
            }
        } catch (\Exception $e) {
            Log::debug("Smart title generation failed: " . $e->getMessage());
        }

        // Fallback
        return mb_substr($userMessage, 0, 35) . (mb_strlen($userMessage) > 35 ? '...' : '');
    }

    // ==========================================
    // 📄 الصفحة الرئيسية
    // ==========================================

    public function index()
    {
        $user = Auth::user();
        $user->load('major', 'cartCourses', 'passedCourses');

        $majorName = $user->major ? $user->major->name : 'غير محدد';
        $chats = $user->chats()
            ->select('id', 'title', 'created_at')
            ->orderBy('created_at', 'desc')
            ->get();

        $initialCartIds = $user->cartCourses->pluck('id')->toArray();
        
        $gpaData = $user->calculateGPA();
        $totalPassedHours = $user->passedCourses->sum('credit_hours');
        $cartHours = $user->cartCourses->sum('credit_hours');

        // حساب التقدم نحو التخرج
        $totalPlanHours = null;
        $progressPercent = null;
        if ($user->major && method_exists($user->major, 'getTotalHours')) {
            $totalPlanHours = $user->major->getTotalHours();
            if ($totalPlanHours > 0) {
                $progressPercent = round(($totalPassedHours / $totalPlanHours) * 100);
            }
        }

        $isProbation = (isset($gpaData['percentage']) && (float)$gpaData['percentage'] < 60);

        return Inertia::render('AI/Advisor', [
            'studentStats' => [
                'name' => $user->name ?? 'طالب',
                'major' => $majorName,
                'gpa' => $gpaData['gpa4'] ?? null,
                'gpa_percentage' => $gpaData['percentage'] ?? null,
                'hours_completed' => $totalPassedHours,
                'total_plan_hours' => $totalPlanHours,
                'progress_percent' => $progressPercent,
                'cart_hours' => $cartHours,
                'max_allowed_hours' => $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL,
                'is_probation' => $isProbation,
            ],
            'chats' => $chats,
            'initialCartIds' => $initialCartIds,
        ]);
    }

    // ==========================================
    // 💬 جلب رسائل محادثة
    // ==========================================

    public function getMessages($chat_id)
    {
        $chat = Chat::findOrFail($chat_id);
        if ($chat->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        return response()->json($chat->messages()->orderBy('created_at', 'asc')->get());
    }

    // ==========================================
    // 🚀 إرسال رسالة والحصول على رد AI
    // ==========================================

    public function chat(Request $request)
    {
        set_time_limit(120);

        $request->validate([
            'message' => 'required|string|max:2000',
            'chat_id' => 'nullable|exists:chats,id',
        ]);

        $user = Auth::user();
        $userMessage = $request->message;
        $chatId = $request->chat_id;
        $apiKey = env('GEMINI_API_KEY');

        if (!$apiKey) {
            return response()->json(['status' => 'error', 'message' => 'مفتاح API غير موجود.'], 500);
        }

        // ---- Rate Limiting ----
        if (!$this->checkRateLimit($user->id)) {
            return response()->json([
                'status' => 'success',
                'reply' => "⏳ **وصلت للحد الأقصى من الرسائل** (" . self::RATE_LIMIT_PER_HOUR . " رسالة/ساعة).\n\nحاول مرة أخرى بعد قليل. في هالوقت، تقدر تراجع المحاكي أو تتصفح المواد المتاحة. 📚",
                'suggested_courses' => [],
                'courses_to_remove' => [],
                'follow_up_suggestions' => [],
                'chat_id' => $chatId,
            ]);
        }

        // ---- إنشاء أو جلب المحادثة ----
        if (!$chatId) {
            $chat = $user->chats()->create([
                'title' => mb_substr($userMessage, 0, 35) . '...',
            ]);
            $chatId = $chat->id;
            $isNewChat = true;
        } else {
            $chat = Chat::findOrFail($chatId);
            if ($chat->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
            $isNewChat = false;
        }

        // حفظ رسالة الطالب
        $chat->messages()->create(['role' => 'user', 'content' => $userMessage]);

        // ---- جلب البيانات ----
        $academicData = $this->getStudentAcademicData($user);

        // بيانات المحاكي (دائماً fresh لأنها تتغير كثير)
        $user->load('cartCourses');
        $cartCourseIds = $user->cartCourses->pluck('id')->toArray();
        $cartCoursesMap = $user->cartCourses->pluck('name', 'id')->toArray();
        $cartHours = $user->cartCourses->sum('credit_hours');
        $cartData = [
            'ids' => $cartCourseIds,
            'map' => $cartCoursesMap,
            'list' => implode(' | ', $cartCoursesMap),
            'hours' => $cartHours,
        ];

        // المواد المتاحة
        $availableCourses = $this->getAvailableCourses($academicData['passed_course_ids'], $cartCourseIds);

        // بناء البرومبت
        $systemPrompt = $this->buildSystemPrompt($user, $academicData, $cartData, $availableCourses);

        // بناء سياق المحادثة
        $contents = $this->buildConversationContext($chat, $systemPrompt);

        try {
            $rawText = $this->callGeminiAPI($contents, $apiKey);
            $parsed = $this->parseAIResponse($rawText);

            $replyText = $parsed['reply'];
            $followUpSuggestions = $parsed['follow_up_suggestions'];
            $interactiveWidget = $parsed['interactive_widget'];

            // 🔧 ربط أسماء المواد في الـ Widget بالـ IDs الحقيقية من قاعدة البيانات
            $interactiveWidget = $this->enrichWidgetWithCourseIds($interactiveWidget, $availableCourses['map'], $cartData['map']);

            // مطابقة المواد بالرد
            $matched = $this->matchCoursesInReply($replyText, $availableCourses['map'], $cartData['map']);

            // تنظيف النص
            $finalReply = str_replace('\n', "\n", $replyText);
            $finalReply = preg_replace('/\n{3,}/', "\n\n", $finalReply);
            $finalReply = trim($finalReply);

            // جلب تفاصيل المواد
            $suggestedDetails = [];
            if (!empty($matched['suggested'])) {
                $suggestedDetails = Course::whereIn('id', $matched['suggested'])
                    ->select('id', 'name', 'code', 'credit_hours', 'description')
                    ->get()->toArray();
            }

            $removeDetails = [];
            if (!empty($matched['remove'])) {
                $removeDetails = Course::whereIn('id', $matched['remove'])
                    ->select('id', 'name', 'code', 'credit_hours', 'description')
                    ->get()->toArray();
            }

            // حفظ رد الـ AI
            $dbContent = json_encode([
                'reply' => $finalReply,
                'suggested_courses' => $suggestedDetails,
                'courses_to_remove' => $removeDetails,
                'follow_up_suggestions' => $followUpSuggestions,
                'interactive_widget' => $interactiveWidget,
            ], JSON_UNESCAPED_UNICODE);

            $chat->messages()->create(['role' => 'ai', 'content' => $dbContent]);

            // توليد عنوان ذكي لمحادثة جديدة (async-style بعد الرد)
            if ($isNewChat) {
                $smartTitle = $this->generateSmartTitle($userMessage, $finalReply, $apiKey);
                $chat->update(['title' => $smartTitle]);
            }

            return response()->json([
                'status' => 'success',
                'reply' => $finalReply,
                'suggested_courses' => $suggestedDetails,
                'courses_to_remove' => $removeDetails,
                'follow_up_suggestions' => $followUpSuggestions,
                'interactive_widget' => $interactiveWidget,
                'chat_id' => $chatId,
                'chat_title' => $isNewChat ? ($smartTitle ?? $chat->title) : null,
            ]);

        } catch (\Exception $e) {
            Log::error("Gemini AI Error: {$e->getMessage()} on line {$e->getLine()} in {$e->getFile()}");

            return response()->json([
                'status' => 'success',
                'reply' => "⚠️ **حدث خطأ فني أثناء الاتصال بالذكاء الاصطناعي.**\n\n`{$e->getMessage()}`\n\nيرجى المحاولة مرة أخرى. 🔄",
                'suggested_courses' => [],
                'courses_to_remove' => [],
                'follow_up_suggestions' => ['حاول مرة أخرى', 'اسأل سؤال آخر'],
                'interactive_widget' => null,
                'chat_id' => $chatId,
            ]);
        }
    }

    // ==========================================
    // 🔄 إعادة توليد آخر رد
    // ==========================================

    public function regenerate(Request $request)
    {
        $request->validate([
            'chat_id' => 'required|exists:chats,id',
        ]);

        $user = Auth::user();
        $chat = Chat::findOrFail($request->chat_id);

        if ($chat->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // احذف آخر رد AI
        $lastAiMessage = $chat->messages()->where('role', 'ai')->latest()->first();
        if ($lastAiMessage) {
            $lastAiMessage->delete();
        }

        // جلب آخر رسالة من الطالب
        $lastUserMessage = $chat->messages()->where('role', 'user')->latest()->first();
        if (!$lastUserMessage) {
            return response()->json(['status' => 'error', 'message' => 'لا يوجد رسالة لإعادة توليدها.'], 400);
        }

        // إعادة الإرسال
        $fakeRequest = new Request([
            'message' => $lastUserMessage->content,
            'chat_id' => $chat->id,
        ]);

        // احذف رسالة الطالب لأن chat() ستعيد إنشاءها
        $lastUserMessage->delete();

        return $this->chat($fakeRequest);
    }

    // ==========================================
    // 👍👎 تقييم رد AI (Feedback)
    // ==========================================

    public function feedback(Request $request)
    {
        $request->validate([
            'message_id' => 'required|exists:messages,id',
            'rating' => 'required|in:up,down',
            'comment' => 'nullable|string|max:500',
        ]);

        $user = Auth::user();
        $message = Message::findOrFail($request->message_id);

        // تأكد إنه الرسالة تبع محادثة الطالب
        $chat = $message->chat;
        if (!$chat || $chat->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // حفظ التقييم (يمكن إضافة جدول feedbacks أو حفظها في meta)
        DB::table('ai_feedbacks')->updateOrInsert(
            ['message_id' => $message->id, 'user_id' => $user->id],
            [
                'rating' => $request->rating,
                'comment' => $request->comment,
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        Log::info("AI Feedback: User {$user->id} rated message {$message->id} as {$request->rating}");

        return response()->json(['status' => 'saved']);
    }

    // ==========================================
    // 🗑️ حذف محادثة
    // ==========================================

    public function destroy($chatId)
    {
        $chat = Chat::findOrFail($chatId);

        if ($chat->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // حذف الرسائل أولاً ثم المحادثة
        $chat->messages()->delete();
        $chat->delete();

        return response()->json(['status' => 'deleted']);
    }

    // ==========================================
    // 🧹 حذف جميع المحادثات
    // ==========================================

    public function destroyAll()
    {
        $user = Auth::user();

        $chatIds = $user->chats()->pluck('id');
        Message::whereIn('chat_id', $chatIds)->delete();
        $user->chats()->delete();

        return response()->json(['status' => 'all_deleted']);
    }

    // ==========================================
    // 📊 تقارير الأدمن
    // ==========================================

    public function getAdminReports()
    {
        $topDemandedCourses = DB::table('user_carts')
            ->join('courses', 'user_carts.course_id', '=', 'courses.id')
            ->select('courses.name', 'courses.code', DB::raw('count(user_carts.user_id) as student_count'))
            ->groupBy('courses.id', 'courses.name', 'courses.code')
            ->orderBy('student_count', 'desc')
            ->limit(10)
            ->get();

        // إحصائيات استخدام AI
        $aiStats = [
            'total_chats' => Chat::count(),
            'total_messages' => Message::count(),
            'active_users_today' => Chat::whereDate('created_at', today())->distinct('user_id')->count('user_id'),
            'avg_messages_per_chat' => round(Message::count() / max(Chat::count(), 1), 1),
        ];

        // أكثر أسئلة متكررة (آخر 7 أيام)
        $topQuestions = Message::where('role', 'user')
            ->where('created_at', '>=', now()->subDays(7))
            ->select('content', DB::raw('count(*) as count'))
            ->groupBy('content')
            ->orderBy('count', 'desc')
            ->limit(10)
            ->get();

        // تقييمات AI
        $feedbackStats = DB::table('ai_feedbacks')
            ->select(
                DB::raw("count(case when rating = 'up' then 1 end) as positive"),
                DB::raw("count(case when rating = 'down' then 1 end) as negative"),
                DB::raw('count(*) as total')
            )
            ->first();

        $graduationAudit = DB::table('course_user')
            ->join('courses', 'course_user.course_id', '=', 'courses.id')
            ->select('user_id', DB::raw('sum(courses.credit_hours) as total_hours'))
            ->groupBy('user_id')
            ->get();

        return response()->json([
            'demanded_courses' => $topDemandedCourses,
            'graduation_status' => $graduationAudit,
            'ai_stats' => $aiStats,
            'top_questions' => $topQuestions,
            'feedback_stats' => $feedbackStats,
        ]);
    }
}