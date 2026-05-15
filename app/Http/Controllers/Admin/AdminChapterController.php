<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Chapter;
use App\Models\Course;
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
     * Display admin chapter management page.
     */
    public function index(Request $request): Response
    {
        $courseId = $request->query('course_id');

        $chapters = Chapter::query()
            ->with('course:id,name,code')
            ->withCount('questions')
            ->when($courseId, function ($q) use ($courseId) {
                $q->where('course_id', $courseId);
            })
            ->orderBy('course_id')
            ->orderBy('order')
            ->get();

        $courses = Course::select('id', 'name', 'code')
            ->orderBy('name')
            ->get();

        return Inertia::render('Admin/Chapters/Index', [
            'chapters' => $chapters,
            'courses' => $courses,
            'filters' => ['course_id' => $courseId],
        ]);
    }

    /**
     * Store a new chapter.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'course_id' => 'required|exists:courses,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'order' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        $data['order'] = $data['order'] ?? Chapter::where('course_id', $data['course_id'])->max('order') + 1;
        $data['is_active'] = $data['is_active'] ?? true;

        $chapter = Chapter::create($data);

        $this->logAction('CREATE_CHAPTER', "تم إنشاء شابتر \"{$chapter->title}\" للمادة #{$chapter->course_id}");

        return back()->with(['message' => 'تم إضافة الشابتر بنجاح.', 'type' => 'success']);
    }

    /**
     * Update an existing chapter.
     */
    public function update(Request $request, Chapter $chapter): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'order' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        $chapter->update($data);

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
