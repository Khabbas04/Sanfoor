<?php

namespace App\Http\Controllers;

use App\Models\Chapter;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ChapterController extends Controller
{
    /**
     * Display the chapters browsing page for students.
     * Lists all courses that have active chapters.
     */
    public function index(Request $request): Response
    {
        $user = Auth::user();
        $studyPlanVersion = (int) ($user->study_plan_version ?? 12);
        $search = $request->query('search');

        $courses = Course::query()
            ->select('id', 'name', 'code', 'credit_hours', 'type', 'semester', 'major_id')
            ->where('is_quiz_only', 1)
            ->when($search, function ($q) use ($search) {
                $q->where(function ($sq) use ($search) {
                    $sq->where('name', 'like', "%{$search}%")
                       ->orWhere('code', 'like', "%{$search}%")
                       ->orWhereHas('chapters', fn($chq) => $chq->where('title', 'like', "%{$search}%"));
                });
            })
            ->whereHas('chapters', function ($q) {
                $q->where('is_active', true);
            })
            ->withCount(['chapters' => function ($q) {
                $q->where('is_active', true);
            }, 'questions' => function ($q) {
                $q->where('is_active', true);
            }])
            ->with(['chapters' => function ($q) {
                $q->select('id', 'course_id', 'title', 'description', 'google_drive_link', 'order', 'is_active')
                  ->where('is_active', true)
                  ->orderBy('order');
            }])
            ->orderBy('semester')
            ->orderBy('name')
            ->get();

        // Provide the user's pinned chapter ids so the UI can reflect pinned state.
        $pinnedIds = [];
        if ($user) {
            $pinnedIds = $user->pinnedChapters()->pluck('chapter_id')->toArray();
        }

        return Inertia::render('Chapters/Index', [
            'courses' => $courses,
            'filters' => [
                'search' => $search,
            ],
            'pinned_chapter_ids' => $pinnedIds,
        ]);
    }

    /**
     * Toggle pinned chapter for the authenticated user.
     */
    public function togglePin(Request $request)
    {
        $user = Auth::user();
        if (!$user) return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);

        $chapterId = (int) $request->input('chapter_id');
        $chapter = Chapter::find($chapterId);
        if (!$chapter) return response()->json(['status' => 'error', 'message' => 'Not found'], 404);

        $exists = $user->pinnedChapters()->where('chapter_id', $chapterId)->exists();
        if ($exists) {
            $user->pinnedChapters()->detach($chapterId);
            return response()->json(['status' => 'removed']);
        }

        $user->pinnedChapters()->attach($chapterId);
        return response()->json(['status' => 'added']);
    }
}
