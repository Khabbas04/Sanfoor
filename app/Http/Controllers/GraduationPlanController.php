<?php

namespace App\Http\Controllers;

use App\Models\GraduationPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class GraduationPlanController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        $payload = $request->validate([
            'plan' => ['required', 'array'],
            'plan.semesters' => ['required', 'array', 'min:1'],
            'plan.semesters.*.semester' => ['required', 'integer', 'min:1'],
            'plan.semesters.*.is_summer' => ['required', 'boolean'],
            'plan.semesters.*.course_ids' => ['required', 'array', 'min:1'],
            'plan.semesters.*.course_ids.*' => ['required', 'integer'],
            'plan.notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $plan = GraduationPlan::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'major_id' => $user->major_id,
                    'study_plan_version' => (int) ($user->study_plan_version ?? 12),
                    'payload' => $payload['plan'],
                    'approved_at' => now(),
                ]
            );
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            Log::error('Failed to store graduation plan', [
                'user_id' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'تعذر حفظ الخطة حالياً. حاول مرة أخرى.',
            ], 500);
        }

        return response()->json([
            'message' => 'تم حفظ الخطة بنجاح.',
            'plan' => [
                'id' => $plan->id,
                'payload' => $plan->payload,
                'approved_at' => $plan->approved_at,
            ]
        ]);
    }

    public function destroy(Request $request)
    {
        $user = $request->user();
        GraduationPlan::where('user_id', $user->id)->delete();
        
        return redirect()->back()->with('success', 'تم حذف الخطة بنجاح.');
    }
}
