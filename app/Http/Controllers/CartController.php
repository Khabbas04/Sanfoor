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
            ->whereIn('id', $requestedIds)
            ->get()
            ->keyBy('id');

        $currentPeriod = AcademicPeriod::current();
        $periodYear = $currentPeriod?->academic_year;
        $periodTerm = $currentPeriod?->academic_term;

        $passedHours = (int) $user->passedCourses()->sum('courses.credit_hours');
        $allowedIds = [];
        $blockedCourses = [];

        // Determine current term limits (summer vs regular)
        $currentAcademic = \App\Models\AcademicPeriod::current();
        $isSummer = $currentAcademic ? ((int) $currentAcademic->academic_term === 3) : false;
        $maxTrialHours = $isSummer ? 9 : 18;

        $accHours = 0;
        foreach ($requestedIds as $courseId) {
            $course = $courses->get($courseId);
            if (!$course) {
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
        $hasPeriodColumns = Schema::hasColumn('user_carts', 'academic_year') && Schema::hasColumn('user_carts', 'academic_term');

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

        $user->cartCourses()->sync($syncPayload);

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