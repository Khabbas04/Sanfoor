<?php

namespace Tests\Feature\Ai;

use App\Engines\AiContextAssembler;
use App\Engines\CourseRankingEngine;
use Tests\TestCase;

class AdvisorPreferencesTest extends TestCase
{
    public function test_ranking_engine_prioritizes_filtered_course_types(): void
    {
        $engine = new CourseRankingEngine();
        $courses = [
            [
                'id' => 1,
                'name' => 'برمجة مرئية',
                'type' => 'compulsory',
                'difficulty_level' => 3,
                'unlocks' => 1,
                'credit_hours' => 3,
            ],
            [
                'id' => 2,
                'name' => 'أمن معلومات واختراق',
                'type' => 'elective',
                'difficulty_level' => 3,
                'unlocks' => 1,
                'credit_hours' => 3,
            ],
        ];

        $rules = [
            'student_year' => 2,
            'student_semester' => 3,
        ];

        // Filter for elective only
        $ranked = $engine->rank($courses, $rules, 'عام', 5, [
            'filters' => ['elective'],
        ]);

        $this->assertEquals(2, $ranked[0]['id'], 'Elective course should be ranked first when elective filter is chosen');
    }

    public function test_ranking_engine_critical_path_boosts_unlocks(): void
    {
        $engine = new CourseRankingEngine();
        $courses = [
            [
                'id' => 10,
                'name' => 'مادة لا تفتح شيئاً',
                'type' => 'compulsory',
                'difficulty_level' => 3,
                'unlocks' => 0,
                'credit_hours' => 3,
                'course_semester' => 3,
            ],
            [
                'id' => 20,
                'name' => 'مادة تفتح 4 مواد',
                'type' => 'compulsory',
                'difficulty_level' => 3,
                'unlocks' => 4,
                'credit_hours' => 3,
                'course_semester' => 3,
            ],
        ];

        $rules = [
            'student_year' => 2,
            'student_semester' => 3,
        ];

        $ranked = $engine->rank($courses, $rules, 'عام', 5, [
            'critical_path' => true,
        ]);

        $this->assertEquals(20, $ranked[0]['id'], 'Course with high unlocks should rank first under critical path preference');
    }

    public function test_ranking_engine_difficulty_preference_easy(): void
    {
        $engine = new CourseRankingEngine();
        $courses = [
            [
                'id' => 100,
                'name' => 'مادة صعبة جداً',
                'type' => 'compulsory',
                'difficulty_level' => 5,
                'unlocks' => 1,
                'credit_hours' => 3,
            ],
            [
                'id' => 200,
                'name' => 'مادة سهلة',
                'type' => 'compulsory',
                'difficulty_level' => 1,
                'unlocks' => 1,
                'credit_hours' => 3,
            ],
        ];

        $rules = [
            'student_year' => 2,
            'student_semester' => 3,
        ];

        $ranked = $engine->rank($courses, $rules, 'عام', 5, [
            'difficulty' => 'easy',
        ]);

        $this->assertEquals(200, $ranked[0]['id'], 'Easy course should rank first when easy difficulty preference is selected');
    }

    public function test_assembler_includes_preferences_block(): void
    {
        $assembler = new AiContextAssembler();

        $rules = [
            'student_year_label' => 'السنة الأولى',
            'progress_percent' => 10,
            'total_passed_hours' => 0,
            'is_probation' => false,
            'is_graduating' => false,
            'is_summer' => false,
            'effective_limit' => 18,
            'term_sequence_note' => 'طبيعي',
            'cart_hours' => 0,
            'cart_exceeds_limit' => false,
        ];

        $preferences = [
            'filters' => ['compulsory', 'elective'],
            'critical_path' => true,
            'wants_code' => true,
            'difficulty' => 'easy',
        ];

        $result = $assembler->build($rules, [], [], [], [], '', [], $preferences);

        $promptText = $result['parts'][0]['text'] ?? '';

        $this->assertStringContainsString('التفضيلات والإعدادات الذكية المحددة من الطالب', $promptText);
        $this->assertStringContainsString('المسار الحرج', $promptText);
        $this->assertStringContainsString('وضع الأكواد البرمجية مُفعل', $promptText);
        $this->assertStringContainsString('مستوى الصعوبة (سهل / رفع المعدل)', $promptText);
        $this->assertStringContainsString('إجباري', $promptText);
    }
}
