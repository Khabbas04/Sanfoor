<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\AcademicPathAiAnalysisService;
use App\Services\GeminiService;
use Mockery;
use Tests\TestCase;

class AcademicPathAiAnalysisServiceTest extends TestCase
{
    public function test_it_accepts_explanations_only_for_courses_in_the_validated_plan(): void
    {
        config()->set('academic_path_planner.ai_analysis_enabled', true);
        $gemini = Mockery::mock(GeminiService::class);
        $gemini->shouldReceive('callGeminiAPI')->once()->andReturn(json_encode([
            'overall_analysis' => 'هذه الخطة تحقق توازنًا مناسبًا لهدف الطالب.',
            'next_step' => 'ابدأ بتثبيت مواد الفصل الحالي.',
            'risk_note' => 'راقب الحمل الدراسي.',
            'course_explanations' => [
                ['course_id' => 10, 'explanation' => 'مادة محورية في المسار.', 'strategic_impact' => 'تفتح مواد لاحقة.'],
                ['course_id' => 999, 'explanation' => 'مادة مخترعة.', 'strategic_impact' => 'يجب رفضها.'],
            ],
        ], JSON_UNESCAPED_UNICODE));
        $gemini->shouldReceive('parseJsonResponse')->once()->andReturnUsing(
            fn (string $raw) => json_decode($raw, true)
        );

        $path = [
            'status' => 'ready',
            'goal' => ['label' => 'موازنة المعدل وسرعة التخرج'],
            'summary' => ['message' => 'خطة آمنة'],
            'current_semester' => ['courses' => [[
                'id' => 10, 'name' => 'هياكل البيانات', 'code' => 'CS210',
                'credit_hours' => 3, 'difficulty_level' => 4, 'priority' => 'high',
                'reasons' => ['مادة أساسية'],
                'unlocks' => ['direct_count' => 2, 'total_path_count' => 4],
            ]]],
            'roadmap' => [],
        ];

        $result = (new AcademicPathAiAnalysisService($gemini))->analyze(new User(['id' => 7]), $path);

        $this->assertTrue($result['ai']['used']);
        $this->assertSame('completed', $result['ai']['status']);
        $this->assertSame('مادة محورية في المسار.', $result['current_semester']['courses'][0]['ai_explanation']);
        $this->assertCount(1, $result['current_semester']['courses']);
    }
}
