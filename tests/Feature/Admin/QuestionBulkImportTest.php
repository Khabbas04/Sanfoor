<?php

namespace Tests\Feature\Admin;

use App\Models\Chapter;
use App\Models\Question;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\Feature\Ai\AdvisorTestCase;
use Tests\Support\FakeGeminiService;

class QuestionBulkImportTest extends AdvisorTestCase
{
    public function test_structured_text_is_parsed_locally_even_when_gemini_is_unavailable(): void
    {
        [$student, $major] = $this->student('question-local-parser@example.com');
        $course = $this->course($major, ['is_quiz_only' => true, 'name' => 'شبكات الحاسوب', 'code' => 'NET101']);
        $chapter = Chapter::create(['course_id' => $course->id, 'title' => 'طبقات الشبكة', 'order' => 1, 'is_active' => true]);
        $admin = $this->admin('question-local-parser-admin@example.com');
        $fake = $this->fakeGemini([FakeGeminiService::FAIL]);

        $source = <<<'TEXT'
1. ما وظيفة طبقة النقل؟
A) عرض الصور
B) نقل البيانات بين التطبيقات
C) تخزين الملفات
D) تشغيل الشاشة
الإجابة: B
الشرح: توفّر طبقة النقل اتصالاً بين تطبيقات الطرفين.

