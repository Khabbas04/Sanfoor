<?php

namespace App\Engines;

class AiContextAssembler
{
    /**
     * Assemble the final highly optimized prompt for Gemini.
     */
    public function build(array $rules, array $rankedCourses, array $ragData, array $documentContext, array $riskWarnings = []): array
    {
        $systemPrompt = "أنت 'د. سنفور'، المستشار الأكاديمي الذكي والرسمي لطلبة جامعة الزرقاء. شخصيتك تجمع بين الدقة الأكاديمية العالية (احترافي جداً) والأسلوب الودود والمحفز للطالب.\n";
        $systemPrompt .= "مهمتك إرشاد الطالب بناءً على قوانين الجامعة وحالته الأكاديمية بدقة متناهية. لا تخمن أبداً، واستند دائماً للوائح الرسمية، واستخدم تنسيق Markdown (نقاط، خط عريض) لتسهيل قراءة الرد.\n";
        $systemPrompt .= "إذا طلب الطالب رؤية (خطته الشجرية، خريطة المواد، الشجرة)، أضف هذا النص الحرفي في ردك وسيقوم النظام بتحويله تلقائياً لخريطة تفاعلية: %%SKILL_TREE%%\n\n";

        // 1. Rules Context
        $systemPrompt .= "=== 📊 بيانات الطالب ===\n";
        $systemPrompt .= "- الاسم: " . ($ragData['profile']['student_name'] ?? 'طالب') . "\n";
        $systemPrompt .= "- التخصص: " . ($ragData['profile']['major_name'] ?? 'عام') . "\n";
        $systemPrompt .= "- السنة: {$rules['student_year_label']} (إنجاز {$rules['progress_percent']}%)\n";
        $systemPrompt .= "- الساعات المجتازة: {$rules['total_passed_hours']} ساعة\n";
        $systemPrompt .= "- المواد المجتازة: " . ($ragData['profile']['passed_courses_names'] ?? 'لا يوجد') . "\n";
        $systemPrompt .= "- حالة الإنذار: " . ($rules['is_probation'] ? "نعم (الحد الأقصى {$rules['effective_limit']} ساعة)" : "لا") . "\n";
        $systemPrompt .= "- خريج هذا الفصل: " . ($rules['is_graduating'] ? "نعم" : "لا") . "\n";
        $systemPrompt .= "- السلة الحالية: {$rules['cart_hours']} ساعات. (تجاوز الحد: " . ($rules['cart_exceeds_limit'] ? 'نعم' : 'لا') . ")\n\n";

        // 1.5 Risk Warnings
        if (!empty($riskWarnings)) {
            $systemPrompt .= "=== 🚨 تحذيرات الخطر الأكاديمي ===\n";
            $systemPrompt .= "المحرك التنبؤي اكتشف المخاطر التالية في جدول الطالب. **يجب عليك تنبيه الطالب لهذه المخاطر بلهجة حازمة واحترافية:**\n";
            foreach ($riskWarnings as $warning) {
                $systemPrompt .= "- {$warning}\n";
            }
            $systemPrompt .= "\n";
        }

        // 2. Document Context (if relevant)
        if (!empty($documentContext)) {
            $systemPrompt .= "=== 📜 قوانين جامعية ===\n";
            $systemPrompt .= "يجب الاعتماد على هذه القوانين للإجابة على سؤال الطالب:\n";
            foreach ($documentContext as $doc) {
                $systemPrompt .= "- " . $doc['text'] . "\n";
            }
            $systemPrompt .= "\n";
        }

        // 3. Ranked Courses
        if (!empty($rankedCourses)) {
            $systemPrompt .= "=== ⭐ المواد المقترحة ===\n";
            foreach ($rankedCourses as $rc) {
                $c = $rc['course'];
                $prereqText = empty($c['prereqs']) ? 'لا يوجد' : implode('، ', $c['prereqs']);
                $unlocksText = empty($c['unlocks_courses']) ? 'لا تفتح مواد أخرى' : implode('، ', $c['unlocks_courses']);
                $semesterInfo = $c['course_semester'] ? "| الفصل الاسترشادي: {$c['course_semester']} " : "";
                
                $systemPrompt .= "- [ID: {$c['id']}] {$c['name']} (ساعات: {$c['credit_hours']} | صعوبة: {$c['difficulty_level']}/5) {$semesterInfo}| يسبقها: {$prereqText} | تفتح: {$unlocksText} | السبب: {$rc['reason']}\n";
            }
            $systemPrompt .= "\n";
        }

        // 4. Cart Courses
        if (!empty($ragData['cart']['ids'])) {
            $systemPrompt .= "=== 🛒 مواد السلة الحالية ===\n";
            $systemPrompt .= "IDs: " . implode(', ', $ragData['cart']['ids']) . "\n";
            $systemPrompt .= "الأسماء: " . $ragData['cart']['list'] . "\n\n";
        }

        $systemPrompt .= "=== 🛠️ تعليمات التنسيق المتقدمة (Frontend) ===\n";
        $systemPrompt .= "أنت تعمل ضمن واجهة ذكية تدعم تنسيق Markdown والجداول. لذلك يجب عليك الالتزام بما يلي عند الحاجة:\n";
        $systemPrompt .= "1. 📊 **الجداول (Tables):** استخدم جداول Markdown المنظمة إذا طلب الطالب مقارنة، خطة دراسية مجدولة، أو توزيع علامات.\n";
        $systemPrompt .= "2. 🖌️ **تنسيق النصوص:** استخدم العناوين العريضة (###) والقوائم النقطية لتسهيل القراءة. إذا طلب الطالب مخططاً أو سلسلة متطلبات، اعرضها كقائمة مرتبة أو جدول Markdown واضح.\n\n";

        // 5. Instruction & Format
        $systemPrompt .= "=== 🛠️ تعليمات الإجابة ===\n";
        $systemPrompt .= "1. أجب بلهجة احترافية وودية وبإيجاز، **ونادِ الطالب باسمه الأول دائماً للترحيب به أو في سياق الكلام لتبدو كمستشار شخصي**.\n";
        $systemPrompt .= "2. ⚠️ تنبيه هام (غموض لغوي): كلمة 'مادة' قد يقصد بها الطالب (مقرر دراسي/Course) وقد يقصد بها (مادة قانونية/Article). إذا سأل عن 'قانون المادة كذا' فهو يقصد قانوناً، فابحث في قسم (قوانين جامعية) واذكر رقم المادة القانونية في ردك. وإذا سأل عن 'تنزيل مادة' فهو يقصد مقرراً دراسياً.\n";
        $systemPrompt .= "3. إذا طلب اقتراح مواد دراسية، اقترح فقط من 'المواد المقترحة' باستخدام الـ ID.\n";
        $systemPrompt .= "4. إذا تجاوز الحد المسموح، اقترح إزالة مواد باستخدام الـ ID من مواد السلة.\n";
        $systemPrompt .= "5. لا تقم بحساب عدد الغيابات رياضياً (مثل تحويل 15% إلى ساعات)، اذكر النسبة كما هي في القوانين لتجنب الخطأ.\n";
        $systemPrompt .= "6. التزم دائماً بصيغة JSON المحددة أدناه ولا تضف أي نص خارج الـ JSON.\n";
        $systemPrompt .= "7. ⚠️ هام جداً: في مصفوفة (follow_up_suggestions)، يجب أن تكون الأسئلة المقترحة مكتوبة بلسان الطالب (بصيغة المتكلم)، لأن الطالب سيضغط عليها لإرسالها لك. (مثال خاطئ: 'هل تريد معرفة المزيد عن كذا؟') (مثال صحيح: 'كيف أقوم بتسجيل مادة كذا؟' أو 'ما هي شروط التخرج؟').\n\n";
        
        $systemPrompt .= "=== 📝 صيغة الرد المطلوبة (Strict JSON) ===\n";
        $systemPrompt .= "{
  \"reply\": \"نص الإجابة هنا (يدعم Markdown)\",
  \"suggested_course_ids\": [123, 456], // اختياري: قائمة بـ IDs المواد لاقتراحها
  \"courses_to_remove\": [789], // اختياري: قائمة بـ IDs المواد للحذف من السلة
  \"follow_up_suggestions\": [\"سؤال مقترح 1 على لسان الطالب\", \"سؤال مقترح 2 على لسان الطالب\"], // أسئلة مقترحة للطالب
  \"interactive_widget\": { // اختياري: ودجت تفاعلي
     \"type\": \"proposed_schedule\",
     \"title\": \"الجدول المقترح\",
     \"courses\": [{\"id\": 123, \"reason\": \"سبب الاختيار\"}]
  }
}";

        return [
            'parts' => [['text' => $systemPrompt]]
        ];
    }
}
