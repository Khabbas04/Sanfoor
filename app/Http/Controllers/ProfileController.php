<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Models\College;
use App\Models\Major;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class ProfileController extends Controller
{
    /**
     * Display the user's profile form.
     */
    public function edit(Request $request): Response
    {
        $colleges = collect();
        $majors = collect();

        try {
            if (Schema::hasTable('colleges')) {
                $colleges = College::query()->select('id', 'name')->orderBy('name')->get();
            }

            if (Schema::hasTable('majors')) {
                $majors = Major::query()->select('id', 'college_id', 'name')->orderBy('name')->get();
            }
        } catch (Throwable $exception) {
            Log::warning('Failed loading profile academic lists', [
                'message' => $exception->getMessage(),
            ]);
        }

        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => session('status'),
            'colleges' => $colleges,
            'majors' => $majors,
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $isStudent = strtolower((string) ($user->role ?? '')) === 'student';
        $isAcademicLockedForStudent = $isStudent && filled($user->major_id);

        $hasMajorColumn = Schema::hasColumn('users', 'major_id');
        $hasPlanColumn = Schema::hasColumn('users', 'study_plan_version');
        $hasEmailVerifiedAt = Schema::hasColumn('users', 'email_verified_at');

        $updatePayload = [
            'name' => trim((string) ($validated['name'] ?? $user->name)),
            'email' => strtolower(trim((string) ($validated['email'] ?? $user->email))),
        ];

        if ($hasMajorColumn && array_key_exists('major_id', $validated)) {
            if ($isAcademicLockedForStudent) {
                $updatePayload['major_id'] = (int) $user->major_id;
            } else {
                $updatePayload['major_id'] = filled($validated['major_id']) ? (int) $validated['major_id'] : null;
            }
        }

        if ($hasPlanColumn && array_key_exists('study_plan_version', $validated)) {
            if ($isAcademicLockedForStudent && filled($user->study_plan_version)) {
                $updatePayload['study_plan_version'] = (int) $user->study_plan_version;
            } else {
                $updatePayload['study_plan_version'] = filled($validated['study_plan_version']) ? (int) $validated['study_plan_version'] : null;
            }
        }

        if (
            $hasMajorColumn
            && Schema::hasTable('majors')
            && filled($updatePayload['major_id'] ?? null)
            && filled($validated['college_id'] ?? null)
        ) {
            $majorBelongsToCollege = Major::query()
                ->whereKey((int) $updatePayload['major_id'])
                ->where('college_id', (int) $validated['college_id'])
                ->exists();

            if (!$majorBelongsToCollege) {
                return Redirect::route('profile.edit')
                    ->withErrors(['major_id' => 'التخصص المختار لا يتبع الكلية المحددة.'])
                    ->with('status', 'تحقق من اختيار الكلية والتخصص.');
            }
        }

        $emailChanged = strtolower((string) $user->email) !== ($updatePayload['email'] ?? '');

        if ($emailChanged && $hasEmailVerifiedAt) {
            $updatePayload['email_verified_at'] = null;
        }

        try {
            $user->newQuery()->whereKey($user->id)->update($updatePayload);
        } catch (Throwable $exception) {
            Log::error('Profile update failed', [
                'user_id' => $user->id,
                'message' => $exception->getMessage(),
                'payload' => $updatePayload,
            ]);

            try {
                $basicPayload = [
                    'name' => $updatePayload['name'],
                    'email' => $updatePayload['email'],
                ];

                if (array_key_exists('email_verified_at', $updatePayload)) {
                    $basicPayload['email_verified_at'] = $updatePayload['email_verified_at'];
                }

                $user->newQuery()->whereKey($user->id)->update($basicPayload);

                return Redirect::route('profile.edit')->with('status', 'تم حفظ الاسم والبريد فقط. تعذر حفظ البيانات الأكاديمية حالياً.');
            } catch (Throwable $fallbackException) {
                Log::error('Profile update fallback failed', [
                    'user_id' => $user->id,
                    'message' => $fallbackException->getMessage(),
                ]);
            }

            return Redirect::route('profile.edit')->with('status', 'تعذر حفظ التعديلات حالياً. حاول مرة أخرى.');
        }

        return Redirect::route('profile.edit')->with('status', 'تم حفظ التعديلات بنجاح.');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
