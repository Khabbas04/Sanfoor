<?php

namespace App\Services;

use App\Engines\AcademicRulesEngine;
use App\Models\AcademicInsightState;
use App\Models\Course;
use App\Models\GraduationPlan;
use App\Models\User;
use App\Models\StudentActivityLog;
use App\Support\CourseEligibility;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class StudentDashboardInsightService
{
    public function __construct(private readonly AcademicRulesEngine $rulesEngine)
    {
    }

    public function for(User $user, bool $fresh = false): array
    {
        $key = self::cacheKey($user->id);
        if ($fresh) {
            Cache::forget($key);
        }

        return Cache::remember(
            $key,
            now()->addMinutes((int) config('academic_insights.cache_ttl_minutes', 15)),
            fn () => $this->build($user)
        );
    }

    public static function forget(int $userId): void
    {
        Cache::forget(self::cacheKey($userId));
    }

    private static function cacheKey(int $userId): string
    {
        $globalVersion = (int) Cache::get('academic_insights_version', 1);
        $courseVersion = (int) Cache::get('dashboard_courses_version', 1);

        return "dashboard_academic_insight:user:{$userId}:global:{$globalVersion}:courses:{$courseVersion}";
    }

    private function build(User $user): array
    {
        $user->loadMissing([
            'major',
            'passedCourses:id,name,code,credit_hours,type,semester,major_id,study_plan_version,minimum_passed_hours',
            'cartCourses:id,name,code,credit_hours,difficulty_level,type,semester,major_id,study_plan_version',
        ]);

        $passed = $user->passedCourses
            ->filter(fn (Course $course) => $course->pivot->grade === null || (float) $course->pivot->grade >= 50);
        $passedIds = $passed->pluck('id')->map(fn ($id) => (int) $id)->all();
        $passedHours = (int) $passed->sum('credit_hours');
        $cart = $user->cartCourses;
        $cartHours = (int) $cart->sum('credit_hours');
        $rules = $this->rulesEngine->evaluate($user, ['total_passed_hours' => $passedHours], $cartHours);

        $candidates = collect();
        $this->addCriticalCourseCandidate($candidates, $user, $passedIds, $passedHours);
        $this->addRiskyCartCandidate($candidates, $cart, $rules);
        $this->addGraduationRiskCandidate($candidates, $user, $passedIds);
        $this->addGpaOpportunityCandidate($candidates, $user);
        $this->addMissingDataCandidate($candidates, $user);

        if ($candidates->isEmpty()) {
            $candidates->push($this->candidate(
                type: 'positive_status',
                priority: 'low',
                recommendation: 'مسارك الأكاديمي مستقر',
                summary: $cart->isEmpty()
                    ? 'لا توجد مشكلة مهمة الآن، ويمكنك البدء بتجهيز تسجيل الفصل القادم.'
                    : 'لم نرصد مشكلة مهمة في بياناتك أو تسجيلك التجريبي الحالي.',
                reasons: ['المواد المسجلة ضمن الحد الحالي', 'لا توجد عوائق أكاديمية حرجة ظاهرة'],
                impact: ['risk_level' => 'low'],
                action: ['type' => 'open_tree', 'label' => 'تجهيز التسجيل', 'url' => route('tree.index')],
                factors: ['data_confidence' => 0.75],
                factType: 'academic_fact'
            ));
        }

        $selected = $candidates
            ->map(fn (array $candidate) => $this->score($candidate))
            ->sortByDesc('score')
            ->first();

        $selected['generated_at'] = now()->toISOString();
        $selected['expires_at'] = now()->addMinutes((int) config('academic_insights.cache_ttl_minutes', 15))->toISOString();
        $selected['version'] = (string) config('academic_insights.version');
        $selected['fingerprint'] = hash('sha256', implode('|', [
            $user->id,
            $selected['type'],
            $selected['subject_id'] ?? 'none',
            $selected['priority'],
            config('academic_insights.version'),
        ]));

        $state = AcademicInsightState::firstOrCreate(
            ['user_id' => $user->id, 'fingerprint' => $selected['fingerprint']],
            [
                'insight_type' => $selected['type'],
                'priority' => $selected['priority'],
                'recommendation_version' => (string) config('academic_insights.version'),
            ]
        );
        if ($state->wasRecentlyCreated) {
            StudentActivityLog::create([
                'user_id' => $user->id,
                'action' => 'insight_generated',
                'details' => [
                    'insight_type' => $selected['type'],
                    'priority' => $selected['priority'],
                    'recommendation_version' => (string) config('academic_insights.version'),
                ],
            ]);
        }

        if ($this->isDismissed($user->id, $selected['fingerprint'])) {
            return [
                ...$selected,
                'dismissed' => true,
                'state' => 'dismissed',
            ];
        }

        return [...$selected, 'dismissed' => false, 'state' => $selected['type'] === 'missing_data' ? 'missing_data' : 'success'];
    }

    private function addCriticalCourseCandidate(Collection $candidates, User $user, array $passedIds, int $passedHours): void
    {
        if (!$user->major_id || !$user->study_plan_version) {
            return;
        }

        $courses = Course::query()
            ->select(['id', 'name', 'code', 'credit_hours', 'minimum_passed_hours', 'major_id', 'study_plan_version'])
            ->with(['prerequisites:id'])
            ->withCount('children')
            ->where('major_id', $user->major_id)
            ->where('study_plan_version', (int) $user->study_plan_version)
            ->whereNotIn('id', $passedIds ?: [0])
            ->orderByDesc('children_count')
            ->limit(20)
            ->get();

        foreach ($courses as $course) {
            $unlocks = (int) $course->children_count;
            if ($unlocks < (int) config('academic_insights.critical_unlocks_threshold', 3)) {
                continue;
            }
            if (!$course->prerequisites->every(fn (Course $prerequisite) => in_array($prerequisite->id, $passedIds, true))) {
                continue;
            }
            if (CourseEligibility::isLockedByPassedHours($course, $passedHours)) {
                continue;
            }

            $candidates->push($this->candidate(
                type: 'critical_course',
                priority: $unlocks >= 5 ? 'critical' : 'high',
                recommendation: "سجّل مادة {$course->name}",
                summary: "هذه المادة تفتح لك {$unlocks} مواد لاحقة، وتأجيلها قد يبطئ تقدمك في الخطة.",
                reasons: [
                    "تفتح {$unlocks} مواد لاحقة",
                    'متاحة حسب متطلباتك الحالية',
                    'ضمن نسختك الحالية من الخطة الدراسية',
                ],
                impact: [
                    'unlocks_courses_count' => $unlocks,
                    'possible_delay_semesters' => $unlocks >= 5 ? 1 : null,
                    'risk_level' => $unlocks >= 5 ? 'high' : 'medium',
                ],
                action: [
                    'type' => 'open_course',
                    'label' => 'عرض المادة',
                    'url' => route('tree.index', ['course_id' => $course->id]),
                ],
                factors: [
                    'urgency' => min(1, $unlocks / 6),
                    'academic_impact' => min(1, $unlocks / 5),
                    'graduation_delay' => $unlocks >= 5 ? 0.8 : 0.4,
                    'prerequisite_unlock' => min(1, $unlocks / 5),
                    'risk' => $unlocks >= 5 ? 0.8 : 0.5,
                    'data_confidence' => 0.95,
                ],
                factType: 'academic_fact',
                subjectId: $course->id
            ));
        }
    }

    private function addRiskyCartCandidate(Collection $candidates, Collection $cart, array $rules): void
    {
        if ($cart->isEmpty()) {
            return;
        }

        $hardCourses = $cart->filter(fn (Course $course) => (int) $course->difficulty_level >= 4);
        $exceedsLimit = (bool) ($rules['cart_exceeds_limit'] ?? false);
        $lowGpaHeavyLoad = (float) ($rules['gpa_percentage'] ?? 0) > 0
            && (float) $rules['gpa_percentage'] < 65
            && (int) $rules['cart_hours'] > 12;

        if (!$exceedsLimit && $hardCourses->count() < 2 && !$lowGpaHeavyLoad) {
            return;
        }

        $reasons = [];
        if ($exceedsLimit) {
            $reasons[] = "الحمل يتجاوز الحد الحالي بـ {$rules['excess_hours']} ساعة";
        }
        if ($hardCourses->count() >= 2) {
            $reasons[] = "تجمع {$hardCourses->count()} مواد مرتفعة الصعوبة";
        }
        if ($lowGpaHeavyLoad) {
            $reasons[] = 'الحمل مرتفع مقارنة بمعدلك الحالي';
        }

        $candidates->push($this->candidate(
            type: 'risky_cart',
            priority: $exceedsLimit ? 'critical' : 'high',
            recommendation: 'راجع سلة التسجيل',
            summary: 'تسجيلك الحالي يحتاج تعديلًا بسيطًا لتقليل المخاطرة والالتزام بالحد الأكاديمي.',
            reasons: $reasons,
            impact: [
                'cart_hours' => (int) $rules['cart_hours'],
                'effective_limit' => (int) $rules['effective_limit'],
                'risk_level' => $exceedsLimit ? 'high' : 'medium',
            ],
            action: ['type' => 'open_cart', 'label' => 'مراجعة السلة', 'url' => route('tree.index').'#cart'],
            factors: [
                'urgency' => $exceedsLimit ? 1 : 0.75,
                'academic_impact' => 0.75,
                'risk' => $exceedsLimit ? 1 : 0.75,
                'data_confidence' => 0.9,
            ],
            factType: 'academic_fact'
        ));
    }

    private function addGraduationRiskCandidate(Collection $candidates, User $user, array $passedIds): void
    {
        $plan = GraduationPlan::query()->where('user_id', $user->id)->first();
        if (!$plan || !is_array($plan->payload)) {
            return;
        }

        $plannedIds = collect($plan->payload['semesters'] ?? [])->pluck('course_ids')->flatten()->map(fn ($id) => (int) $id);
        $invalidCount = $plannedIds->filter(fn ($id) => in_array($id, $passedIds, true))->count();
        if ($invalidCount === 0) {
            return;
        }

        $candidates->push($this->candidate(
            type: 'graduation_risk',
            priority: 'medium',
            recommendation: 'حدّث خطة التخرج',
            summary: 'تحتوي الخطة المحفوظة على مواد أنجزتها بالفعل، وقد لا تعكس مسارك الحالي بدقة.',
            reasons: ["وجدنا {$invalidCount} مواد منجزة داخل الخطة المستقبلية", 'الخطة تحتاج مزامنة مع سجلك الحالي'],
            impact: ['possible_delay_semesters' => null, 'risk_level' => 'medium'],
            action: ['type' => 'open_plan', 'label' => 'تحديث الخطة', 'url' => route('tree.index').'#graduation-plan'],
            factors: [
                'urgency' => 0.6,
                'academic_impact' => 0.7,
                'graduation_delay' => 0.5,
                'risk' => 0.6,
                'data_confidence' => 0.8,
            ],
            factType: 'prediction'
        ));
    }

    private function addGpaOpportunityCandidate(Collection $candidates, User $user): void
    {
        $failed = $user->passedCourses
            ->filter(fn (Course $course) => $course->pivot->grade !== null && (float) $course->pivot->grade < 60)
            ->sortBy(fn (Course $course) => (float) $course->pivot->grade)
            ->first();

        if (!$failed) {
            return;
        }

        $candidates->push($this->candidate(
            type: 'gpa_opportunity',
            priority: 'medium',
            recommendation: "راجع خيار إعادة مادة {$failed->name}",
            summary: 'تحسين علامة مادة منخفضة قد يساعد في رفع معدلك، وفق قواعد الإعادة المعتمدة.',
            reasons: [
                "علامتك المسجلة {$failed->pivot->grade}%",
                "المادة تحمل {$failed->credit_hours} ساعات",
            ],
            impact: ['risk_level' => 'medium'],
            action: ['type' => 'open_calculator', 'label' => 'حساب الأثر', 'url' => route('calculator.index')],
            factors: [
                'urgency' => 0.4,
                'academic_impact' => min(1, ((int) $failed->credit_hours) / 3),
                'risk' => 0.4,
                'data_confidence' => 0.75,
            ],
            factType: 'recommendation',
            subjectId: $failed->id
        ));
    }

    private function addMissingDataCandidate(Collection $candidates, User $user): void
    {
        $missing = [];
        if (!$user->major_id) {
            $missing[] = 'التخصص';
        }
        if (!$user->study_plan_version) {
            $missing[] = 'نسخة الخطة الدراسية';
        }
        if (!$missing) {
            return;
        }

        $candidates->push($this->candidate(
            type: 'missing_data',
            priority: 'medium',
            recommendation: 'أكمل بيانات خطتك الدراسية',
            summary: 'نحتاج هذه البيانات حتى تكون توصيات المواد مرتبطة بخطتك الصحيحة.',
            reasons: array_map(fn ($field) => "{$field} غير محدد", $missing),
            impact: ['risk_level' => 'medium'],
            action: ['type' => 'complete_profile', 'label' => 'إكمال البيانات', 'url' => route('profile.edit')],
            factors: ['urgency' => 0.7, 'academic_impact' => 0.8, 'risk' => 0.6, 'data_confidence' => 1],
            factType: 'academic_fact'
        ));
    }

    private function candidate(
        string $type,
        string $priority,
        string $recommendation,
        string $summary,
        array $reasons,
        array $impact,
        array $action,
        array $factors,
        string $factType,
        ?int $subjectId = null
    ): array {
        return [
            'type' => $type,
            'priority' => $priority,
            'title' => 'أهم قرار لك الآن',
            'recommendation' => $recommendation,
            'summary' => $summary,
            'reasons' => array_slice(array_values($reasons), 0, 3),
            'impact' => $impact,
            'confidence' => [
                'value' => round((float) ($factors['data_confidence'] ?? 0.7), 2),
                'label' => ($factors['data_confidence'] ?? 0.7) >= 0.85 ? 'مرتفعة' : 'متوسطة',
                'based_on' => ['الخطة الدراسية', 'المواد المجتازة', 'المتطلبات الأكاديمية'],
            ],
            'action' => $action,
            'secondary_action' => $type === 'positive_status' ? null : ['type' => 'dismiss', 'label' => 'ليس الآن'],
            'fact_type' => $factType,
            'factors' => $factors,
            'subject_id' => $subjectId,
        ];
    }

    private function score(array $candidate): array
    {
        $weights = config('academic_insights.weights');
        $score = (float) ($weights['type_priority'][$candidate['type']] ?? 0);
        $breakdown = ['type_priority' => $score];

        foreach (['urgency', 'academic_impact', 'graduation_delay', 'prerequisite_unlock', 'risk', 'data_confidence'] as $factor) {
            $points = round((float) ($candidate['factors'][$factor] ?? 0) * (float) ($weights[$factor] ?? 0), 2);
            $breakdown[$factor] = $points;
            $score += $points;
        }

        unset($candidate['factors']);

        return [...$candidate, 'score' => round($score, 2), 'score_breakdown' => $breakdown];
    }

    private function isDismissed(int $userId, string $fingerprint): bool
    {
        return AcademicInsightState::query()
            ->where('user_id', $userId)
            ->where('fingerprint', $fingerprint)
            ->where('dismissed_until', '>', now())
            ->exists();
    }
}
