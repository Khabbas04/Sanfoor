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
    public function index(): Response
    {
        $user = Auth::user();
        $studyPlanVersion = (int) ($user->study_plan_version ?? 12);

        $courses = Course::query()
            ->select('id', 'name', 'code', 'credit_hours', 'type', 'semester', 'major_id')
            ->where(function ($query) use ($user, $studyPlanVersion) {
                $query->where(function ($q) use ($user, $studyPlanVersion) {
                    $q->where('major_id', $user->major_id)
                      ->where('study_plan_version', $studyPlanVersion);
                })->orWhere(function ($q) use ($studyPlanVersion) {
                    $q->whereNull('major_id')
                      ->where('study_plan_version', $studyPlanVersion);
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
                $q->where('is_active', true)->orderBy('order');
            }])
            ->orderBy('semester')
            ->orderBy('name')
            ->get();

        return Inertia::render('Chapters/Index', [
            'courses' => $courses->toArray(),
        ]);
    }
}
