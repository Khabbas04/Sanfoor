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
            ->where('is_quiz_only', true)
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

        return Inertia::render('Chapters/Index', [
            'courses' => $courses,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }
}
