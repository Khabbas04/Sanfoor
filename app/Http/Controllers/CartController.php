<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Support\CourseEligibility;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
            'course_ids.*' => 'integer|exists:courses,id',
            'target_year' => 'nullable|integer|min:1|max:6',
            'target_term' => 'nullable|integer|min:1|max:3',
            'is_summer' => 'nullable|boolean',
        ]);

        $user = Auth::user();
        $requestedIds = collect($request->course_ids ?? [])->map(fn ($id) => (int) $id)->values();

        $courses = Course::query()
            ->whereIn('id', $requestedIds)
            ->get()
            ->keyBy('id');

        $passedHours = (int) $user->passedCourses()->sum('courses.credit_hours');
        $allowedIds = [];
        $blockedCourses = [];

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

            $allowedIds[] = $courseId;
        }

        /**
         * 2. المزامنة (Sync)
         * تحديث جدول user_carts فوراً لضمان ظهور البيانات في لوحة الأدمن.
         */
        // Attach optional target term metadata to each synced record so admin
        // and analytics can filter by the intended academic term.
        $year = $request->input('target_year');
        $term = $request->input('target_term');
        $isSummer = filter_var($request->input('is_summer'), FILTER_VALIDATE_BOOLEAN);

        $syncPayload = [];
        foreach ($allowedIds as $id) {
            $syncPayload[$id] = [];
            if ($year !== null) $syncPayload[$id]['target_year'] = (int) $year;
            if ($term !== null) $syncPayload[$id]['target_term'] = (int) $term;
            $syncPayload[$id]['is_summer'] = $isSummer ? 1 : 0;
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