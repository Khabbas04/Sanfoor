<?php

namespace App\Engines;

use App\Models\Course;
use App\Models\User;
use App\Models\AcademicPeriod;

/**
 * Builds a personalized "proactive briefing" the advisor shows the moment the
 * student opens the page — before they ask anything. It analyses where the
 * student stands (progress, per-section gaps, graduation forecast, the single
 * most strategic course to take next, and academic risks) and returns a
 * structured payload the frontend renders as a rich card.
 *
 * Everything here is deterministic and computed from the student's own data —
 * no LLM call — so it is instant, free, and never fails a live demo.
 */
class ProactiveInsightsEngine
{
    /** University plan section sizes (credit hours). */
    private const SECTION_DEFS = [
        ['key' => 'university_req', 'label' => 'متطلبات الجامعة', 'total' => 30, 'icon' => '🌐'],
        ['key' => 'compulsory',     'label' => 'تخصص إجباري',     'total' => 87, 'icon' => '💻'],
        ['key' => 'elective',       'label' => 'تخصص اختياري',    'total' => 9,  'icon' => '🎯'],
        ['key' => 'supporting',     'label' => 'مواد مساندة',      'total' => 6,  'icon' => '🧩'],
    ];

    public function generate(User $user): array
    {
        $user->loadMissing(['major', 'passedCourses', 'cartCourses']);

        $passed = $user->passedCourses->filter(function ($c) {
            $grade = $c->pivot->grade ?? null;
            return $grade === null || (float) $grade >= 50;
        });
        $passedIds = $passed->pluck('id')->map('intval')->all();

        $gpaData = $user->calculateGPA();
        $gpaPct = isset($gpaData['percentage']) ? (float) $gpaData['percentage'] : 0.0;
        $hasRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
        $isProbation = $hasRecords && $gpaPct > 0 && $gpaPct < 60;

        $passedHours = (int) $passed->sum('credit_hours');
        $totalPlan = $user->major && method_exists($user->major, 'getTotalHours')
            ? (int) $user->major->getTotalHours()
            : 132;
        $totalPlan = $totalPlan > 0 ? $totalPlan : 132;
        $remaining = max(0, $totalPlan - $passedHours);
        $progress = (int) round($passedHours / $totalPlan * 100);
        $cartHours = (int) $user->cartCourses->sum('credit_hours');

        $rawName = trim((string) ($user->name ?? ''));
        $firstName = $rawName !== '' ? (preg_split('/\s+/', $rawName)[0] ?? '') : '';

        // --- Per-section progress ---
        $sections = [];
        foreach (self::SECTION_DEFS as $def) {
            $done = (int) $passed->where('type', $def['key'])->sum('credit_hours');
            $done = min($done, $def['total']);
            $sections[] = [
                'label' => $def['label'],
                'icon' => $def['icon'],
                'done' => $done,
                'total' => $def['total'],
                'remaining' => max(0, $def['total'] - $done),
                'percent' => $def['total'] > 0 ? (int) round($done / $def['total'] * 100) : 0,
            ];
        }

        // --- Graduation forecast (typical 15 credit hours per regular semester) ---
        $semestersLeft = $remaining > 0 ? (int) ceil($remaining / 15) : 0;

        // --- Most strategic ("pivotal") course available now ---
        $pivotal = $this->findPivotalCourse($user, $passedIds);

        // --- Risks ---
        $risks = $this->detectRisks($user, $gpaPct, $isProbation, $cartHours, $passedIds);

        // --- Build headline + highlight chips ---
        [$headline, $highlights, $quickActions] = $this->composeNarrative(
            $firstName, $hasRecords, $isProbation, $gpaPct, $progress, $remaining,
            $semestersLeft, $cartHours, $sections, $pivotal, $risks
        );

        return [
            'first_name' => $firstName,
            'greeting' => $firstName !== '' ? "أهلاً {$firstName} 👋" : 'أهلاً وسهلاً 👋',
            'headline' => $headline,
            'progress' => [
                'percent' => $progress,
                'passed' => $passedHours,
                'total' => $totalPlan,
                'remaining' => $remaining,
            ],
            'gpa' => $hasRecords ? round($gpaPct, 1) : null,
            'graduation_forecast' => $semestersLeft > 0
                ? "بمعدل ١٥ ساعة/فصل، يفصلك عن التخرج حوالي {$semestersLeft} " . ($semestersLeft == 1 ? 'فصل دراسي' : ($semestersLeft == 2 ? 'فصلين دراسيين' : 'فصول دراسية'))
                : 'أنجزت كل ساعات خطتك تقريباً — تبقّى إنهاء الإجراءات النهائية 🎓',
            'sections' => $sections,
            'highlights' => $highlights,
            'quick_actions' => $quickActions,
        ];
    }

    /** Course that unlocks the most others and whose prerequisites are already met. */
    private function findPivotalCourse(User $user, array $passedIds): ?array
    {
        try {
            $planVersion = (int) ($user->study_plan_version ?? 12);
            $query = Course::with('prerequisites')
                ->withCount('children')
                ->whereNotIn('id', $passedIds)
                ->where('study_plan_version', $planVersion);

            if ($user->major_id) {
                $query->where('major_id', $user->major_id);
            }

            $candidates = $query->orderByDesc('children_count')->limit(10)->get();

            foreach ($candidates as $c) {
                if ((int) $c->children_count < 1) {
                    continue;
                }
                $prereqMet = $c->prerequisites->every(fn ($p) => in_array($p->id, $passedIds, true));
                if ($prereqMet) {
                    return [
                        'name' => $c->name,
                        'unlocks' => (int) $c->children_count,
                        'credit_hours' => (int) $c->credit_hours,
                    ];
                }
            }
        } catch (\Throwable $e) {
            // Best-effort only; a missing relation must never break the page.
        }

        return null;
    }

