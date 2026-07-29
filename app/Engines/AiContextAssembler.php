<?php

namespace App\Engines;

class AiContextAssembler
{
    /**
     * Assemble the final highly optimized prompt for Gemini.
     *
     * Persona / formatting / answering / response-format blocks live in config/ai.php
     * (versioned via ai.prompt_version) so they can be tuned without touching code and
     * so every reply can be correlated with the prompt version that produced it.
     */
    public function build(array $rules, array $rankedCourses, array $ragData, array $documentContext, array $riskWarnings = [], string $memoryBlock = '', array $toolFacts = []): array
    {
        $systemPrompt = trim((string) config('ai.advisor.persona')) . "\n\n";

        // 0. Rolling memory of older turns (ConversationMemoryEngine). Lives in the
        // system prompt so `contents` stays a clean alternating transcript.
        if ($memoryBlock !== '') {
            $systemPrompt .= $memoryBlock;
        }

        // 1. Rules Context
        // Address the student by their first name only (the DB stores the full name).
        $rawName = trim((string) ($ragData['profile']['student_name'] ?? ''));
        $firstName = $rawName !== '' ? (preg_split('/\s+/', $rawName)[0] ?? '') : '';

        $termType = !empty($rules['is_summer']) ? 'صيفي' : 'عادي';

        $systemPrompt .= "=== 📊 بيانات الطالب ===\n";
        $systemPrompt .= "- الاسم الأول (ناده به دائماً بدل كلمة 'طالب'): " . ($firstName !== '' ? $firstName : "غير متوفر — رحّب به بلطف بدون استخدام كلمة 'طالب'") . "\n";
        $systemPrompt .= "- التخصص: " . ($ragData['profile']['major_name'] ?? 'عام') . "\n";
        $systemPrompt .= "- السنة: {$rules['student_year_label']} (إنجاز {$rules['progress_percent']}%)\n";
        $systemPrompt .= "- الساعات المجتازة: {$rules['total_passed_hours']} ساعة\n";
        $systemPrompt .= "- المواد المجتازة: " . ($ragData['profile']['passed_courses_names'] ?? 'لا يوجد') . "\n";
        $systemPrompt .= "- حالة الإنذار: " . ($rules['is_probation'] ? "نعم (طالب على إنذار أكاديمي)" : "لا") . "\n";
        $systemPrompt .= "- خريج هذا الفصل: " . ($rules['is_graduating'] ? "نعم" : "لا") . "\n";
        $systemPrompt .= "- نوع الفصل الحالي: {$termType}\n";
        // The number comes from the rules engine, which reads config/academic_terms.php.
        // It is never restated as a literal here: the prompt used to say "٩ ساعات" for
        // the summer term while the engine computed something else.
        $summerLimit = (int) config('academic_terms.limits.summer', 10);
        $systemPrompt .= "- 🚦 الحد الأقصى للساعات المسموح به هذا الفصل: {$rules['effective_limit']} ساعة. **ممنوع منعاً باتاً اقتراح أو الموافقة على مجموع ساعات يتجاوز هذا الحد.**"
            . (!empty($rules['is_summer']) ? " (الفصل الحالي صيفي: الحد الأقصى فيه {$summerLimit} ساعات.)" : '')
            . "\n";
        $systemPrompt .= "- تسلسل الفصول: {$rules['term_sequence_note']}\n";
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

        // 1.7 Verified tool results.
        //
        // These were computed by the application, not by the model, so they
        // outrank anything the model would otherwise infer — including its own
        // arithmetic. Placed before the course catalogue so they are read first.
        if (!empty($toolFacts)) {
            $systemPrompt .= "=== 🔧 نتائج موثوقة من أدوات النظام ===\n";
            $systemPrompt .= "هذه الأرقام والحقائق محسوبة من بيانات الطالب الفعلية بواسطة النظام نفسه. **اعتمد عليها حرفياً ولا تحسب بدلاً منها ولا تخالفها.** وإذا كان أحد السطور يقول إنه لا يوجد مصدر بيانات، فلا تجب من معرفتك العامة إطلاقاً — أَحِل الطالب للجهة المختصة بلطف:\n";
            foreach ($toolFacts as $fact) {
                $systemPrompt .= $fact . "\n";
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

        // 5. Formatting + answering instructions + strict response format (versioned config)
        $systemPrompt .= trim((string) config('ai.advisor.formatting_instructions')) . "\n\n";
        $systemPrompt .= trim((string) config('ai.advisor.answer_instructions')) . "\n\n";
        $systemPrompt .= trim((string) config('ai.advisor.response_format'));

        return [
            'parts' => [['text' => $systemPrompt]],
        ];
    }
}
