<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class GuestDemoController extends Controller
{
    /**
     * Create a temporary guest account with realistic academic data
     * and log the visitor in automatically.
     *
     * This endpoint is designed for the NTP competition at Amman Al-Ahliyyah
     * University so that judges and visitors can experience the full Sanfoor
     * platform without a Microsoft / Zarqa University email.
     */
    public function enter(Request $request)
    {
        // Kill-switch: disable guest access via environment variable.
        if (! config('app.guest_demo_enabled', false)) {
            return redirect()->route('home')->with([
                'message' => 'الوضع التجريبي غير متاح حالياً.',
                'type'    => 'error',
            ]);
        }

        // If the user is already logged in as a guest, just redirect.
        if (Auth::check() && Auth::user()->role === 'guest') {
            return redirect()->route('dashboard');
        }

        // If the user is logged in with a real account, don't overwrite.
        if (Auth::check()) {
            return redirect()->route('dashboard');
        }

        try {
            return DB::transaction(function () use ($request) {
                // Pick the best major to showcase.
                $major = Major::first();
                $majorId = $major?->id;

                // Generate a unique guest identity.
                $guestNumber = mt_rand(1000, 9999);
                $uniqueSlug = Str::lower(Str::random(8));
                $email = "guest-{$uniqueSlug}@demo.sanfoor.me";

                $user = User::create([
                    'name'               => "ضيف NTP #{$guestNumber}",
                    'email'              => $email,
                    'password'           => Hash::make(Str::random(64)),
                    'major_id'           => $majorId,
                    'study_plan_version' => 12,
                    'ip_address'         => $request->ip(),
                    'last_login_at'      => now(),
                ]);

                // Set the role directly to avoid mass-assignment protection.
                $user->role = 'guest';
                $user->email_verified_at = now();
                $user->save();

                // Seed realistic passed courses so the dashboard is not empty.
                $this->seedDemoCourses($user, $majorId);

                // Log into the guest account.
                Auth::guard('web')->login($user, false);
                $request->session()->regenerate();

                // Mark in session for easy frontend detection.
                $request->session()->put('is_guest_demo', true);
                $request->session()->put('guest_demo_started_at', now()->toISOString());

                // Admin log for tracking.
                try {
                    AdminLog::create([
                        'user_id'    => $user->id,
                        'action'     => 'GUEST_DEMO_LOGIN',
                        'details'    => sprintf(
                            'Guest demo session started: %s | ip: %s | ua: %s',
                            $email,
                            $request->ip(),
                            Str::limit($request->header('User-Agent'), 100)
                        ),
                        'ip_address' => $request->ip(),
                    ]);
                } catch (Throwable $logError) {
                    Log::warning('Failed to log guest demo login', [
                        'error' => $logError->getMessage(),
                    ]);
                }

                return redirect()->route('dashboard');
            });
        } catch (Throwable $e) {
            Log::error('Guest demo creation failed', [
                'message' => $e->getMessage(),
                'trace'   => $e->getTraceAsString(),
            ]);

            return redirect()->route('home')->with([
                'message' => 'تعذر إنشاء الحساب التجريبي. حاول مرة أخرى.',
                'type'    => 'error',
            ]);
        }
    }

    /**
     * Seed a realistic set of passed courses for the demo user.
     *
     * We pick courses from semesters 1-4 (first two years) and assign
     * realistic grades that create an interesting dashboard experience.
     */
    private function seedDemoCourses(User $user, ?int $majorId): void
    {
        // Get courses from the first few semesters.
        $courses = Course::query()
            ->where('study_plan_version', 12)
            ->where(function ($q) use ($majorId) {
                $q->where('major_id', $majorId)
                  ->orWhereNull('major_id');
            })
            ->whereIn('semester', [1, 2, 3, 4])
            ->orderBy('semester')
            ->take(14)
            ->get();

        if ($courses->isEmpty()) {
            return;
        }

        // Realistic grade distribution – some excellent, some good, some average.
        $gradePatterns = [92, 88, 78, 85, 71, 94, 66, 82, 90, 73, 87, 68, 91, 76];

        $attachData = [];
        foreach ($courses as $index => $course) {
            $semester = (int) $course->semester;
            $year = (int) ceil($semester / 2);
            $term = $semester % 2 === 0 ? 2 : 1;

            $attachData[$course->id] = [
                'grade'           => $gradePatterns[$index % count($gradePatterns)],
                'studied_semester' => $semester,
                'studied_year'    => $year,
                'studied_term'    => $term,
                'is_retake'       => false,
                'attempt_number'  => 1,
                'created_at'      => now(),
                'updated_at'      => now(),
            ];
        }

        $user->passedCourses()->attach($attachData);
    }
}
