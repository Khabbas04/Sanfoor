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
    public function build(array $rules, array $rankedCourses, array $ragData, array $documentContext, array $riskWarnings = [], string $memoryBlock = ''): array
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
        $systemPrompt .= "- 🚦 الحد الأقصى للساعات المسموح به هذا الفصل: {$rules['effective_limit']} ساعة. **ممنوع منعاً باتاً اقتراح أو الموافقة على مجموع ساعات يتجاوز هذا الحد.**" . (!empty($rules['is_summer']) ? " (الفصل صيفي: الحد ٩ ساعات، ويصل ٩ فقط؛ ولا يُسمح بـ ١٠ إلا إذا كانت إحدى المواد مختبراً بساعة واحدة وبموافقة دائرة القبول والتسجيل.)" : "") . "\n";
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

        // 5. Formatting + answering instructions + strict response format (versioned config)
        $systemPrompt .= trim((string) config('ai.advisor.formatting_instructions')) . "\n\n";
        $systemPrompt .= trim((string) config('ai.advisor.answer_instructions')) . "\n\n";
        $systemPrompt .= trim((string) config('ai.advisor.response_format'));

        return [
            'parts' => [['text' => $systemPrompt]],
        ];
    }
}
