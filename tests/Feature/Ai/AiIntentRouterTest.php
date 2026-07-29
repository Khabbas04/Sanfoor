<?php

namespace Tests\Feature\Ai;

use App\Services\AiIntentRouterService;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The intent router on its own — no database, no model call.
 */
class AiIntentRouterTest extends TestCase
{
    private AiIntentRouterService $router;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('ai.features.intent_ai_fallback', false);
        $this->router = new AiIntentRouterService();
    }

    #[DataProvider('intentExamples')]
    public function test_it_reads_the_students_intent(string $message, string $expected): void
    {
        $result = $this->router->route($message);

        $this->assertSame($expected, $result['intent'], "Misread: «{$message}»");
        $this->assertGreaterThanOrEqual(0.5, $result['confidence']);
    }

    public static function intentExamples(): array
    {
        return [
            'recommendation' => ['شو أسجل هذا الفصل؟', 'course_recommendation'],
            'recommendation (advise me)' => ['انصحني بمواد مناسبة لي', 'course_recommendation'],
            'semester planning' => ['رتب لي جدول الفصل القادم', 'semester_planning'],
            'graduation' => ['متى بتخرج وكم باقي لي؟', 'graduation_planning'],
            'prerequisites' => ['شو المتطلب السابق لهياكل البيانات؟', 'prerequisite_check'],
            'gpa analysis' => ['كم معدلي التراكمي الآن؟', 'gpa_analysis'],
            'gpa goal' => ['كيف أرفع معدلي لأوصل 80؟', 'gpa_goal'],
            'calendar' => ['متى تبدأ الامتحانات النهائية؟', 'calendar_question'],
            'instructor' => ['مين يدرّس مادة الشبكات؟', 'instructor_question'],
            'section' => ['شو أوقات المحاضرات للشعبة الثانية؟', 'section_question'],
            'campus' => ['وين مبنى دائرة القبول والتسجيل؟', 'campus_location'],
            'comparison' => ['قارن بين قواعد البيانات وهياكل البيانات', 'compare_courses'],
            'cart review' => ['راجع جدولي وقول لي شو أحذف', 'cart_review'],
            'policy' => ['كم غياب مسموح قبل الحرمان؟', 'academic_policy'],
            'greeting' => ['السلام عليكم', 'general_question'],
            'capabilities' => ['شو بتقدر تعمل؟', 'general_question'],
        ];
    }

    /** Spelling variants must not defeat the reading. */
    public function test_arabic_orthography_variants_are_folded(): void
    {
        foreach (['كيف أرفع معدلي؟', 'كيف ارفع معدلى', 'كيف أرفـع معدلي'] as $variant) {
            $this->assertSame('gpa_goal', $this->router->route($variant)['intent'], $variant);
        }
    }

    /** A long question the rules cannot read is `unknown` and asks to clarify. */
    public function test_an_unreadable_question_asks_for_clarification(): void
    {
        $result = $this->router->route('في موضوع بدي أفهمه منك بشكل عام وما بعرف كيف أشرحه لك بالضبط');

        $this->assertSame('unknown', $result['intent']);
        $this->assertTrue($result['requires_clarification']);
        $this->assertLessThan(0.5, $result['confidence']);
    }

    /** A short pleasantry is not ambiguous, it is a greeting. */
    public function test_a_short_message_is_not_treated_as_ambiguous(): void
    {
        $result = $this->router->route('شكراً');

        $this->assertSame('general_question', $result['intent']);
        $this->assertFalse($result['requires_clarification']);
    }

    public function test_it_extracts_a_gpa_target_without_confusing_it_with_hours(): void
    {
        $result = $this->router->route('أبي معدلي يوصل 85 وأسجل 15 ساعة');

        $this->assertSame('gpa_goal', $result['intent']);
        $this->assertSame(85.0, $result['entities']['gpa_target']);
        $this->assertSame(15, $result['entities']['hours']);
    }

    public function test_arabic_indic_digits_are_understood(): void
    {
        $result = $this->router->route('أقدر أوصل ٧٥؟');

        $this->assertSame(75.0, $result['entities']['gpa_target']);
    }

    public function test_a_legal_article_number_is_not_read_as_a_course(): void
    {
        $result = $this->router->route('شو تقول المادة رقم 25 عن الغياب؟');

        $this->assertSame('academic_policy', $result['intent']);
        $this->assertSame(25, $result['entities']['article_number']);
        $this->assertSame([], $result['entities']['course_ids']);
    }

    /** Course entities only ever come from the courses the caller supplied. */
    public function test_course_entities_are_resolved_from_the_supplied_courses_only(): void
    {
        $context = ['course_names' => [11 => 'هياكل البيانات', 12 => 'قواعد البيانات']];

        $result = $this->router->route('كم ساعة معتمدة لمادة هياكل البيانات؟', $context);

        $this->assertSame([11], $result['entities']['course_ids']);
        $this->assertSame(['هياكل البيانات'], $result['entities']['course_names']);

        // A course that was not supplied can never be produced.
        $foreign = $this->router->route('كم ساعة معتمدة لمادة الفيزياء النووية؟', $context);
        $this->assertSame([], $foreign['entities']['course_ids']);
    }

    /** The intents this deployment has no data for are reported honestly. */
    public function test_intents_without_grounding_data_are_flagged(): void
    {
        foreach (['calendar_question', 'instructor_question', 'section_question'] as $intent) {
            $this->assertFalse($this->router->isGrounded($intent), $intent);
        }

        foreach (['course_recommendation', 'gpa_goal', 'cart_review', 'campus_location'] as $intent) {
            $this->assertTrue($this->router->isGrounded($intent), $intent);
        }
    }

    /** The ranking engine only understands three literals; map onto them. */
    public function test_intents_map_onto_the_ranking_engines_vocabulary(): void
    {
        $this->assertSame('رفع_المعدل', $this->router->legacyRankingIntent('gpa_goal'));
        $this->assertSame('رفع_المعدل', $this->router->legacyRankingIntent('gpa_analysis'));
        $this->assertSame('تسريع_التخرج', $this->router->legacyRankingIntent('graduation_planning'));
        $this->assertSame('عام', $this->router->legacyRankingIntent('course_question'));
        $this->assertSame('عام', $this->router->legacyRankingIntent('unknown'));
    }

    public function test_every_intent_it_can_return_is_declared(): void
    {
        $messages = array_column(self::intentExamples(), 0);
        $messages[] = 'في موضوع بدي أفهمه منك بشكل عام وما بعرف كيف أشرحه لك بالضبط';

        foreach ($messages as $message) {
            $this->assertContains(
                $this->router->route($message)['intent'],
                AiIntentRouterService::INTENTS,
                $message
            );
        }
    }

    /** The result shape the response contract documents. */
    public function test_the_result_shape_is_stable(): void
    {
        $result = $this->router->route('شو أسجل؟');

        $this->assertSame(
            ['intent', 'confidence', 'entities', 'requires_clarification', 'source'],
            array_keys($result)
        );
        $this->assertIsFloat($result['confidence']);
        $this->assertIsBool($result['requires_clarification']);
        $this->assertSame(
            ['course_ids', 'course_names', 'gpa_target', 'hours', 'article_number'],
            array_keys($result['entities'])
        );
    }
}
