<?php

namespace App\Http\Controllers;

use App\Models\StudentActivityLog;
use App\Services\AcademicPathPlannerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AcademicPathPlannerController extends Controller
{
    public function generate(Request $request, AcademicPathPlannerService $planner): JsonResponse
    {
        $data = $request->validate([
            'goal' => [
                'required',
                'string',
                Rule::in(array_keys(config('academic_path_planner.goals', []))),
            ],
        ]);

        $user = $request->user();
        abort_unless($user && $user->role === 'student', 403);

        $path = $planner->generate($user, $data['goal']);

        StudentActivityLog::create([
            'user_id' => $user->id,
            'action' => 'academic_path_generated',
            'details' => [
                'goal' => $data['goal'],
                'planner_version' => $path['planner_version'],
                'status' => $path['status'],
                'current_semester_courses' => count($path['current_semester']['courses'] ?? []),
                'roadmap_semesters' => count($path['roadmap'] ?? []),
            ],
        ]);

        return response()->json(['path' => $path]);
    }
}
