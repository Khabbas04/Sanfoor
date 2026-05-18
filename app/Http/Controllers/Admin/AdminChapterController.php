<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\College;
use App\Models\Chapter;
use App\Models\Course;
use App\Models\Major;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminChapterController extends Controller
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
     * Display admin chapter management page with major and course filtering.
     */
    public function index(Request $request): Response
    {
        $majorId = $request->query('major_id');
        $courseId = $request->query('course_id');
        $search = $request->query('search');

        $chapters = Chapter::query()
            ->with('course:id,name,code,major_id')
            ->withCount('questions')
            ->when($courseId, fn($q) => $q->where('course_id', $courseId))
            ->when($majorId && !$courseId, function ($q) use ($majorId) {
                $q->whereHas('course', fn($cq) => $majorId === 'university'
                    ? $cq->whereNull('major_id')
                    : $cq->where('major_id', $majorId)
                );
            })
            ->when($search, function ($q) use ($search) {
                $q->where(function ($sq) use ($search) {
                    $sq->where('title', 'like', "%{$search}%")
                       ->orWhereHas('course', fn($cq) => $cq->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%"));
                });
            })
            ->orderBy('course_id')
            ->orderBy('order')
            ->get();

        $majors = Major::select('id', 'name', 'college_id')->orderBy('name')->get();
        $colleges = College::select('id', 'name')->orderBy('name')->get();
        
        $studyPlans = Course::select('study_plan_version')
            ->distinct()
            ->whereNotNull('study_plan_version')
            ->orderBy('study_plan_version', 'desc')
            ->pluck('study_plan_version');

        $courses = Course::where('is_quiz_only', 1)->select('id', 'name', 'code', 'major_id', 'study_plan_version')->orderBy('name')->get();

        return Inertia::render('Admin/Chapters/Index', [
            'chapters' => $chapters,
            'courses' => $courses,
            'majors' => $majors,
            'colleges' => $colleges,
            'studyPlans' => $studyPlans,
            'filters' => [
                'major_id' => $majorId,
                'course_id' => $courseId,
                'search' => $search,
                'college_id' => $request->query('college_id'),
                'study_plan' => $request->query('study_plan'),
            ],
            'stats' => [
                'total' => Chapter::count(),
                'active' => Chapter::where('is_active', true)->count(),
                'with_questions' => Chapter::has('questions')->count(),
            ],
        ]);
    }

    /**
     * Store a new chapter.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'course_name' => 'required|string|max:255',
            'course_code' => 'required|string|max:20',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'google_drive_link' => 'nullable|url|max:255',
            'order' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        // Find or create course non-destructively
        $course = Course::where('name', $data['course_name'])->where('is_quiz_only', 1)->first();
        if (!$course) {
            $course = Course::create([
                'name' => $data['course_name'],
                'code' => $data['course_code'],
                'is_quiz_only' => 1,
                'credit_hours' => 3,
                'type' => 'compulsory',
                'semester' => 1
            ]);
        }

        $order = $data['order'] ?? Chapter::where('course_id', $course->id)->max('order') + 1;
        $isActive = $data['is_active'] ?? true;

        $chapter = Chapter::create([
            'course_id' => $course->id,
            'title' => $data['title'],
            'description' => $data['description'],
            'google_drive_link' => $data['google_drive_link'],
            'order' => $order,
            'is_active' => $isActive,
        ]);

        $this->logAction('CREATE_CHAPTER', "تم إنشاء شابتر \"{$chapter->title}\" للمادة {$course->name}");

        return back()->with(['message' => 'تم إضافة الشابتر بنجاح.', 'type' => 'success']);
    }

    /**
     * Update an existing chapter.
     */
    public function update(Request $request, Chapter $chapter): RedirectResponse
    {
        $data = $request->validate([
            'course_name' => 'required|string|max:255',
            'course_code' => 'required|string|max:20',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'google_drive_link' => 'nullable|url|max:255',
            'order' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        // Find or create course non-destructively
        $course = Course::where('name', $data['course_name'])->where('is_quiz_only', 1)->first();
        if (!$course) {
            $course = Course::create([
                'name' => $data['course_name'],
                'code' => $data['course_code'],
                'is_quiz_only' => 1,
                'credit_hours' => 3,
                'type' => 'compulsory',
                'semester' => 1
            ]);
        }

        $chapter->update([
            'course_id' => $course->id,
            'title' => $data['title'],
            'description' => $data['description'],
            'google_drive_link' => $data['google_drive_link'],
            'order' => $data['order'] ?? $chapter->order,
            'is_active' => $data['is_active'] ?? $chapter->is_active,
        ]);

        $this->logAction('UPDATE_CHAPTER', "تم تعديل شابتر \"{$chapter->title}\" #{$chapter->id}");

        return back()->with(['message' => 'تم تعديل الشابتر بنجاح.', 'type' => 'success']);
    }

    /**
     * Delete a chapter.
     */
    public function destroy(Chapter $chapter): RedirectResponse
    {
        $title = $chapter->title;
        $id = $chapter->id;
        $chapter->delete();

        $this->logAction('DELETE_CHAPTER', "تم حذف شابتر \"{$title}\" #{$id}");

        return back()->with(['message' => 'تم حذف الشابتر بنجاح.', 'type' => 'success']);
    }
}