2. Which protocol resolves domain names?
A) HTTP
B) FTP
C) DNS
D) SMTP
Answer: C
Difficulty: medium
TEXT;

        $this->actingAs($admin)
            ->postJson(route('admin.questions.bulk.analyze'), [
                'chapter_id' => $chapter->id,
                'source_text' => $source,
            ])
            ->assertOk()
            ->assertJsonPath('analysis.mode', 'local')
            ->assertJsonPath('analysis.provider_required', false)
            ->assertJsonCount(2, 'questions')
            ->assertJsonPath('questions.0.correct_option', 'a')
            ->assertJsonPath('questions.0.option_a', 'نقل البيانات بين التطبيقات')
            ->assertJsonPath('questions.1.correct_option', 'c')
            ->assertJsonPath('questions.1.option_c', 'DNS');

        $this->assertCount(0, $fake->calls);
    }

    public function test_unstructured_source_returns_recoverable_format_guidance_when_ai_fails(): void
    {
        [$student, $major] = $this->student('question-local-recovery@example.com');
        $course = $this->course($major, ['is_quiz_only' => true]);
        $chapter = Chapter::create(['course_id' => $course->id, 'title' => 'مصدر غامض', 'order' => 1, 'is_active' => true]);
        $admin = $this->admin('question-local-recovery-admin@example.com');
        $this->fakeGemini([FakeGeminiService::FAIL]);

        $this->actingAs($admin)
            ->postJson(route('admin.questions.bulk.analyze'), [
                'chapter_id' => $chapter->id,
                'source_text' => 'هذه ملاحظات عامة بلا أسئلة أو إجابات محددة.',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'لم تتعرف الخوارزمية المحلية على أسئلة مكتملة، والتحليل الذكي غير متاح حالياً. استخدم لكل سؤال: النص، ثم A/B/C/D، ثم «الإجابة: B»؛ أو ارفع CSV/JSON بالأعمدة الموضحة.');
    }

    public function test_csv_with_arabic_headers_is_mapped_by_the_local_parser(): void
    {
        [$student, $major] = $this->student('question-local-csv@example.com');
        $course = $this->course($major, ['is_quiz_only' => true]);
        $chapter = Chapter::create(['course_id' => $course->id, 'title' => 'CSV', 'order' => 1, 'is_active' => true]);
        $admin = $this->admin('question-local-csv-admin@example.com');
        $fake = $this->fakeGemini([FakeGeminiService::FAIL]);
        $csv = "السؤال;الخيار أ;الخيار ب;الخيار ج;الخيار د;الإجابة الصحيحة;الشرح;الصعوبة\n"
            .'ما ناتج 3 + 3؟;5;6;7;8;ب;لأن مجموع العددين يساوي ستة.;سهل';

        $this->actingAs($admin)
            ->post(route('admin.questions.bulk.analyze'), [
                'chapter_id' => $chapter->id,
                'file' => UploadedFile::fake()->createWithContent('questions.csv', $csv),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('analysis.mode', 'local')
            ->assertJsonPath('questions.0.correct_option', 'a')
            ->assertJsonPath('questions.0.option_a', '6')
            ->assertJsonPath('questions.0.difficulty', 'easy');

        $this->assertCount(0, $fake->calls);
    }

    public function test_ai_analysis_builds_an_editable_balanced_preview_and_excludes_duplicates(): void
    {
        [$student, $major] = $this->student('question-source@example.com');
        $course = $this->course($major, ['is_quiz_only' => true, 'name' => 'أساسيات البرمجة', 'code' => 'CS101']);
        $chapter = Chapter::create(['course_id' => $course->id, 'title' => 'المتغيرات', 'order' => 1, 'is_active' => true]);
        Question::create($this->questionPayload($course->id, $chapter->id, 'ما هو المتغير؟'));
        $admin = $this->admin();

        $fake = $this->fakeGemini([json_encode([
            'questions' => [
                [
                    'source_ref' => '1',
                    'question_text' => 'كم يساوي 2 + 2؟',
                    'option_a' => '3',
                    'option_b' => '4',
                    'option_c' => '5',
                    'option_d' => '6',
                    'correct_option' => 'b',
                    'explanation' => 'ناتج الجمع أربعة.',
                    'difficulty' => 'easy',
                    'confidence' => 0.98,
                ],
                [
                    'source_ref' => '2',
                    'question_text' => 'أي نوع بيانات يخزن الأعداد الصحيحة؟',
                    'option_a' => 'Integer',
                    'option_b' => 'String',
                    'option_c' => 'Boolean',
                    'option_d' => 'Array',
                    'correct_option' => 'a',
                    'explanation' => '',
                    'difficulty' => 'medium',
                    'confidence' => 0.61,
                ],
                [
                    'source_ref' => '3',
                    'question_text' => 'ما هو المتغير؟',
                    'option_a' => 'مساحة تخزين',
                    'option_b' => 'طابعة',
                    'option_c' => 'شبكة',
                    'option_d' => 'صورة',
                    'correct_option' => 'a',
                    'explanation' => '',
                    'difficulty' => 'easy',
                    'confidence' => 0.9,
                ],
            ],
            'warnings' => ['تم تحويل السؤال الثاني من سؤال وجواب.'],
        ], JSON_UNESCAPED_UNICODE)]);

        $this->actingAs($admin)
            ->postJson(route('admin.questions.bulk.analyze'), [
                'chapter_id' => $chapter->id,
                'source_text' => 'أسئلة اختبار مع الإجابات',
            ])
            ->assertOk()
            ->assertJsonCount(2, 'questions')
            ->assertJsonPath('destination.chapter_id', $chapter->id)
            ->assertJsonPath('questions.0.correct_option', 'a')
            ->assertJsonPath('questions.0.option_a', '4')
            ->assertJsonPath('questions.0.option_b', '3')
            ->assertJsonPath('questions.1.correct_option', 'c')
            ->assertJsonPath('questions.1.option_c', 'Integer')
            ->assertJsonPath('questions.1.needs_review', true)
            ->assertJsonPath('summary.duplicates', 1)
            ->assertJsonPath('summary.total', 2);

        $this->assertCount(1, $fake->calls);
        $this->assertSame('question_bulk_import', $fake->calls[0]['options']['request_type']);
        $this->assertStringContainsString('المتغيرات', $fake->calls[0]['contents'][0]['parts'][0]['text']);
    }

    public function test_reviewed_questions_are_saved_atomically_to_the_selected_chapter_and_audited(): void
    {
        [$student, $major] = $this->student('question-save@example.com');
        $course = $this->course($major, ['is_quiz_only' => true]);
        $chapter = Chapter::create(['course_id' => $course->id, 'title' => 'الحلقات', 'order' => 2, 'is_active' => true]);
        $admin = $this->admin('bulk-question-save-admin@example.com');
        Question::create($this->questionPayload($course->id, $chapter->id, 'سؤال موجود مسبقاً؟'));

        $response = $this->actingAs($admin)
            ->postJson(route('admin.questions.bulk.store'), [
                'chapter_id' => $chapter->id,
                'questions' => [
                    $this->reviewedQuestion('سؤال موجود مسبقاً؟'),
                    $this->reviewedQuestion('ما وظيفة حلقة for؟', difficulty: 'medium', active: false),
                ],
            ]);

        $response->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('skipped_duplicates', 1);

        $this->assertDatabaseHas('questions', [
            'course_id' => $course->id,
            'chapter_id' => $chapter->id,
            'question_text' => 'ما وظيفة حلقة for؟',
            'difficulty' => 'medium',
            'is_active' => false,
        ]);
        $this->assertDatabaseHas('admin_logs', [
            'user_id' => $admin->id,
            'action' => 'BULK_IMPORT_QUESTIONS',
        ]);
    }

    public function test_bulk_import_requires_a_complete_question_and_a_quiz_chapter(): void
    {
        [$student, $major] = $this->student('question-validation@example.com');
        $regularCourse = $this->course($major, ['is_quiz_only' => false]);
        $chapter = Chapter::create(['course_id' => $regularCourse->id, 'title' => 'شابتر عادي', 'order' => 1, 'is_active' => true]);
        $admin = $this->admin('bulk-question-validation-admin@example.com');

        $this->actingAs($admin)
            ->postJson(route('admin.questions.bulk.store'), [
                'chapter_id' => $chapter->id,
                'questions' => [['question_text' => 'سؤال ناقص']],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['questions.0.option_a', 'questions.0.correct_option']);

        $this->actingAs($admin)
            ->postJson(route('admin.questions.bulk.store'), [
                'chapter_id' => $chapter->id,
                'questions' => [$this->reviewedQuestion('سؤال كامل؟')],
            ])
            ->assertUnprocessable();

        $this->assertDatabaseCount('questions', 0);
    }

    private function questionPayload(int $courseId, int $chapterId, string $text): array
    {
        return [
            'course_id' => $courseId,
            'chapter_id' => $chapterId,
            'question_text' => $text,
            'option_a' => 'أ',
            'option_b' => 'ب',
            'option_c' => 'ج',
            'option_d' => 'د',
            'correct_option' => 'a',
            'difficulty' => 'easy',
            'is_active' => true,
        ];
    }

    private function reviewedQuestion(string $text, string $difficulty = 'easy', bool $active = true): array
    {
        return [
            'question_text' => $text,
            'option_a' => 'الخيار الصحيح',
            'option_b' => 'خيار ثانٍ',
            'option_c' => 'خيار ثالث',
            'option_d' => 'خيار رابع',
            'correct_option' => 'a',
            'explanation' => 'شرح الإجابة.',
            'difficulty' => $difficulty,
            'is_active' => $active,
        ];
    }

    private function admin(string $email = 'bulk-question-admin@example.com'): User
    {
        return User::forceCreate([
            'name' => 'مدير بنك الأسئلة',
            'email' => $email,
            'password' => Hash::make('password'),
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);
    }
}
