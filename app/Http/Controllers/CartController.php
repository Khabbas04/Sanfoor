<?php

namespace App\Http\Controllers;

use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Support\CourseEligibility;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

class CartController extends Controller
{
    /**
    * تحديث التسجيل التجريبي بالكامل للمستخدم.
     * تم التعديل ليدعم الاستجابة الصامتة لمنع ظهور رسالة الـ JSON البيضاء.
     */
    public function sync(Request $request)
    {
        // 1. التحقق من صحة البيانات القادمة
        $request->validate([
            'course_ids' => 'present|array', 
            'course_ids.*' => 'integer|exists:courses,id'
        ]);

        $user = Auth::user();
        $requestedIds = collect($request->course_ids ?? [])->map(fn ($id) => (int) $id)->values();

        $courses = Course::query()
            ->with('prerequisites')
            ->whereIn('id', $requestedIds)
            ->get()
            ->keyBy('id');

        $currentPeriod = AcademicPeriod::current();
        $periodYear = $currentPeriod?->academic_year;
        $periodTerm = $currentPeriod?->academic_term;

        $passedCourseIds = $user->passedCourses()->pluck('courses.id')->toArray();
        $passedHours = (int) $user->passedCourses()->sum('courses.credit_hours');
        $allowedIds = [];
        $blockedCourses = [];

        $totalPassedHoursForGraduation = (int) $user->passedCourses()->sum('courses.credit_hours');
        $remainingHoursToGraduate = max(0, 132 - $totalPassedHoursForGraduation);

        // Determine current term limits (summer vs regular)
        $currentAcademic = \App\Models\AcademicPeriod::current();
        $isSummer = $currentAcademic ? ((int) $currentAcademic->academic_term === 3) : false;
        
        $hasOneHourLab = false;
        foreach ($requestedIds as $courseId) {
            $c = $courses->get($courseId);
            if ($c && $c->credit_hours == 1) {
                $hasOneHourLab = true;
                break;
            }
        }

        if ($isSummer) {
            if ($remainingHoursToGraduate <= 12) {
                $maxTrialHours = 12;
            } else {
                $maxTrialHours = $hasOneHourLab ? 10 : 9;
            }
        } else {
            if ($remainingHoursToGraduate <= 21) {
                $maxTrialHours = 21;
            } else {
                $maxTrialHours = 18;
            }
        }

        $accHours = 0;
        foreach ($requestedIds as $courseId) {
            $course = $courses->get($courseId);
            if (!$course) {
                continue;
            }

            $missingPrereqs = [];
            foreach ($course->prerequisites as $prereq) {
                if (!in_array($prereq->id, $passedCourseIds, true)) {
                    $missingPrereqs[] = $prereq->name;
                }
            }

            if (!empty($missingPrereqs)) {
                $blockedCourses[] = [
                    'name' => $course->name,
                    'reason' => 'missing_prerequisites',
                    'missing' => implode('، ', $missingPrereqs),
                ];
                continue;
            }

            $minimumPassedHours = CourseEligibility::minimumPassedHoursForCourse($course);
            if ($minimumPassedHours !== null && $passedHours < $minimumPassedHours) {
                $blockedCourses[] = [
                    'name' => $course->name,
                    'required_hours' => $minimumPassedHours,
                ];

                continue;
            }

            // Enforce trial hours cap per current academic term
            $courseHours = (int) ($course->credit_hours ?? 0);
            if (($accHours + $courseHours) > $maxTrialHours) {
                $blockedCourses[] = [
                    'name' => $course->name,
                    'reason' => 'exceeds_max_trial_hours',
                    'allowed_remaining' => max(0, $maxTrialHours - $accHours),
                ];
                continue;
            }

            $allowedIds[] = $courseId;
            $accHours += $courseHours;
        }

        /**
         * 2. المزامنة (Sync)
         * تحديث جدول user_carts فوراً لضمان ظهور البيانات في لوحة الأدمن.
         */
        $hasPeriodColumns = true; // Columns confirmed in migrations — no need for runtime Schema check

        $syncPayload = [];
        foreach ($allowedIds as $courseId) {
            $payload = [
                'updated_at' => now(),
                'created_at' => now(),
            ];

            if ($hasPeriodColumns) {
                $payload['academic_year'] = $periodYear;
                $payload['academic_term'] = $periodTerm;
            }

            $syncPayload[$courseId] = $payload;
        }

        $changes = $user->cartCourses()->sync($syncPayload);

        if (class_exists(\App\Models\StudentActivityLog::class)) {
            foreach ($changes['attached'] as $attachedCourseId) {
                \App\Models\StudentActivityLog::create([
                    'user_id' => $user->id,
                    'course_id' => $attachedCourseId,
                    'action' => 'course_cart_added',
                ]);
            }
            foreach ($changes['detached'] as $detachedCourseId) {
                \App\Models\StudentActivityLog::create([
                    'user_id' => $user->id,
                    'course_id' => $detachedCourseId,
                    'action' => 'course_cart_removed',
                ]);
            }
        }

        if ($request->expectsJson()) {
            return response()->json([
                'status' => empty($blockedCourses) ? 'ok' : 'partial',
                'blocked_courses' => $blockedCourses,
                'synced_count' => count($allowedIds),
            ]);
        }

        /**
         * 3. الإرجاع (Return)
         * نستخدم back() بدلاً من response()->json لكي تفهم Inertia الطلب ولا تظهر النافذة البيضاء.
         */
        if (!empty($blockedCourses)) {
            return back()->with('warning', 'بعض المواد تحتاج إنهاء 90 ساعة قبل إضافتها للتسجيل التجريبي.');
        }

        return back()->with('success', 'تم تحديث التسجيل التجريبي بنجاح');
    }
}