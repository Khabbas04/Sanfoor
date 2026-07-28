<?php

namespace App\Http\Controllers;

use App\Models\AcademicInsightState;
use App\Models\StudentActivityLog;
use App\Services\StudentDashboardInsightService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AcademicInsightController extends Controller
{
    public function refresh(Request $request, StudentDashboardInsightService $service): JsonResponse
    {
        return response()->json(['insight' => $service->for($request->user(), true)]);
    }

    public function track(Request $request, StudentDashboardInsightService $service): JsonResponse
    {
        $data = $request->validate([
            'fingerprint' => ['required', 'string', 'size:64'],
            'type' => ['required', 'string', 'max:40'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'critical'])],
            'event' => ['required', Rule::in(['insight_viewed', 'insight_details_opened', 'insight_action_clicked'])],
            'version' => ['required', 'string', 'max:30'],
        ]);

        $this->assertCurrentInsight($request, $service, $data);

        $column = match ($data['event']) {
            'insight_viewed' => 'viewed_at',
            'insight_details_opened' => 'details_opened_at',
            'insight_action_clicked' => 'action_clicked_at',
        };

        $state = AcademicInsightState::firstOrNew([
            'user_id' => $request->user()->id,
            'fingerprint' => $data['fingerprint'],
        ]);
        $state->fill([
            'insight_type' => $data['type'],
            'priority' => $data['priority'],
            'recommendation_version' => $data['version'],
        ]);
        $isNewEvent = !$state->{$column};
        if (!$state->{$column}) {
            $state->{$column} = now();
        }
        $state->save();

        if ($isNewEvent) {
            StudentActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => $data['event'],
                'details' => [
                    'insight_type' => $data['type'],
                    'priority' => $data['priority'],
                    'recommendation_version' => $data['version'],
                ],
            ]);
        }

        return response()->json(['status' => 'ok']);
    }

    public function dismiss(Request $request, StudentDashboardInsightService $service): JsonResponse
    {
        $data = $request->validate([
            'fingerprint' => ['required', 'string', 'size:64'],
            'type' => ['required', 'string', 'max:40'],
            'priority' => ['required', Rule::in(['low', 'medium', 'high', 'critical'])],
            'version' => ['required', 'string', 'max:30'],
        ]);

        $this->assertCurrentInsight($request, $service, $data);

        AcademicInsightState::updateOrCreate(
            ['user_id' => $request->user()->id, 'fingerprint' => $data['fingerprint']],
            [
                'insight_type' => $data['type'],
                'priority' => $data['priority'],
                'recommendation_version' => $data['version'],
                'dismissed_at' => now(),
                'dismissed_until' => now()->addDays((int) config('academic_insights.dismiss_days', 7)),
            ]
        );

        StudentActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'insight_dismissed',
            'details' => [
                'insight_type' => $data['type'],
                'priority' => $data['priority'],
                'recommendation_version' => $data['version'],
            ],
        ]);

        $service::forget($request->user()->id);

        return response()->json(['status' => 'dismissed']);
    }

    private function assertCurrentInsight(
        Request $request,
        StudentDashboardInsightService $service,
        array $data
    ): void {
        $current = $service->for($request->user());

        abort_if(
            !hash_equals((string) ($current['fingerprint'] ?? ''), (string) $data['fingerprint'])
            || ($current['type'] ?? null) !== $data['type']
            || ($current['priority'] ?? null) !== $data['priority']
            || ($current['version'] ?? null) !== $data['version'],
            409,
            'The academic insight has changed.'
        );
    }
}
