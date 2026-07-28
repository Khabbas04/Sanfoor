<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Services\StudentDashboardInsightService;

class GradeController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        
        // جلب المواد التي اجتازها الطالب مع علاماتها والفصل المخصص (إن وجد)
        $passedCourses = $user->passedCourses()
            ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
            ->withPivot('grade', 'studied_semester', 'studied_year', 'studied_term')
            ->get();

        // جلب المواد من التسجيل التجريبي (سلة المواد)
        $cartCourses = $user->cartCourses()
            ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
            ->withPivot('academic_year', 'academic_term')
            ->get();

        // حساب السنة الدراسية الحالية للطالب بناءً على عدد الساعات المنجزة (باعتبار السنة 33 ساعة تقريباً)
        $passedHours = $passedCourses->sum('credit_hours');
        $currentStudyYear = max(1, (int) ceil(($passedHours + 1) / 33));

        // جلب الفصل الأكاديمي الحالي من النظام (1 = أول، 2 = ثاني، 3 = صيفي)
        $currentPeriod = \App\Models\AcademicPeriod::current();
        $currentSystemTerm = $currentPeriod ? (int) $currentPeriod->academic_term : 1;

        // تجهيز المواد التجريبية لتتناسب مع شكل مواد السجل
        $mappedCartCourses = $cartCourses->map(function ($course) use ($passedCourses, $currentStudyYear, $currentSystemTerm) {
            // تخطي المادة إذا كانت موجودة مسبقاً في السجل
            if ($passedCourses->contains('id', $course->id)) {
                return null;
            }
            
            $course->pivot = (object) [
                'grade' => null, // لم تدرس بعد، نترك العلامة فارغة للسيناريو
                'studied_year' => $currentStudyYear,
                'studied_term' => $currentSystemTerm,
                'studied_semester' => (($currentStudyYear - 1) * 3) + $currentSystemTerm,
            ];
            
            // إضافة خاصية لتمييزها في الواجهة
            $course->is_from_cart = true;

            return $course;
        })->filter();

        $allCourses = $passedCourses->concat($mappedCartCourses)->values();
        $gpaData = $user->calculateGPA();

        return Inertia::render('Calculator/Index', [
            'initialCourses' => $allCourses,
            'academicSummary' => [
                'gpa' => (float) ($gpaData['percentage'] ?? 0),
                'completed_hours' => (int) ($gpaData['completed_hours'] ?? $passedHours),
                'has_records' => (bool) ($gpaData['has_records'] ?? false),
            ],
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
            
            // دعم إدخال السنة/الفصل صراحة مع التوافق مع الإدخال القديم semester.
            $inputYear = isset($data['year']) ? (int) $data['year'] : null;
            $inputTerm = isset($data['term']) ? (int) $data['term'] : null;
            $inputSemester = isset($data['semester']) ? (int) $data['semester'] : null;

            if (!is_null($inputYear) && !is_null($inputTerm) && $inputYear >= 1 && $inputYear <= 6 && in_array($inputTerm, [1, 2, 3], true)) {
                $year = $inputYear;
                $term = $inputTerm;
                $semester = (($year - 1) * 3) + $term;
            } else {
                $semester = max(1, min(18, $inputSemester ?? 1));

                // Legacy decode for existing UI that only sends 1..12 regular terms.
                if ($semester <= 12) {
                    $year = (int) ceil($semester / 2);
                    $term = $semester % 2 === 0 ? 2 : 1;
                } else {
                    $year = (int) ceil($semester / 3);
                    $term = (int) ((($semester - 1) % 3) + 1);
                }
            }

            // إضافة المادة أو تحديثها في جدول course_user (الجدول الوسيط)
            $user->passedCourses()->syncWithoutDetaching([
                $courseId => [
                    'grade' => $cleanGrade,
                    'studied_semester' => $semester,
                    'studied_year' => $year,
                    'studied_term' => $term,
                    'updated_at' => now()
                ]
            ]);
        }

        StudentDashboardInsightService::forget($user->id);

        // حساب المعدل الجديد فوراً بعد الحفظ لإرجاعه للواجهة (SweetAlert)
        $newGpa = $user->calculateGPA();

        return response()->json([
            'status' => 'success',
            'new_percentage' => $newGpa['percentage'] // إرجاع المعدل المئوي الجديد
        ]);
    }
}
