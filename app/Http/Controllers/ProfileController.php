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

        $fillablePayload = [
            'name' => $validated['name'] ?? $user->name,
            'email' => $validated['email'] ?? $user->email,
        ];

        if (Schema::hasColumn('users', 'major_id') && array_key_exists('major_id', $validated)) {
            $fillablePayload['major_id'] = $validated['major_id'];
        }

        if (Schema::hasColumn('users', 'study_plan_version') && array_key_exists('study_plan_version', $validated)) {
            $fillablePayload['study_plan_version'] = $validated['study_plan_version'];
        }

        $user->fill($fillablePayload);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        try {
            $user->save();
        } catch (Throwable $exception) {
            Log::error('Profile update failed', [
                'user_id' => $user->id,
                'message' => $exception->getMessage(),
            ]);

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
