<?php

namespace App\Engines;

class AiContextAssembler
{
    /**
     * Assemble the final highly optimized prompt for Gemini.
     */
    public function build(array $rules, array $rankedCourses, array $ragData, array $documentContext): array
    {
        $systemPrompt = "أنت 'مرشد أكاديمي ذكي' في جامعة الزرقاء. دورك إرشاد الطالب بناءً على قوانين الجامعة وحالته الأكاديمية بدقة تامة.\n\n";

        // 1. Rules Context
        $systemPrompt .= "=== 📊 حالة الطالب الأكاديمية ===\n";
        $systemPrompt .= "- التخصص: " . ($ragData['profile']['major_name'] ?? 'عام') . "\n";
        $systemPrompt .= "- السنة: {$rules['student_year_label']} (إنجاز {$rules['progress_percent']}%)\n";
        $systemPrompt .= "- الساعات المجتازة: {$rules['total_passed_hours']}\n";
        $systemPrompt .= "- حالة الإنذار: " . ($rules['is_probation'] ? "نعم (الحد الأقصى {$rules['effective_limit']} ساعة)" : "لا") . "\n";
        $systemPrompt .= "- خريج هذا الفصل: " . ($rules['is_graduating'] ? "نعم" : "لا") . "\n";
        $systemPrompt .= "- السلة الحالية: {$rules['cart_hours']} ساعات. (تجاوز الحد: " . ($rules['cart_exceeds_limit'] ? 'نعم' : 'لا') . ")\n\n";

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
                $systemPrompt .= "- [ID: {$c['id']}] {$c['name']} (ساعات: {$c['credit_hours']}) | السبب: {$rc['reason']}\n";
            }
            $systemPrompt .= "\n";
        }

        // 4. Cart Courses
        if (!empty($ragData['cart']['ids'])) {
            $systemPrompt .= "=== 🛒 مواد السلة الحالية ===\n";
            $systemPrompt .= "IDs: " . implode(', ', $ragData['cart']['ids']) . "\n";
            $systemPrompt .= "الأسماء: " . $ragData['cart']['list'] . "\n\n";
        }

        // 5. Instruction & Format
        $systemPrompt .= "=== 🛠️ تعليمات الإجابة ===\n";
        $systemPrompt .= "1. أجب بلهجة احترافية وودية وبإيجاز.\n";
        $systemPrompt .= "2. ⚠️ تنبيه هام (غموض لغوي): كلمة 'مادة' قد يقصد بها الطالب (مقرر دراسي/Course) وقد يقصد بها (مادة قانونية/Article). إذا سأل عن 'قانون المادة كذا' فهو يقصد قانوناً، فابحث في قسم (قوانين جامعية) واذكر رقم المادة القانونية في ردك. وإذا سأل عن 'تنزيل مادة' فهو يقصد مقرراً دراسياً.\n";
        $systemPrompt .= "3. إذا طلب اقتراح مواد دراسية، اقترح فقط من 'المواد المقترحة' باستخدام الـ ID.\n";
        $systemPrompt .= "4. إذا تجاوز الحد المسموح، اقترح إزالة مواد باستخدام الـ ID من مواد السلة.\n";
        $systemPrompt .= "5. لا تقم بحساب عدد الغيابات رياضياً (مثل تحويل 15% إلى ساعات)، اذكر النسبة كما هي في القوانين لتجنب الخطأ.\n";
        $systemPrompt .= "6. التزم دائماً بصيغة JSON المحددة أدناه ولا تضف أي نص خارج الـ JSON.\n\n";
        
        $systemPrompt .= "=== 📝 صيغة الرد المطلوبة (Strict JSON) ===\n";
        $systemPrompt .= "{
  \"reply\": \"نص الإجابة هنا (يدعم Markdown)\",
  \"suggested_course_ids\": [123, 456], // اختياري: قائمة بـ IDs المواد لاقتراحها
  \"courses_to_remove\": [789], // اختياري: قائمة بـ IDs المواد للحذف من السلة
  \"follow_up_suggestions\": [\"سؤال مقترح 1\", \"سؤال مقترح 2\"], // أسئلة مقترحة للطالب
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
