<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Chapter;
use App\Models\Course;
use App\Models\Question;
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
     * Display admin question management page.
     */
    public function index(Request $request): Response
    {
        $courseId = $request->query('course_id');
        $chapterId = $request->query('chapter_id');
        $difficulty = $request->query('difficulty');

        $questions = Question::query()
            ->with('course:id,name,code', 'chapter:id,title')
            ->when($courseId, fn($q) => $q->where('course_id', $courseId))
            ->when($chapterId, fn($q) => $q->where('chapter_id', $chapterId))
            ->when($difficulty, fn($q) => $q->where('difficulty', $difficulty))
            ->latest()
            ->get();

        $courses = Course::select('id', 'name', 'code')
            ->orderBy('name')
            ->get();

        $chapters = Chapter::select('id', 'title', 'course_id')
            ->when($courseId, fn($q) => $q->where('course_id', $courseId))
            ->orderBy('order')
            ->get();

        return Inertia::render('Admin/Questions/Index', [
            'questions' => $questions,
            'courses' => $courses,
            'chapters' => $chapters,
            'filters' => [
                'course_id' => $courseId,
                'chapter_id' => $chapterId,
                'difficulty' => $difficulty,
            ],
        ]);
    }

    /**
     * Store a new question.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'chapter_id' => 'nullable|exists:chapters,id',
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

        $data['is_active'] = $data['is_active'] ?? true;

        $question = Question::create($data);

        $this->logAction('CREATE_QUESTION', "تم إنشاء سؤال #{$question->id} للمادة #{$data['course_id']}");

        return back()->with(['message' => 'تم إضافة السؤال بنجاح.', 'type' => 'success']);
    }

    /**
     * Update an existing question.
     */
    public function update(Request $request, Question $question): RedirectResponse
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'chapter_id' => 'nullable|exists:chapters,id',
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

        $question->update($data);

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
