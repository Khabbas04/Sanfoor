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

class AiAdvisorController extends Controller
{
    // ==========================================
    // ⚙️ إعدادات ثابتة
    // ==========================================
    
    /** الحد الأقصى لعدد الرسائل المرسلة للـ AI (Context Window) */
    private const MAX_CONTEXT_MESSAGES = 12;
    
    /** الحد الأقصى للرسائل في الساعة لكل طالب */
    private const RATE_LIMIT_PER_HOUR = 40;
    
    /** مدة كاش بيانات الطالب الأكاديمية (بالدقائق) */
    private const STUDENT_DATA_CACHE_MINUTES = 30;

    /** الحد الأقصى للساعات للطالب العادي */
    private const MAX_HOURS_NORMAL = 18;

    /** الحد الأقصى للساعات لطالب الإنذار */
    private const MAX_HOURS_PROBATION = 12;

    /** تفعيل توليد عنوان ذكي عبر API (قد يزيد زمن الاستجابة) */
    private const ENABLE_SMART_TITLE = false;

    /** أقصى طول للنص النهائي المعروض للطالب (0 = بدون حد محلي) */
    private const MAX_REPLY_LENGTH = 0;

    /** عدد محاولات تكملة الرد إذا توقف بسبب حد التوكن */
    private const MAX_CONTINUATION_PASSES = 2;

    /** أقصى عدد أسئلة متابعة */
    private const MAX_FOLLOW_UP_SUGGESTIONS = 3;

