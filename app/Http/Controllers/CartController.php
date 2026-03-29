<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Support\CourseEligibility;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CartController extends Controller
{
    /**
     * تحديث المحاكي بالكامل للمستخدم.
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
        $user->cartCourses()->sync($allowedIds);

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
            return back()->with('warning', 'بعض المواد تحتاج إنهاء 90 ساعة قبل إضافتها للمحاكي.');
        }

        return back()->with('success', 'تم تحديث المحاكي بنجاح');
    }
}