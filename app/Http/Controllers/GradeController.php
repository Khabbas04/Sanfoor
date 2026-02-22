<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class GradeController extends Controller
{
    // عرض صفحة الحاسبة
    public function index()
    {
        $user = Auth::user();
        
        // جلب المواد التي اجتازها الطالب مع علاماتها والفصل المخصص (إن وجد)
        $passedCourses = $user->passedCourses()
            ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
            ->withPivot('grade', 'studied_semester') // 🔥 إضافة studied_semester هنا
            ->get();

        return Inertia::render('Calculator/Index', [
            'initialCourses' => $passedCourses
        ]);
    }

    // حفظ العلامات والفصل الدراسي، وحساب المعدل
    public function update(Request $request)
    {
        $user = Auth::user();
        
        // نستقبل البيانات بالاسم الجديد من الـ React
        $coursesData = $request->coursesData; 

        foreach ($coursesData as $courseId => $data) {
            
            // تنظيف العلامة: تحويل النص الفارغ إلى null لتجنب أخطاء الداتا بيز
            $cleanGrade = ($data['grade'] === '' || $data['grade'] === null) ? null : (float) $data['grade'];
            
            // قراءة الفصل المرسل (أو وضع 1 كافتراضي)
            $semester = $data['semester'] ?? 1;

            // تحديث الحقول في جدول course_user (الجدول الوسيط)
            $user->passedCourses()->updateExistingPivot($courseId, [
                'grade' => $cleanGrade,
                'studied_semester' => $semester, // 🔥 حفظ الفصل الذي اختاره الطالب
                'updated_at' => now()
            ]);
        }

        // حساب المعدل الجديد فوراً بعد الحفظ لإرجاعه للواجهة (SweetAlert)
        $newGpa = $user->calculateGPA();

        return response()->json([
            'status' => 'success',
            'new_percentage' => $newGpa['percentage'] // إرجاع المعدل المئوي الجديد
        ]);
    }
}