    /** أقصى عناصر للويدجت التفاعلي */
    private const MAX_WIDGET_ITEMS = 8;

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
        $hasAcademicRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
        $isProbation = $hasAcademicRecords && isset($gpaData['percentage']) && (float)$gpaData['percentage'] < 60;
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
            'has_academic_records' => $hasAcademicRecords,
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
    private function getAvailableCourses($passedCourseIds, $cartCourseIds, $user)
    {
        $planVersion = (int) ($user->study_plan_version ?? 12);

        $unpassedCourses = Course::with(['prerequisites', 'children'])
            ->where(function ($query) use ($user, $planVersion) {
                if ($user->major_id) {
                    $query->where(function ($majorScope) use ($user, $planVersion) {
                        $majorScope->where('major_id', $user->major_id)
                            ->where('study_plan_version', $planVersion);
                    })->orWhere(function ($universityScope) use ($planVersion) {
                        $universityScope->whereNull('major_id')
                            ->where('study_plan_version', $planVersion);
                    });
                } else {
                    $query->whereNull('major_id')
                        ->where('study_plan_version', $planVersion);
                }
            })
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

            // حتى لو بالتسجيل التجريبي، نضيفها للـ map عشان الـ AI يعرفها
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
            $manualDifficulty = (int) ($course->difficulty_level ?? 3);
            if ($manualDifficulty < 1 || $manualDifficulty > 5) {
                $manualDifficulty = 3;
            }

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
            if ($inCart) $tags[] = "🛒 موجودة بالتسجيل التجريبي حالياً";

            $tagString = !empty($tags) ? ' [' . implode(' | ', $tags) . ']' : '';

            // ─── بناء نص المادة المُعزَّز للـ AI ───
            $courseTextLine = "- {$course->name} (رمز: {$course->code}, ساعات: {$course->credit_hours}, سنة_المادة: {$courseYear}, نوع: {$courseType}, عدد_المتطلبات: {$prereqCount}, تصنيف_الصعوبة_الاداري: {$manualDifficulty}){$tagString}";

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
                'difficulty_level' => $manualDifficulty,
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
     * بناء RAG مختصر موجه للإرشاد الأكاديمي حسب سؤال الطالب.
     */
    private function buildStudentAdvisingRagContext(array $academicData, array $cartData, array $availableCourses, string $userMessage): string
    {
        $normalizedQuestion = $this->normalizeArabic($userMessage);

        $intent = 'عام';
        if (preg_match('/(معدل|gpa|انذار|إنذار|رفع)/u', $normalizedQuestion)) {
            $intent = 'رفع_المعدل';
        } elseif (preg_match('/(تخرج|خطة|مسار|فتح|متطلبات)/u', $normalizedQuestion)) {
            $intent = 'تسريع_التخرج';
        } elseif (preg_match('/(تخفيف|ضغط|عبء|سهل|خفيف)/u', $normalizedQuestion)) {
            $intent = 'تخفيف_العبء';
        }

        $availableDetails = array_values($availableCourses['details'] ?? []);
        usort($availableDetails, function ($a, $b) {
            return ($b['unlocks'] <=> $a['unlocks']) ?: ($a['prereq_count'] <=> $b['prereq_count']);
        });

        $topStrategic = array_slice($availableDetails, 0, 5);
        $strategicLines = [];
        foreach ($topStrategic as $course) {
            $strategicLines[] = "- {$course['name']} | سنة {$course['course_year']} | {$course['credit_hours']}س | يفتح {$course['unlocks']} | متطلبات {$course['prereq_count']}";
        }

        $difficultyBuckets = [
            'easy' => [],
            'balanced' => [],
            'heavy' => [],
        ];

        foreach ($availableDetails as $course) {
            $difficultyLevel = (int) ($course['difficulty_level'] ?? 3);
            if ($difficultyLevel <= 2) {
                $difficultyBuckets['easy'][] = $course['name'];
            } elseif ($difficultyLevel >= 4) {
                $difficultyBuckets['heavy'][] = $course['name'];
            } else {
                $difficultyBuckets['balanced'][] = $course['name'];
            }
        }

        $easySample = array_slice($difficultyBuckets['easy'], 0, 4);
        $balancedSample = array_slice($difficultyBuckets['balanced'], 0, 4);
        $heavySample = array_slice($difficultyBuckets['heavy'], 0, 4);

        $cartCourseCount = is_array($cartData['ids'] ?? null) ? count($cartData['ids']) : 0;
        $hoursState = ($cartData['hours'] ?? 0) > ($academicData['max_allowed_hours'] ?? self::MAX_HOURS_NORMAL)
            ? 'متجاوز_الحد'
            : 'ضمن_الحد';

        return "
        🎯 [RAG الإرشاد الطلابي]:
        - نية_السؤال: {$intent}
        - ساعات_الطالب_المنجزة: " . ($academicData['total_passed_hours'] ?? 0) . "
        - ساعات_التسجيل_التجريبي_الحالية: " . ($cartData['hours'] ?? 0) . "
        - حالة_الساعات: {$hoursState}
        - عدد_مواد_التسجيل_التجريبي: {$cartCourseCount}
                - مواد_استراتيجية_مرشحة:
                " . (!empty($strategicLines) ? implode("\n", $strategicLines) : '- لا توجد مواد مرشحة حالياً') . "
                - عينات_حسب_تصنيف_الصعوبة_الاداري:
                    - خفيف: " . (!empty($easySample) ? implode(' | ', $easySample) : 'لا يوجد') . "
                    - متوازن: " . (!empty($balancedSample) ? implode(' | ', $balancedSample) : 'لا يوجد') . "
                    - مكثف: " . (!empty($heavySample) ? implode(' | ', $heavySample) : 'لا يوجد');
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
    private function buildSystemPrompt($user, $academicData, $cartData, $availableCourses, string $ragContext = '')
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

        // تحليل العبء الحالي بالتسجيل التجريبي
        $cartWarning = '';
        if ($cartData['hours'] > $academicData['max_allowed_hours']) {
            $excess = $cartData['hours'] - $academicData['max_allowed_hours'];
            $cartWarning = "\n        ⚠️ تنبيه: التسجيل التجريبي يحتوي {$cartData['hours']} ساعة وهذا يتجاوز الحد المسموح بـ {$excess} ساعة!";
        }

        return "أنت 'سنفور'، مستشار أكاديمي ذكي وودود من جامعة الزرقاء، ومبعوث رسمي من فريق سنفور لخدمة الطلاب في الإرشاد الأكاديمي.
        أنت تعمل داخل نظام الجامعة هذا، وتلتزم بالكامل بكل البيانات الموجودة أعلاه وبكل الأوامر والقواعد المذكورة في هذا الـ System Prompt دون تجاوز أو تجاهل.
        مهمتك توجيه طلاب جامعة الزرقاء بذكاء واحترافية وبأسلوب داعم وواضح.

        📊 [ملف الطالب]:
        - الاسم: {$user->name}
        - التخصص: {$academicData['major_name']}
        - السنة الدراسية الحالية: سنة {$studentYearLabel} (محسوبة من {$totalPassedHours} ساعة منجزة ÷ 33)
        - {$gpaText}
        - حالة الإنذار: {$probationStatus}
        - الساعات المنجزة: {$academicData['total_passed_hours']} ساعة{$progressText}
        - المواد المنجزة: [{$academicData['passed_courses_names']}]
        - التسجيل التجريبي الحالي: [" . ($cartData['list'] ?: 'فارغ') . "] ({$cartData['hours']} ساعة){$cartWarning}

        📚 [المواد المتاحة للتسجيل]:
        {$availableCourses['text']}

        {$ragContext}

        ═══════════════════════════════════════════════════════
        🧮 [خوارزمية الصعوبة النسبية — Relative Difficulty Scoring]:
        ═══════════════════════════════════════════════════════
        إذا كان ضمن بيانات المادة \"تصنيف_الصعوبة_الاداري\" (1-5) فاعتبره مرجعاً أساسياً للصعوبة،
        واستخدم المعادلة أدناه فقط للتأكيد أو عند غياب التصنيف.
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
        4. إذا تجاوز التسجيل التجريبي الحد المسموح، نبّه الطالب فوراً واقترح مواد لحذفها.
        5. ركّز على المواد الاستراتيجية (🔥) لأنها تفتح مساراً أوسع.
        6. نسّق إجابتك بشكل جميل بالرموز التعبيرية (🚀🎯💡📊⚡) والخط العريض.
        7. **قاعدة حاسمة:** اكتب أسماء المواد بالضبط كما في القائمة عشان نظامنا يربطها بأزرار الإضافة.
        8. في نهاية كل رد، أضف 2-3 أسئلة متابعة مقترحة للطالب.
        9. ⛔ لا تستخدم أي HTML نهائياً (مثل <div> أو <span> أو <br>). استخدم نص نظيف أو Markdown بسيط فقط.
        10. ⛔ لا ترجع markdown code fences مثل ```json.

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

        د) **مراجعة التسجيل التجريبي** (عندما يطلب الطالب مراجعة جدوله):
        \"interactive_widget\": {
            \"type\": \"cart_review\",
            \"title\": \"مراجعة التسجيل التجريبي الحالي\",
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
        - إذا سأل \"راجع التسجيل التجريبي\" أو \"شو رأيك بجدولي\" أو \"العبء كبير\" ← استخدم cart_review
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

        // دمج كل المواد المعروفة (المتاحة + اللي بالتسجيل التجريبي)
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
     * جلب مفاتيح Gemini مع دعم أكثر من مفتاح للفشل التلقائي.
     *
     * الأولوية:
     * 1) GEMINI_API_KEYS بصيغة مفصولة بفواصل.
     * 2) GEMINI_API_KEY كمفتاح احتياطي.
     */
    private function getGeminiApiKeys(): array
    {
        $keys = [];

        $keysCsv = (string) config('services.gemini.keys', '');
        if (trim($keysCsv) !== '') {
            foreach (explode(',', $keysCsv) as $key) {
                $value = trim((string) $key);
                if ($value !== '') {
                    $keys[] = $value;
                }
            }
        }

        $single = trim((string) config('services.gemini.key', ''));
        if ($single !== '') {
            $keys[] = $single;
        }

        return array_values(array_unique($keys));
    }

    /**
     * استدعاء Gemini API
     */
    private function callGeminiAPI($contents, array $apiKeys)
    {
        $baseUrl = "https://" . "generativelanguage.googleapis.com";
        $models = array_values(array_unique(array_filter([
            config('services.gemini.model'),
            'gemini-2.0-flash-lite',
            'gemini-2.5-flash',
        ])));

        if (empty($apiKeys)) {
            throw new \Exception('No Gemini API keys configured');
        }

        $lastError = 'Unknown Gemini error';

        foreach ($apiKeys as $keyIndex => $apiKey) {
            foreach ($models as $model) {
                $endpoint = "/v1beta/models/{$model}:generateContent?key=";
                $url = $baseUrl . $endpoint . $apiKey;

                try {
                    $requestContents = $contents;
                    $fullText = '';

                    for ($pass = 0; $pass <= self::MAX_CONTINUATION_PASSES; $pass++) {
                        $response = Http::withoutVerifying()
                            ->connectTimeout(8)
                            ->timeout(0)
                            ->retry(2, 300)
                            ->withHeaders(['Content-Type' => 'application/json'])
                            ->post($url, [
                                'contents' => $requestContents,
                                'generationConfig' => [
                                    'responseMimeType' => 'application/json',
                                    'temperature' => 0.35,
                                ],
                            ]);

                        if (!$response->successful()) {
                            $lastError = "key#" . ($keyIndex + 1) . " {$model}: HTTP {$response->status()}";
                            continue 2;
                        }

                        $data = $response->json();
                        $candidate = $data['candidates'][0] ?? null;
                        $chunk = $candidate['content']['parts'][0]['text'] ?? null;

                        if (!is_string($chunk) || trim($chunk) === '') {
                            $lastError = "key#" . ($keyIndex + 1) . " {$model}: empty candidate text";
                            continue 2;
                        }

                        $fullText .= $chunk;

                        $finishReason = strtoupper((string) ($candidate['finishReason'] ?? ''));
                        $stoppedByTokenLimit = in_array($finishReason, ['MAX_TOKENS', 'LENGTH', 'FINISH_REASON_MAX_TOKENS'], true);

                        if (!$stoppedByTokenLimit) {
                            return $fullText;
                        }

                        if ($pass >= self::MAX_CONTINUATION_PASSES) {
                            return $fullText;
                        }

                        // اطلب تكملة الرد بدون إعادة البداية عند انقطاعه بسبب التوكن.
                        $requestContents[] = [
                            'role' => 'model',
                            'parts' => [['text' => $chunk]],
                        ];
                        $requestContents[] = [
                            'role' => 'user',
                            'parts' => [[
                                'text' => 'اكمل الرد من آخر نقطة وصلت لها فقط، بدون إعادة أي جزء سابق، وحافظ على نفس التنسيق المطلوب.'
                            ]],
                        ];
                    }

                    if ($fullText !== '') {
                        return $fullText;
                    }
                } catch (\Throwable $exception) {
                    $lastError = "key#" . ($keyIndex + 1) . " {$model}: {$exception->getMessage()}";
                    continue;
                }
            }
        }

        throw new \Exception("Gemini failed across models. {$lastError}");
    }

    /**
     * محاولة استخراج أول JSON object صالح من النص الخام.
     */
    private function extractJsonObject(string $text): ?string
    {
        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        return substr($text, $start, ($end - $start + 1));
    }

    /**
     * تنظيف واستخراج JSON من رد الـ AI
     */
    private function parseAIResponse($rawText)
    {
        // تنظيف markdown code fences
        $clean = preg_replace('/```(?:json)?(.*?)```/is', '$1', $rawText);
        $clean = trim($clean);

        $parsed = null;

        $decodedFull = json_decode($clean, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decodedFull)) {
            $parsed = $decodedFull;
        } else {
            $jsonFragment = $this->extractJsonObject($clean);
            if ($jsonFragment !== null) {
                $decodedFragment = json_decode($jsonFragment, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decodedFragment)) {
                    $parsed = $decodedFragment;
                }
            }
        }

        if (is_array($parsed) && isset($parsed['reply'])) {
            $reply = $parsed['reply'];
            if (is_array($reply) || is_object($reply)) {
                $reply = json_encode($reply, JSON_UNESCAPED_UNICODE);
            }

            return [
                'reply' => (string) ($reply ?? ''),
                'follow_up_suggestions' => $parsed['follow_up_suggestions'] ?? [],
                'interactive_widget' => $parsed['interactive_widget'] ?? null,
            ];
        }

        // أحياناً يجي الرد كسلسلة نصية تحتوي JSON كامل escaped.
        if ((str_starts_with($clean, '"') && str_ends_with($clean, '"')) || (str_starts_with($clean, "'") && str_ends_with($clean, "'"))) {
            $unwrapped = trim($clean, "\"'");
            $unescaped = stripcslashes($unwrapped);
            $decodedWrapped = json_decode($unescaped, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedWrapped) && isset($decodedWrapped['reply'])) {
                return [
                    'reply' => (string) ($decodedWrapped['reply'] ?? ''),
                    'follow_up_suggestions' => $decodedWrapped['follow_up_suggestions'] ?? [],
                    'interactive_widget' => $decodedWrapped['interactive_widget'] ?? null,
                ];
            }
        }

        // fallback: استخراج reply بالـ regex
        if (preg_match('/"reply"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $clean, $matches)) {
            $reply = str_replace(['\\n', '\n'], "\n", $matches[1]);
            $reply = str_replace(['\\"'], '"', $reply);
            return ['reply' => $reply, 'follow_up_suggestions' => [], 'interactive_widget' => null];
        }

        // fallback عام: أي صيغة فيها مفتاح reply حتى لو JSON مش مكسور.
        if (preg_match('/["\']?reply["\']?\s*:\s*(.+)$/isu', $clean, $matches)) {
            $reply = $this->stripReplyEnvelope((string) $matches[1]);
            if ($reply !== '') {
                return ['reply' => $reply, 'follow_up_suggestions' => [], 'interactive_widget' => null];
            }
        }

        // آخر حل: رجّع النص الخام بعد تنظيف بسيط بدل تشويهه بحذف شامل للرموز.
        $fallback = $this->stripReplyEnvelope($clean);

        if ($fallback === '') {
            $fallback = 'ما وصلني رد واضح هذه المرة. حاول إعادة السؤال بصيغة أقصر.';
        }

        return ['reply' => $fallback, 'follow_up_suggestions' => [], 'interactive_widget' => null];
    }

    /**
     * إزالة تغليف JSON الجزئي من نص الرد (مثل "reply": "...", مع حقول لاحقة).
     */
    private function stripReplyEnvelope(string $text): string
    {
        $value = trim($text);

        // إذا النص نفسه JSON object صالح وفيه reply، خذ القيمة مباشرة.
        $decoded = json_decode($value, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && isset($decoded['reply'])) {
            $reply = $decoded['reply'];
            if (is_array($reply) || is_object($reply)) {
                $reply = json_encode($reply, JSON_UNESCAPED_UNICODE);
            }
            return trim((string) ($reply ?? ''));
        }

        // شيل أي حقول JSON لاحقة مثل suggested_courses حتى ما تظهر للطالب.
        $value = preg_replace('/,\s*["\']?(suggested_courses|courses_to_remove|follow_up_suggestions|interactive_widget)["\']?\s*:.*/isu', '', $value);

        // شيل بداية reply: إذا موجودة.
        if (preg_match('/^\s*["\']?reply["\']?\s*:\s*(.+)$/isu', $value, $matches)) {
            $value = (string) $matches[1];
        }

        // إزالة أقواس JSON الخارجية فقط إن كانت تحيط النص بالكامل.
        $value = preg_replace('/^\s*\{+\s*/u', '', $value);
        $value = preg_replace('/\s*\}+\s*$/u', '', $value);

        return trim($value, " \t\n\r\0\x0B\"'");
    }

    /**
     * تنظيف الرد النهائي وعزل أي HTML أو نصوص تقنية غير مرغوبة.
     */
    private function normalizeReplyText(string $text): string
    {
        $clean = str_replace(['\\n', '\n'], "\n", $text);

        // إزالة أي كتل أكواد/markdown fences إن ظهرت.
        $clean = preg_replace('/```(?:json|html|markdown)?(.*?)```/is', '$1', $clean);

        // إزالة وسوم HTML بالكامل لمنع ظهورها للطالب.
        $clean = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $clean);
        $clean = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $clean);
        $clean = strip_tags($clean);

        $clean = html_entity_decode($clean, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $clean = $this->stripReplyEnvelope($clean);
        $clean = preg_replace('/\n{3,}/', "\n\n", $clean);
        $clean = preg_replace('/[ \t]{2,}/', ' ', $clean);

        $clean = trim((string) $clean);
        if ($clean === '') {
            return 'ما وصلني رد واضح هذه المرة. اكتب سؤالك بصيغة أقصر وأنا أجاوبك فوراً.';
        }

        // لا نقص الرد تلقائياً حتى لا يظهر للطالب نص مقطوع.
        if (self::MAX_REPLY_LENGTH > 0 && mb_strlen($clean, 'UTF-8') > self::MAX_REPLY_LENGTH) {
            // حفاظاً على الذاكرة فقط: لا نقص إلا عند تجاوز كبير جداً.
            $clean = mb_substr($clean, 0, self::MAX_REPLY_LENGTH, 'UTF-8');
        }

        return $clean;
    }

    /**
     * تنقية أسئلة المتابعة القادمة من النموذج.
     */
    private function sanitizeFollowUpSuggestions($suggestions): array
    {
        if (!is_array($suggestions)) {
            return [];
        }

        $clean = [];
        foreach ($suggestions as $item) {
            if (!is_string($item)) {
                continue;
            }

            $value = trim(strip_tags($item));
            if ($value === '') {
                continue;
            }

            $clean[] = mb_substr($value, 0, 120, 'UTF-8');
        }

        return array_slice(array_values(array_unique($clean)), 0, self::MAX_FOLLOW_UP_SUGGESTIONS);
    }

    /**
     * تنقية الودجت التفاعلي حتى لا يكسر الواجهة.
     */
    private function sanitizeInteractiveWidget($widget): ?array
    {
        if (!is_array($widget) || !isset($widget['type']) || !is_string($widget['type'])) {
            return null;
        }

        $type = trim($widget['type']);
        switch ($type) {
            case 'comparison':
                $items = is_array($widget['items'] ?? null) ? $widget['items'] : [];
                $safeItems = [];
                foreach (array_slice($items, 0, self::MAX_WIDGET_ITEMS) as $item) {
                    if (!is_array($item)) {
                        continue;
                    }
                    $safeItems[] = [
                        'id' => $item['id'] ?? null,
                        'name' => mb_substr(trim((string) ($item['name'] ?? '')), 0, 120, 'UTF-8'),
                        'code' => mb_substr(trim((string) ($item['code'] ?? '')), 0, 40, 'UTF-8'),
                        'credit_hours' => (int) ($item['credit_hours'] ?? 0),
                        'difficulty' => (int) ($item['difficulty'] ?? 0),
                        'unlocks' => (int) ($item['unlocks'] ?? 0),
                        'gpa_impact' => mb_substr(trim((string) ($item['gpa_impact'] ?? '')), 0, 40, 'UTF-8'),
                        'recommendation' => mb_substr(trim((string) ($item['recommendation'] ?? '')), 0, 120, 'UTF-8'),
                    ];
                }

                return [
                    'type' => 'comparison',
                    'title' => mb_substr(trim((string) ($widget['title'] ?? 'مقارنة المواد المقترحة')), 0, 120, 'UTF-8'),
                    'items' => $safeItems,
                ];

            case 'poll':
                $options = is_array($widget['options'] ?? null) ? $widget['options'] : [];
                $safeOptions = [];
                foreach (array_slice($options, 0, 4) as $option) {
                    if (!is_array($option)) {
                        continue;
                    }
                    $safeOptions[] = [
                        'label' => mb_substr(trim((string) ($option['label'] ?? '')), 0, 80, 'UTF-8'),
                        'value' => mb_substr(trim((string) ($option['value'] ?? '')), 0, 40, 'UTF-8'),
                    ];
                }

                return [
                    'type' => 'poll',
                    'question' => mb_substr(trim((string) ($widget['question'] ?? 'شو أولويتك هالفصل؟')), 0, 120, 'UTF-8'),
                    'options' => $safeOptions,
                ];

            case 'hours_slider':
                $min = max(1, (int) ($widget['min'] ?? 9));
                $max = max($min, (int) ($widget['max'] ?? 18));
                $default = (int) ($widget['default'] ?? min(15, $max));

                return [
                    'type' => 'hours_slider',
                    'question' => mb_substr(trim((string) ($widget['question'] ?? 'كم ساعة حابب تسجل هالفصل؟')), 0, 120, 'UTF-8'),
                    'min' => $min,
                    'max' => $max,
                    'default' => min(max($default, $min), $max),
                    'current_cart_hours' => max(0, (int) ($widget['current_cart_hours'] ?? 0)),
                ];

            case 'cart_review':
                $courses = is_array($widget['courses'] ?? null) ? $widget['courses'] : [];
                $safeCourses = [];
                foreach (array_slice($courses, 0, self::MAX_WIDGET_ITEMS) as $course) {
                    if (!is_array($course)) {
                        continue;
                    }
                    $safeCourses[] = [
                        'id' => $course['id'] ?? null,
                        'name' => mb_substr(trim((string) ($course['name'] ?? '')), 0, 120, 'UTF-8'),
                        'code' => mb_substr(trim((string) ($course['code'] ?? '')), 0, 40, 'UTF-8'),
                        'credit_hours' => (int) ($course['credit_hours'] ?? 0),
                        'difficulty' => (int) ($course['difficulty'] ?? 0),
                        'verdict' => mb_substr(trim((string) ($course['verdict'] ?? 'keep')), 0, 20, 'UTF-8'),
                        'reason' => mb_substr(trim((string) ($course['reason'] ?? '')), 0, 200, 'UTF-8'),
                    ];
                }

                $summary = is_array($widget['summary'] ?? null) ? $widget['summary'] : [];
                return [
                    'type' => 'cart_review',
                    'title' => mb_substr(trim((string) ($widget['title'] ?? 'مراجعة التسجيل التجريبي الحالي')), 0, 120, 'UTF-8'),
                    'courses' => $safeCourses,
                    'summary' => [
                        'total_hours' => max(0, (int) ($summary['total_hours'] ?? 0)),
                        'max_hours' => max(0, (int) ($summary['max_hours'] ?? self::MAX_HOURS_NORMAL)),
                        'overall_difficulty' => mb_substr(trim((string) ($summary['overall_difficulty'] ?? 'متوسط')), 0, 40, 'UTF-8'),
                        'recommendation' => mb_substr(trim((string) ($summary['recommendation'] ?? '')), 0, 200, 'UTF-8'),
                    ],
                ];

            default:
                return null;
        }
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

        $hasAcademicRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
        $isProbation = $hasAcademicRecords && isset($gpaData['percentage']) && (float)$gpaData['percentage'] < 60;

        return Inertia::render('Ai/Advisor', [
            'studentStats' => [
                'name' => $user->name ?? 'طالب',
                'major' => $majorName,
                'gpa' => isset($gpaData['percentage']) ? number_format((float) $gpaData['percentage'], 2) : null,
                'gpa_percentage' => $gpaData['percentage'] ?? null,
                'hours_completed' => $totalPassedHours,
                'total_plan_hours' => $totalPlanHours,
                'progress_percent' => $progressPercent,
                'cart_hours' => $cartHours,
                'max_allowed_hours' => $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL,
                'is_probation' => $isProbation,
                'has_academic_records' => $hasAcademicRecords,
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
        set_time_limit(0);

        $request->validate([
            'message' => 'required|string|max:2000',
            'chat_id' => 'nullable|exists:chats,id',
        ]);

        $user = Auth::user();
        $userMessage = $request->message;
        $chatId = $request->chat_id;
        $apiKeys = $this->getGeminiApiKeys();

        if (empty($apiKeys)) {
            return response()->json(['status' => 'error', 'message' => 'مفتاح API غير موجود.'], 500);
        }

        // ---- Rate Limiting ----
        if (!$this->checkRateLimit($user->id)) {
            return response()->json([
                'status' => 'success',
                'reply' => "⏳ **وصلت للحد الأقصى من الرسائل** (" . self::RATE_LIMIT_PER_HOUR . " رسالة/ساعة).\n\nحاول مرة أخرى بعد قليل. في هالوقت، تقدر تراجع التسجيل التجريبي أو تتصفح المواد المتاحة. 📚",
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

        // بيانات التسجيل التجريبي (دائماً fresh لأنها تتغير كثير)
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
        $availableCourses = $this->getAvailableCourses($academicData['passed_course_ids'], $cartCourseIds, $user);

        // بناء البرومبت
        $ragContext = $this->buildStudentAdvisingRagContext($academicData, $cartData, $availableCourses, $userMessage);
        $systemPrompt = $this->buildSystemPrompt($user, $academicData, $cartData, $availableCourses, $ragContext);

        // بناء سياق المحادثة
        $contents = $this->buildConversationContext($chat, $systemPrompt);

        try {
            $rawText = $this->callGeminiAPI($contents, $apiKeys);
            $parsed = $this->parseAIResponse($rawText);

            $replyText = (string) ($parsed['reply'] ?? '');
            $followUpSuggestions = $this->sanitizeFollowUpSuggestions($parsed['follow_up_suggestions'] ?? []);
            $interactiveWidget = $this->sanitizeInteractiveWidget($parsed['interactive_widget'] ?? null);

            // 🔧 ربط أسماء المواد في الـ Widget بالـ IDs الحقيقية من قاعدة البيانات
            $interactiveWidget = $this->enrichWidgetWithCourseIds($interactiveWidget, $availableCourses['map'], $cartData['map']);

            // مطابقة المواد بالرد
            $matched = $this->matchCoursesInReply($replyText, $availableCourses['map'], $cartData['map']);

            // تنظيف النص
            $finalReply = $this->normalizeReplyText($replyText);

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
                if (self::ENABLE_SMART_TITLE) {
                    $smartTitle = $this->generateSmartTitle($userMessage, $finalReply, $apiKeys[0]);
                    $chat->update(['title' => $smartTitle]);
                } else {
                    $smartTitle = mb_substr($userMessage, 0, 35) . (mb_strlen($userMessage) > 35 ? '...' : '');
                    $chat->update(['title' => $smartTitle]);
                }
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

            $errorMessage = $e->getMessage();
            if (str_contains($errorMessage, '429') || str_contains($errorMessage, 'quota') || str_contains($errorMessage, 'RESOURCE_EXHAUSTED')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'خدمة الذكاء الاصطناعي وصلت للحد المسموح من Gemini حالياً. لازم تراجع quota/billing للمفتاح أو تنتظر إعادة التفعيل.',
                    'chat_id' => $chatId,
                ], 429);
            }

            return response()->json([
                'status' => 'success',
                'reply' => "⚠️ صار تأخير أو مشكلة مؤقتة بالرد.\n\nحاول مرة ثانية بسؤال أقصر، وأنا جاهز.",
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