    private function detectRisks(User $user, float $gpaPct, bool $isProbation, int $cartHours, array $passedIds): array
    {
        $risks = [];

        if ($isProbation) {
            $risks[] = 'أنت تحت الإنذار الأكاديمي — الأولوية لرفع المعدل بمواد مضمونة.';
        } elseif ($gpaPct > 0 && $gpaPct < 65) {
            $risks[] = 'معدلك قريب من حد الإنذار — احذر التحميل الزائد هذا الفصل.';
        }

        if ($cartHours > 18) {
            $risks[] = "تسجيلك التجريبي {$cartHours} ساعة ويتجاوز الحد المسموح.";
        }

        return $risks;
    }

    /**
     * @return array{0:string,1:array,2:array} [headline, highlights, quickActions]
     */
    private function composeNarrative(
        string $firstName, bool $hasRecords, bool $isProbation, float $gpaPct, int $progress,
        int $remaining, int $semestersLeft, int $cartHours, array $sections, ?array $pivotal, array $risks
    ): array {
        $highlights = [];
        $quickActions = [];

        if (!$hasRecords) {
            $headline = 'أهلاً بك في بداية رحلتك الجامعية! 🚀';
            $highlights[] = ['type' => 'opportunity', 'icon' => '🌱', 'text' => 'ما عندك مواد منجزة بعد — خلّينا نرتّب لك بداية قوية وصحيحة.'];
            $quickActions = ['اقترح لي أفضل مواد أبدأ فيها', 'كم ساعة أسجّل في أول فصل؟', 'رتّب لي خطة بداية بسيطة'];
        } else {
            $headline = "أنجزت {$progress}% من خطتك — " . ($progress >= 80 ? 'قربت تتخرج! 🎓' : ($progress >= 40 ? 'ماشي بخطى ثابتة 💪' : 'البداية موفّقة، كمّل! ✨'));

            if ($isProbation) {
                $highlights[] = ['type' => 'risk', 'icon' => '🚨', 'text' => "معدلك {$gpaPct}% وأنت تحت الإنذار — خلّينا نبني خطة إنقاذ لرفع معدلك."];
                $quickActions[] = 'اعمل لي خطة إنقاذ لرفع معدلي';
                $quickActions[] = 'اقترح لي مواد سهلة ترفع معدلي';
            } elseif ($gpaPct > 0 && $gpaPct < 65) {
                $highlights[] = ['type' => 'warning', 'icon' => '⚠️', 'text' => "معدلك {$gpaPct}% — قريب من الإنذار، ركّز على مواد متوازنة."];
                $quickActions[] = 'شو أفضل مواد ترفع معدلي هذا الفصل؟';
            }

            if ($progress >= 80) {
                $highlights[] = ['type' => 'opportunity', 'icon' => '🎓', 'text' => "باقيلك {$remaining} ساعة فقط — خلّينا ننهيها بأقصر طريق."];
                $quickActions[] = 'رتّب لي المواد المتبقية للتخرج';
            }
        }

        // Pivotal course highlight (strong "wow" — strategic advice unprompted).
        if ($pivotal && $pivotal['unlocks'] > 0) {
            $n = $pivotal['unlocks'];
            $unlocksText = $n == 1 ? 'مادة لاحقة واحدة' : ($n == 2 ? 'مادتين لاحقتين' : "{$n} مواد لاحقة");
            $highlights[] = [
                'type' => 'pivotal',
                'icon' => '🔑',
                'text' => "مادة **{$pivotal['name']}** مفصلية: تفتح لك {$unlocksText} — يُفضّل تأخذها قريباً.",
            ];
        }

        // A section that's within reach of completion.
        foreach ($sections as $s) {
            if ($s['remaining'] > 0 && $s['remaining'] <= 6 && $s['done'] > 0) {
                $highlights[] = [
                    'type' => 'opportunity',
                    'icon' => $s['icon'],
                    'text' => "باقيلك {$s['remaining']} ساعة فقط لإنهاء قسم ({$s['label']}).",
                ];
                break;
            }
        }

        // Cart nudge.
        if ($cartHours === 0 && $hasRecords) {
            $quickActions[] = 'اقترح لي مواد أضيفها لتسجيلي هذا الفصل';
        } elseif ($cartHours > 0) {
            $quickActions[] = 'راجع تسجيلي التجريبي وقيّمه';
        }

        // Always-useful defaults, de-duplicated, capped at 4.
        $quickActions[] = 'كم ساعة أقدر أسجّل هذا الفصل؟';
        $quickActions[] = 'مين دكاترة المواد المطروحة؟';
        $quickActions = array_values(array_slice(array_unique($quickActions), 0, 4));

        // Cap highlights at 4, most important first (risks already prepended above).
        $highlights = array_slice($highlights, 0, 4);

        return [$headline, $highlights, $quickActions];
    }
}
