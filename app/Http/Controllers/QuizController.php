<?php

namespace App\Http\Controllers;

use App\Models\College;
use App\Models\Course;
use App\Models\Major;
use App\Models\Question;
use App\Models\QuizAttempt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class QuizController extends Controller
{
    /**
     * Display the quiz hub page listing courses that have questions.
     */
    public function index(Request $request): Response
    {
        $user = Auth::user();
        $studyPlanVersion = (int) ($user->study_plan_version ?? 12);
        $search = $request->query('search');

        $courses = Course::query()
            ->select('id', 'name', 'code', 'credit_hours', 'type', 'semester', 'major_id', 'study_plan_version')
            ->when($search, function ($q) use ($search) {
                $q->where(function ($sq) use ($search) {
                    $sq->where('name', 'like', "%{$search}%")
                       ->orWhere('code', 'like', "%{$search}%");
                });
            })
            ->whereHas('questions', function ($q) {
                $q->where('is_active', true);
            })
            ->withCount(['questions' => function ($q) {
                $q->where('is_active', true);
            }])
            ->with(['chapters' => function ($q) {
                $q->where('is_active', true)
                  ->withCount(['questions' => function ($qq) {
                      $qq->where('is_active', true);
                  }])
                  ->orderBy('order');
            }])
            ->orderBy('semester')
            ->orderBy('name')
            ->get();

        // Get the student's recent attempts for stats.
        $recentAttempts = QuizAttempt::where('user_id', $user->id)
            ->with('course:id,name,code', 'chapter:id,title')
            ->latest()
            ->take(10)
            ->get();

        return Inertia::render('Quiz/Index', [
            'courses' => $courses,
            'recentAttempts' => $recentAttempts,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    /**
     * Start a quiz or practice session — fetch questions and send to the frontend.
     */
    public function start(Request $request): Response
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'chapter_id' => 'nullable|exists:chapters,id',
            'mode' => 'required|in:quiz,practice',
            'count' => 'nullable|integer|min:5|max:50',
        ]);

        $course = Course::find($data['course_id']);
        if (!$course) {
            return redirect()->route('quiz.index')->with(['message' => 'المادة غير موجودة.', 'type' => 'error']);
        }

        $count = $data['count'] ?? 10;

        $questionsQuery = Question::where('course_id', $data['course_id'])
            ->where('is_active', true);

        if (!empty($data['chapter_id'])) {
            $questionsQuery->where('chapter_id', $data['chapter_id']);
        }

        $questions = $questionsQuery
            ->inRandomOrder()
            ->take($count)
            ->get()
            ->map(function ($q) {
                return [
                    'id' => $q->id,
                    'question_text' => $q->question_text,
                    'option_a' => $q->option_a,
                    'option_b' => $q->option_b,
                    'option_c' => $q->option_c,
                    'option_d' => $q->option_d,
                    'difficulty' => $q->difficulty,
                    'chapter_id' => $q->chapter_id,
                    // correct_option is NOT sent to the frontend; it is checked server-side on submit.
                ];
            })->values();

        $course = Course::select('id', 'name', 'code')->findOrFail($data['course_id']);
        $chapter = null;
        if (!empty($data['chapter_id'])) {
            $chapter = \App\Models\Chapter::select('id', 'title')->find($data['chapter_id']);
        }

        return Inertia::render('Quiz/Session', [
            'questions' => $questions,
            'course' => $course,
            'chapter' => $chapter,
            'mode' => $data['mode'],
        ]);
    }

    /**
     * Submit quiz answers, calculate score, and store the attempt.
     */
    public function submit(Request $request)
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'chapter_id' => 'nullable|exists:chapters,id',
            'mode' => 'required|in:quiz,practice',
            'answers' => 'required|array',
            'answers.*' => 'required|in:a,b,c,d',
            'time_spent_seconds' => 'nullable|integer|min:0',
        ]);

        $questionIds = array_keys($data['answers']);
        $questions = Question::whereIn('id', $questionIds)->get()->keyBy('id');

        $correct = 0;
        $total = count($data['answers']);
        $results = [];

        foreach ($data['answers'] as $questionId => $chosenOption) {
            $question = $questions->get($questionId);
            if (!$question) continue;

            $isCorrect = $question->correct_option === $chosenOption;
            if ($isCorrect) $correct++;

            $results[$questionId] = [
                'chosen' => $chosenOption,
                'correct' => $question->correct_option,
                'is_correct' => $isCorrect,
                'explanation' => $question->explanation,
            ];
        }

        $scorePct = $total > 0 ? round(($correct / $total) * 100) : 0;

        $attempt = QuizAttempt::create([
            'user_id' => Auth::id(),
            'course_id' => $data['course_id'],
            'chapter_id' => $data['chapter_id'] ?? null,
            'mode' => $data['mode'],
            'total_questions' => $total,
            'correct_answers' => $correct,
            'score_percentage' => $scorePct,
            'time_spent_seconds' => $data['time_spent_seconds'] ?? null,
            'answers' => $data['answers'],
        ]);

        return Inertia::render('Quiz/Session', [
            'results' => [
                'attempt_id' => $attempt->id,
                'total' => $total,
                'correct' => $correct,
                'score_percentage' => $scorePct,
                'results' => $results,
            ],
            'questions' => $questions->values(), // Keep questions to allow review
            'course' => Course::select('id', 'name', 'code')->find($data['course_id']),
            'mode' => $data['mode'],
        ]);
    }
}
