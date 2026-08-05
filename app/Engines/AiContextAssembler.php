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
    public function build(array $rules, array $rankedCourses, array $ragData, array $documentContext, array $riskWarnings = [], string $memoryBlock = '', array $toolFacts = [], array $preferences = []): array
    {
        $systemPrompt = trim((string) config('ai.advisor.persona')) . "\n\n";

        // 0. Rolling memory of older turns (ConversationMemoryEngine). Lives in the
        // system prompt so `contents` stays a clean alternating transcript.
        if ($memoryBlock !== '') {
            $systemPrompt .= $memoryBlock;
        }

        // 0.5 User UI Preferences & Smart Settings (التفضيلات والإعدادات الذكية)
        if (!empty($preferences)) {
            $prefLines = [];

            // Filters (Course types)
            $userFilters = $preferences['filters'] ?? [];
            if (!empty($userFilters) && is_array($userFilters)) {
                $filterMap = [
                    'compulsory' => 'إجباري (تخصص)',
                    'elective' => 'اختياري (تخصص)',
                    'university_req' => 'متطلب جامعة (أونلاين)',
                    'supporting' => 'مساندة / كلية',
                ];
                $labels = array_map(fn($f) => $filterMap[$f] ?? $f, $userFilters);
                $prefLines[] = "- 🎯 **أنواع المواد المطلوبة (فلتر إلزامي)**: الطالب حدد تفضيلاته لنوع المواد المراد التركيز عليها واقتراحها وهي: [" . implode('، ', $labels) . "]. التزم حصراً باقتراح مواد تطابق هذه الأنواع واذكر ذلك في إجابتك.";
            }

            // Critical Path
            if (!empty($preferences['critical_path'])) {
                $prefLines[] = "- 🔑 **المسار الحرج (تفتح مواد)**: الطالب فعّل خيار المسار الحرج — ركّز بشدة على المواد المفتاحية التي تفتح مواداً ومسارات أخرى في الخطة القادمة (أولوية قصوى لمواد الـ Unlocks وسلاسل المتطلبات) واشرح له كيف ستفتح له مسارات جديدة.";
            }

            // Code Mode
            if (!empty($preferences['wants_code'])) {
                $prefLines[] = "- 💻 **وضع الأكواد البرمجية مُفعل**: الطالب فعّل وضع الأكواد — إذا تضمّن السؤال أو الشرح أو الأمثلة أي كود برمجي، وفّر الكود كاملاً داخل صندوق أكواد Markdown مع تحديد لغة البرمجة بدقة (مثال: ```java أو ```python).";
            }

            // Difficulty
            if (!empty($preferences['difficulty'])) {
                $diff = $preferences['difficulty'];
                if ($diff === 'easy') {
                    $prefLines[] = "- 🌱 **مستوى الصعوبة (سهل / رفع المعدل)**: الطالب اختار مواد سهلة ومناسبة لرفع المعدل. ركّز على المواد ذات الصعوبة المنخفضة (1 أو 2 من 5) والعبء الخفيف.";
                } elseif ($diff === 'hard') {
                    $prefLines[] = "- 🔥 **مستوى الصعوبة (صعب / دسم)**: الطالب يفضل المواد الدسمة والمتقدمة ذات التحدي العلمي (صعوبة 4 أو 5 من 5).";
                } elseif ($diff === 'balanced') {
                    $prefLines[] = "- ⚖️ **مستوى الصعوبة (متوازن)**: الطالب يفضل جدولاً متوازناً يجمع بين المواد المتوسطة والسهلة (صعوبة 3 من 5).";
                }
            }

            if (!empty($prefLines)) {
                $systemPrompt .= "=== 🎛️ التفضيلات والإعدادات الذكية المحددة من الطالب لهذا السؤال ===\n";
                $systemPrompt .= "الطالب قام بتفعيل وتحديد التفضيلات التالية من قائمة الإعدادات الذكية، ويجب الالتزام بها تماماً:\n";
                foreach ($prefLines as $line) {
                    $systemPrompt .= $line . "\n";
                }
                $systemPrompt .= "\n";
            }
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
        $passedCoursesNames = $ragData['profile']['passed_courses_names'] ?? '';
        if ($passedCoursesNames !== '') {
            $systemPrompt .= "- المواد المجتازة: {$passedCoursesNames}\n";
        } else {
            $systemPrompt .= "- المواد المجتازة: لا يوجد سجل مواد منجزة في النظام\n";
            $systemPrompt .= "- 🧠 **قاعدة ذكاء حرجة (تنبيه المواد المنجزة)**: بيانات الطالب تُظهر أنه لم ينجز أي مادة بعد. لكن إذا ذكر الطالب في رسالته أنه أنهى/خلّص/نزّل/اجتاز/نجح في مواد معينة (مثل: 'أنا خلصت سنة أولى' أو 'نزلت أساسيات' أو 'اجتزت كذا')، فهذا يعني أن سجله الأكاديمي **غير محدّث في النظام** ولا يعكس واقعه. في هذه الحالة:\n";
            $systemPrompt .= "  1. ⛔ **لا تقترح عليه أي مادة ذَكَر أنه أنجزها** مهما كانت ظاهرة في قائمة المواد المتاحة.\n";
            $systemPrompt .= "  2. ⛔ **لا تطبّق قاعدة الفصل الأول** (لأنه ليس طالب فصل أول فعلياً).\n";
            $systemPrompt .= "  3. ✅ **وجّهه بلطف وحزم** لتحديث بياناته الأكاديمية أولاً: 'لاحظت إنك ذكرت أنك أنهيت مواد بس سجلك عندي فاضي 😅. عشان أقدر أساعدك بدقة **لازم ترفع كشف علاماتك أو تحدّث المواد المنجزة** من صفحة الملف الشخصي أو شجرة المواد (اضغط على المادة واختر ناجح). بدون هالخطوة ممكن أقترح لك مواد إنت خلصتها!'\n";
            $systemPrompt .= "  4. ✅ بعد التنبيه، حاول تساعده **مبدئياً** بناءً على ما ذَكَره شفوياً مع التأكيد أن النتائج تقريبية حتى يُحدّث بياناته.\n";
        }

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

        // 3. Eligible Available Courses (المواد المتاحة والمؤهلة للتسجيل والجدولة)
        // 3. Eligible Available Courses (المواد المتاحة والمؤهلة للتسجيل والجدولة)
        if (!empty($rankedCourses)) {
            $systemPrompt .= "=== 🟢 المواد المتاحة والمؤهلة للتسجيل والجدولة (Eligible Available Courses) ===\n";
            $systemPrompt .= "⛔ تنبيه حاسم: هذه هي المواد الوحيدة المتاحة والمسموح للطالب بتسجيلها أو إدراجها في أي جدول دراسي. جميع هذه المواد مستوفية للمتطلبات السابقة:\n";
            foreach ($rankedCourses as $rc) {
                $c = $rc['course'];
                $prereqText = empty($c['prereqs']) ? 'لا يوجد' : implode('، ', $c['prereqs']);
                $unlocksText = empty($c['unlocks_courses']) ? 'لا تفتح مواد أخرى' : implode('، ', $c['unlocks_courses']);
                $semesterInfo = !empty($c['course_semester']) ? "| الفصل الاسترشادي: {$c['course_semester']} " : '';
                $isUnivReq = in_array($c['type'] ?? '', ['university_req', 'university_elective'], true);
                $typeTag = $isUnivReq ? ' [🌐 متطلب جامعة أونلاين - مرن وبدون تعارض أوقات]' : '';

                $sectionsText = '';
                if (!empty($c['sections']) && is_array($c['sections'])) {
                    $secParts = [];
                    foreach ($c['sections'] as $sec) {
                        $inst = !empty($sec['instructor']) ? $sec['instructor'] : 'دكتور غير محدد';
                        $days = !empty($sec['days']) ? $sec['days'] : 'أونلاين / مرن';
                        $time = !empty($sec['time']) ? $sec['time'] : '';
                        $hall = !empty($sec['hall']) ? " قاعة {$sec['hall']}" : '';
                        $secParts[] = "{$inst} ({$days} {$time}{$hall})";
                    }
                    $sectionsText = ' | الشُعب والمواعيد: ' . implode('، ', $secParts);
                } elseif (!empty($c['schedule_info'])) {
                    $sectionsText = " | الشُعب: {$c['schedule_info']}";
                } elseif ($isUnivReq) {
                    $sectionsText = ' | الشُعب والمواعيد: شعبة أونلاين (دراسة ذاتية / غير متزامنة تناسب جميع الأيام ح ث خ و ن ر بدون تعارض زمني)';
                }

                $systemPrompt .= "- [ID: {$c['id']}]{$typeTag} {$c['name']} (ساعات: {$c['credit_hours']} | صعوبة: {$c['difficulty_level']}/5) {$semesterInfo}{$sectionsText} | يسبقها: {$prereqText} | تفتح: {$unlocksText} | السبب: {$rc['reason']}\n";
            }
            $systemPrompt .= "\n";
        }

        // 3.5 Locked Courses (المواد المغلقة - ممنوع جدولتها إطلاقاً)
        if (!empty($ragData['locked_courses'])) {
            $systemPrompt .= "=== 🔒 المواد المغلقة في خطة الطالب (Locked Courses - ممنوع منعاً باتاً جدولتها أو اقتراح تسجيلها) ===\n";
            $systemPrompt .= "⛔ تحذير قاطع: هذه المواد مغلقة لعدم استيفاء متطلباتها السابقة. ممنوع وضع أي مادة منها في جدول دراسي أو اقتراح تسجيلها للطالب. استخدم هذه البيانات فقط إذا سأل الطالب بالاسم عن مادة منها أو عن مدرسها:\n";
            foreach ($ragData['locked_courses'] as $lc) {
                $reasons = !empty($lc['reasons']) ? implode('، ', $lc['reasons']) : 'متطلب سابق غير مجتاز';
                $secParts = [];
                if (!empty($lc['sections']) && is_array($lc['sections'])) {
                    foreach ($lc['sections'] as $sec) {
                        $inst = !empty($sec['instructor']) ? $sec['instructor'] : 'غير محدد';
                        $days = !empty($sec['days']) ? $sec['days'] : '';
                        $time = !empty($sec['time']) ? $sec['time'] : '';
                        $secParts[] = "{$inst} ({$days} {$time})";
                    }
                }
                $secText = !empty($secParts) ? ' | الشُعب المطروحة: ' . implode('، ', $secParts) : '';
                $systemPrompt .= "- [🔒 مغلقة - سبب الإغلاق: {$reasons}] {$lc['name']}{$secText}\n";
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
