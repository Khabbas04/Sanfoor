<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\College;
use App\Models\Major;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class CompleteProfileController extends Controller
{
    /**
     * Show the mandatory profile completion page for students who haven't
     * selected their college and major yet.
     */
    public function show(): Response|RedirectResponse
    {
        $user = Auth::user();

        // If student already has a major, redirect to dashboard.
        if ($user && !empty($user->major_id)) {
            return redirect()->route('dashboard');
        }

        $colleges = collect();
        $majors = collect();

        try {
            $colleges = College::withoutGlobalScopes()->select('id', 'name')->orderBy('name')->get();
            $majors = Major::withoutGlobalScopes()->select('id', 'college_id', 'name')->orderBy('name')->get();
        } catch (Throwable $e) {
            Log::warning('Failed loading academic lists for complete-profile', [
                'message' => $e->getMessage(),
            ]);
        }

        return Inertia::render('Auth/CompleteProfile', [
            'colleges' => $colleges,
            'majors' => $majors,
        ]);
    }

    /**
     * Process the profile completion form – save the major and study plan version.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $isGuest = $user && $user->role === 'guest';

        $rules = [
            'college_id' => 'required|exists:colleges,id',
            'major_id' => 'required|exists:majors,id',
            'study_plan_version' => 'required|integer|in:11,12',
        ];

        if ($isGuest) {
            $rules['name'] = 'required|string|max:255';
        }

        $validated = $request->validate($rules);

        // Ensure the selected major belongs to the selected college.
        $majorBelongsToCollege = Major::withoutGlobalScopes()
            ->whereKey((int) $validated['major_id'])
            ->where('college_id', (int) $validated['college_id'])
            ->exists();

        if (!$majorBelongsToCollege) {
            return redirect()->back()
                ->withErrors(['major_id' => 'التخصص المختار لا يتبع الكلية المحددة.']);
        }

        try {
            // Update user's name if they are a guest
            $updateData = [
                'major_id' => (int) $validated['major_id'],
                'study_plan_version' => (int) $validated['study_plan_version'],
            ];
            
            if ($isGuest && !empty($validated['name'])) {
                $updateData['name'] = trim($validated['name']);
            }

            $user->newQuery()->whereKey($user->id)->update($updateData);
            $user->refresh();

            // Log the profile completion event.
            try {
                $majorName = Major::withoutGlobalScopes()->where('id', $validated['major_id'])->value('name') ?? '';
                $collegeName = College::withoutGlobalScopes()->where('id', $validated['college_id'])->value('name') ?? '';

                AdminLog::create([
                    'user_id' => $user->id,
                    'action' => 'STUDENT_PROFILE_COMPLETED',
                    'details' => sprintf(
                        'Student completed profile: %s (%s) → College: %s, Major: %s, Plan: v%s',
                        $user->name,
                        $user->email,
                        $collegeName,
                        $majorName,
                        $validated['study_plan_version']
                    ),
                    'ip_address' => $request->ip(),
                ]);

                // Track Demo Guest Registration
                if ($isGuest) {
                    \App\Models\DemoGuest::create([
                        'name' => trim($validated['name']),
                        'college_id' => (int) $validated['college_id'],
                        'major_id' => (int) $validated['major_id'],
                        'study_plan_version' => (string) $validated['study_plan_version'],
                        'user_id' => $user->id,
                    ]);
                }
            } catch (Throwable $logError) {
                Log::warning('Failed to log profile completion or demo guest tracking', ['error' => $logError->getMessage()]);
            }
        } catch (Throwable $e) {
            Log::error('Profile completion update failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return redirect()->back()->with([
                'message' => 'تعذر حفظ البيانات الأكاديمية. حاول مرة أخرى.',
                'type' => 'error',
            ]);
        }

        // If this is a guest demo user, automatically seed their fake courses and AI chat
        // for the newly selected major so they can experience the platform immediately.
        if ($isGuest) {
            \App\Http\Controllers\Auth\GuestDemoController::seedDemoCourses($user, (int) $validated['major_id']);
        }

        return redirect()->route('dashboard');
    }
}
