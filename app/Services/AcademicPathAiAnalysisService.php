<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;

class AcademicPathAiAnalysisService
{
    public function __construct(private readonly GeminiService $gemini)
    {
    }

    public function analyze(User $user, array $path): array
    {
        if (!config('academic_path_planner.ai_analysis_enabled', true) || ($path['status'] ?? null) !== 'ready') {
            $path['ai'] = ['used' => false, 'status' => 'not_required'];

            return $path;
        }

        $startedAt = microtime(true);
        $courses = collect($path['current_semester']['courses'] ?? []);
        $allowedIds = $courses->pluck('id')->map(fn ($id) => (int) $id)->all();

        try {
            $payload = [
                'goal' => $path['goal']['label'] ?? '',
                'validated_plan_summary' => $path['summary'] ?? [],
                'current_semester' => $courses->map(fn (array $course) => [
                    'course_id' => (int) $course['id'],
                    'name' => $course['name'],
                    'code' => $course['code'],
                    'credit_hours' => (int) $course['credit_hours'],
                    'difficulty_level' => (int) $course['difficulty_level'],
                    'priority' => $course['priority'],
                    'rule_engine_reasons' => $course['reasons'],
                    'direct_unlocks' => (int) $course['unlocks']['direct_count'],
                    'path_unlocks' => (int) $course['unlocks']['total_path_count'],
                ])->values()->all(),
                'future_roadmap' => collect($path['roadmap'] ?? [])->map(fn (array $semester) => [
                    'semester' => $semester['label'],
                    'total_hours' => (int) $semester['total_hours'],
                    'courses' => collect($semester['courses'])->pluck('name')->values()->all(),
                ])->values()->all(),
            ];

            $raw = $this->gemini->callGeminiAPI(
                [['role' => 'user', 'parts' => [['text' => json_encode($payload, JSON_UNESCAPED_UNICODE)]]]],
                [
                    'timeout' => 25,
                    'systemInstruction' => ['parts' => [['text' =>
                        'أنت مرشد أكاديمي عربي. الخطة المرسلة تم بناؤها والتحقق منها مسبقًا بقواعد الجامعة. '
                        .'حلّلها واشرحها باختصار وبأسلوب شخصي ومهني. ممنوع إضافة أو حذف أو استبدال أو إعادة ترتيب أي مادة، '
                        .'وممنوع اختراع أسماء أو أرقام مواد. أعد JSON فقط حسب المخطط المطلوب.'
                    ]]],
                    'generationConfig' => [
                        'temperature' => 0.25,
                        'maxOutputTokens' => 1200,
                        'responseSchema' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'overall_analysis' => ['type' => 'STRING'],
                                'next_step' => ['type' => 'STRING'],
                                'risk_note' => ['type' => 'STRING'],
                                'course_explanations' => [
                                    'type' => 'ARRAY',
                                    'items' => [
                                        'type' => 'OBJECT',
                                        'properties' => [
                                            'course_id' => ['type' => 'INTEGER'],
                                            'explanation' => ['type' => 'STRING'],
                                            'strategic_impact' => ['type' => 'STRING'],
                                        ],
                                        'required' => ['course_id', 'explanation', 'strategic_impact'],
                                    ],
                                ],
                            ],
                            'required' => ['overall_analysis', 'next_step', 'risk_note', 'course_explanations'],
                        ],
                    ],
                ]
            );

            $analysis = $this->gemini->parseJsonResponse($raw);
            $explanations = collect($analysis['course_explanations'] ?? [])
                ->filter(fn ($item) => is_array($item) && in_array((int) ($item['course_id'] ?? 0), $allowedIds, true))
                ->keyBy(fn ($item) => (int) $item['course_id']);

            $path['current_semester']['courses'] = $courses->map(function (array $course) use ($explanations) {
                $item = $explanations->get((int) $course['id']);
                if ($item) {
                    $course['ai_explanation'] = $this->safeText($item['explanation'] ?? '', 420);
                    $course['ai_strategic_impact'] = $this->safeText($item['strategic_impact'] ?? '', 300);
                }

                return $course;
            })->all();

            $overall = $this->safeText($analysis['overall_analysis'] ?? '', 700);
            if ($overall === '') {
                throw new \UnexpectedValueException('Gemini returned an empty academic analysis.');
            }

            $path['ai'] = [
                'used' => true,
                'status' => 'completed',
                'analysis' => $overall,
                'next_step' => $this->safeText($analysis['next_step'] ?? '', 350),
                'risk_note' => $this->safeText($analysis['risk_note'] ?? '', 350),
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'generated_at' => now()->toISOString(),
            ];
        } catch (\Throwable $exception) {
            Log::warning('Academic path AI enhancement failed; using validated local plan.', [
                'user_id' => $user->id,
                'error' => $exception->getMessage(),
            ]);
            $path['ai'] = [
                'used' => false,
                'status' => 'fallback',
                'analysis' => $path['summary']['message'] ?? '',
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            ];
        }

        return $path;
    }

    private function safeText(mixed $value, int $limit): string
    {
        if (!is_string($value)) {
            return '';
        }

        return mb_substr(trim(strip_tags($value)), 0, $limit);
    }
}
