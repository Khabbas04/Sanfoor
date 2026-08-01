<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Chapter;
use App\Models\College;
use App\Models\Course;
use App\Models\Question;
use App\Services\QuestionBulkImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminQuestionController extends Controller
{
    private function logAction(string $action, string $details): void
    {
        AdminLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'details' => $details,
            'ip_address' => request()->ip(),
        ]);
    }

    /**
     * Display admin question management page with cascading filters.
     */
    public function index(Request $request): Response
    {
        $majorId = $request->query('major_id');
        $courseId = $request->query('course_id');
        $chapterId = $request->query('chapter_id');
        $difficulty = $request->query('difficulty');
        $studyPlan = $request->query('study_plan');
        $search = $request->query('search');

        $questions = Question::query()
            ->with('course:id,name,code,college_id,major_id', 'chapter:id,title')
            ->when($courseId, fn ($q) => $q->where('course_id', $courseId))
            ->when($chapterId, fn ($q) => $q->where('chapter_id', $chapterId))
            ->when($difficulty, fn ($q) => $q->where('difficulty', $difficulty))
            ->when($search, function ($q) use ($search) {
                $q->where('question_text', 'like', "%{$search}%");
            })
            ->latest()
            ->get();

        $courses = Course::where('is_quiz_only', 1)->select('id', 'name', 'code', 'college_id')->orderBy('name')->get();
        $chapters = Chapter::whereHas('course', function ($q) {
            $q->where('is_quiz_only', 1);
        })->select('id', 'title', 'course_id')->orderBy('order')->get();
        $colleges = College::select('id', 'name')->orderBy('name')->get();

        return Inertia::render('Admin/Questions/Index', [
            'questions' => $questions,
            'courses' => $courses,
            'chapters' => $chapters,
            'colleges' => $colleges,
            'filters' => [
                'course_id' => $courseId,
                'chapter_id' => $chapterId,
                'difficulty' => $difficulty,
                'search' => $search,
            ],
            'stats' => [
                'total' => Question::count(),
                'easy' => Question::where('difficulty', 'easy')->count(),
                'medium' => Question::where('difficulty', 'medium')->count(),
                'hard' => Question::where('difficulty', 'hard')->count(),
            ],
        ]);
    }

    /**
     * Store a new question.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'course_name' => 'required|string|max:255',
            'course_code' => 'required|string|max:20',
            'college_id' => 'nullable|exists:colleges,id',
            'chapter_title' => 'nullable|string|max:255',
            'question_text' => 'required|string|max:5000',
            'option_a' => 'required|string|max:1000',
            'option_b' => 'required|string|max:1000',
            'option_c' => 'required|string|max:1000',
            'option_d' => 'required|string|max:1000',
            'correct_option' => 'required|in:a,b,c,d',
            'explanation' => 'nullable|string|max:3000',
            'difficulty' => 'required|in:easy,medium,hard',
            'is_active' => 'boolean',
        ]);

        // Find or create course non-destructively
        $course = Course::where('name', $data['course_name'])
            ->when(! empty($data['college_id']), fn ($q) => $q->where('college_id', $data['college_id']))
            ->where('is_quiz_only', 1)
            ->first();
        if (! $course) {
            $course = Course::create([
                'name' => $data['course_name'],
                'code' => $data['course_code'],
                'college_id' => $data['college_id'] ?? null,
                'is_quiz_only' => 1,
                'credit_hours' => 3,
                'type' => 'compulsory',
                'semester' => 1,
            ]);
        }

        // Find or create chapter if title provided
        $chapterId = null;
        if (! empty($data['chapter_title'])) {
            $chapter = Chapter::firstOrCreate(
                ['course_id' => $course->id, 'title' => $data['chapter_title']],
                ['is_active' => true, 'order' => 0]
            );
            $chapterId = $chapter->id;
        }

        $question = Question::create([
            'course_id' => $course->id,
            'chapter_id' => $chapterId,
            'question_text' => $data['question_text'],
            'option_a' => $data['option_a'],
            'option_b' => $data['option_b'],
            'option_c' => $data['option_c'],
            'option_d' => $data['option_d'],
            'correct_option' => $data['correct_option'],
            'explanation' => $data['explanation'],
            'difficulty' => $data['difficulty'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        $this->logAction('CREATE_QUESTION', "تم إنشاء سؤال #{$question->id} للمادة: {$course->name}");

        return back()->with(['message' => 'تم إضافة السؤال بنجاح.', 'type' => 'success']);
    }

    /**
     * Analyze a pasted document or uploaded file without writing to the database.
     */
    public function analyzeBulk(Request $request, QuestionBulkImportService $importer): JsonResponse
    {
        $data = $request->validate([
            'chapter_id' => ['required', 'integer', 'exists:chapters,id'],
            'source_text' => ['nullable', 'string', 'max:100000', 'required_without:file'],
            'file' => ['nullable', 'file', 'max:8192', 'mimes:pdf,txt,csv,json,jpg,jpeg,png,webp', 'required_without:source_text'],
        ]);

        $chapter = Chapter::query()->with('course:id,name,code,is_quiz_only')->findOrFail($data['chapter_id']);

        try {
            $preview = $importer->analyze($chapter, $request->file('file'), $data['source_text'] ?? null);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(array_merge($preview, [
            'destination' => [
                'chapter_id' => $chapter->id,
                'chapter_title' => $chapter->title,
                'course_id' => $chapter->course_id,
                'course_name' => $chapter->course?->name,
                'course_code' => $chapter->course?->code,
            ],
        ]));
    }

    /**
     * Commit an admin-reviewed preview as one atomic batch.
     */
    public function storeBulk(Request $request, QuestionBulkImportService $importer): JsonResponse
    {
        $data = $request->validate([
            'chapter_id' => ['required', 'integer', 'exists:chapters,id'],
            'questions' => ['required', 'array', 'min:1', 'max:60'],
            'questions.*.question_text' => ['required', 'string', 'max:5000'],
            'questions.*.option_a' => ['required', 'string', 'max:1000'],
            'questions.*.option_b' => ['required', 'string', 'max:1000'],
            'questions.*.option_c' => ['required', 'string', 'max:1000'],
            'questions.*.option_d' => ['required', 'string', 'max:1000'],
            'questions.*.correct_option' => ['required', 'in:a,b,c,d'],
            'questions.*.explanation' => ['nullable', 'string', 'max:3000'],
            'questions.*.difficulty' => ['required', 'in:easy,medium,hard'],
            'questions.*.is_active' => ['required', 'boolean'],
        ]);

        $chapter = Chapter::query()->with('course:id,name,code,is_quiz_only')->findOrFail($data['chapter_id']);
        $result = $importer->store($chapter, $data['questions']);

        $this->logAction(
            'BULK_IMPORT_QUESTIONS',
            "تم استيراد {$result['created']} سؤال دفعة واحدة إلى {$chapter->course?->name} / {$chapter->title}"
        );

        return response()->json([
            'message' => "تم حفظ {$result['created']} سؤال بنجاح.",
            'created' => $result['created'],
            'skipped_duplicates' => $result['skipped_duplicates'],
        ]);
    }

    /**
     * Update an existing question.
     */
    public function update(Request $request, Question $question): RedirectResponse
    {
        $data = $request->validate([
            'course_name' => 'required|string|max:255',
            'course_code' => 'required|string|max:20',
            'college_id' => 'nullable|exists:colleges,id',
            'chapter_title' => 'nullable|string|max:255',
            'question_text' => 'required|string|max:5000',
            'option_a' => 'required|string|max:1000',
            'option_b' => 'required|string|max:1000',
            'option_c' => 'required|string|max:1000',
            'option_d' => 'required|string|max:1000',
            'correct_option' => 'required|in:a,b,c,d',
            'explanation' => 'nullable|string|max:3000',
            'difficulty' => 'required|in:easy,medium,hard',
            'is_active' => 'boolean',
        ]);

        // Find or create course non-destructively
        $course = Course::where('name', $data['course_name'])
            ->when(! empty($data['college_id']), fn ($q) => $q->where('college_id', $data['college_id']))
            ->where('is_quiz_only', 1)
            ->first();
        if (! $course) {
            $course = Course::create([
                'name' => $data['course_name'],
                'code' => $data['course_code'],
                'college_id' => $data['college_id'] ?? null,
                'is_quiz_only' => 1,
                'credit_hours' => 3,
                'type' => 'compulsory',
                'semester' => 1,
            ]);
        }

        // Find or create chapter
        $chapterId = null;
        if (! empty($data['chapter_title'])) {
            $chapter = Chapter::firstOrCreate(
                ['course_id' => $course->id, 'title' => $data['chapter_title']],
                ['is_active' => true, 'order' => 0]
            );
            $chapterId = $chapter->id;
        }

        $question->update([
            'course_id' => $course->id,
            'chapter_id' => $chapterId,
            'question_text' => $data['question_text'],
            'option_a' => $data['option_a'],
            'option_b' => $data['option_b'],
            'option_c' => $data['option_c'],
            'option_d' => $data['option_d'],
            'correct_option' => $data['correct_option'],
            'explanation' => $data['explanation'],
            'difficulty' => $data['difficulty'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        $this->logAction('UPDATE_QUESTION', "تم تعديل سؤال #{$question->id}");

        return back()->with(['message' => 'تم تعديل السؤال بنجاح.', 'type' => 'success']);
    }

    /**
     * Delete a question.
     */
    public function destroy(Question $question): RedirectResponse
    {
        $id = $question->id;
        $question->delete();

        $this->logAction('DELETE_QUESTION', "تم حذف سؤال #{$id}");

        return back()->with(['message' => 'تم حذف السؤال بنجاح.', 'type' => 'success']);
    }
}
