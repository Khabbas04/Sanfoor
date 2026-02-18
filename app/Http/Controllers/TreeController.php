<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Major;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TreeController extends Controller
{
    public function index(Request $request)
    {
        // 1. استقبال التخصص المختار
        $selectedMajorId = $request->input('major_id');

        // 2. بناء الاستعلام (مع التركيز على المتطلبات للرسم الشجري)
        $query = Course::with(['prerequisites']);

        // 3. الفلترة حسب التخصص (مواد التخصص + المواد المشتركة)
        if ($selectedMajorId) {
            $query->where(function($q) use ($selectedMajorId) {
                $q->where('major_id', $selectedMajorId)
                  ->orWhereNull('major_id');
            });
        }

        $courses = $query->get();

        // 4. جلب معرفات المواد التي أنجزها الطالب الحالي (Academic History)
        // نفترض وجود علاقة passedCourses في مودل User
        $passed_course_ids = Auth::user()->passedCourses()->pluck('courses.id')->toArray();

        // 5. جلب قائمة التخصصات للاختيار
        $majors = Major::all();

        return Inertia::render('Tree/Index', [
            'courses' => $courses,
            'majors' => $majors,
            'selectedMajorId' => $selectedMajorId,
            'passed_course_ids' => $passed_course_ids // إرسال حالة الإنجاز للفرونت إند
        ]);
    }

    /**
     * 🔥 دالة تبديل حالة المادة (منجز / غير منجز) مع فحص المتطلبات
     * محاكاة لمنطق الملف القديم can_pass
     */
    public function toggleCourse(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id'
        ]);

        $user = Auth::user();
        $courseId = $request->course_id;

        // فحص هل المادة مسجلة مسبقاً؟
        $isPassed = $user->passedCourses()->where('course_id', $courseId)->exists();

        if ($isPassed) {
            // إلغاء الإنجاز (حذف من السجل)
            $user->passedCourses()->detach($courseId);
            return response()->json(['status' => 'removed']);
        } else {
            // محاولة التسجيل -> فحص المتطلبات (Logic من ملفك القديم)
            $course = Course::with('prerequisites')->find($courseId);
            $userPassedIds = $user->passedCourses()->pluck('courses.id')->toArray();

            $missingPrereqs = [];
            foreach ($course->prerequisites as $prereq) {
                if (!in_array($prereq->id, $userPassedIds)) {
                    $missingPrereqs[] = $prereq->name;
                }
            }

            if (empty($missingPrereqs)) {
                // المتطلبات مكتملة -> سجل المادة
                $user->passedCourses()->attach($courseId);
                return response()->json(['status' => 'added']);
            } else {
                // المتطلبات ناقصة -> أرسل خطأ (مثل Swal.fire القديم)
                return response()->json([
                    'status' => 'error',
                    'msg' => 'عذراً، يجب إنهاء المتطلبات السابقة: ' . implode(', ', $missingPrereqs)
                ], 422);
            }
        }
    }
}