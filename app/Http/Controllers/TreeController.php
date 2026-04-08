<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Support\CourseEligibility;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB; 

class TreeController extends Controller
{
    /**
     * عرض صفحة الخطة الشجرية للطالب
     */
    public function index()
    {
        // 1. جلب بيانات الطالب الحالي مع علاقات التخصص والكلية
        $user = Auth::user()->load('major.college');

        // 2. إجبار النظام على أخذ تخصص الطالب حصراً لمنع تداخل البيانات
        $selectedMajorId = $user->major_id;
        $selectedPlanVersion = (int) ($user->study_plan_version ?? 12);

        $courseStatsSubquery = DB::table('course_user')
            ->selectRaw('course_id')
            ->selectRaw('AVG(grade) as avg_grade')
            ->selectRaw('COUNT(*) as graded_attempts')
            ->selectRaw('SUM(CASE WHEN grade < 60 THEN 1 ELSE 0 END) as failed_attempts')
            ->whereNotNull('grade')
            ->groupBy('course_id');

        // 3. بناء الاستعلام مع المتطلبات ومؤشرات الصعوبة
        $query = Course::query()
            ->leftJoinSub($courseStatsSubquery, 'course_stats', function ($join) {
                $join->on('courses.id', '=', 'course_stats.course_id');
            })
            ->select([
                'courses.id',
                'courses.name',
                'courses.code',
                'courses.credit_hours',
                'courses.minimum_passed_hours',
                'courses.type',
                'courses.semester',
                'courses.major_id',
                'courses.study_plan_version',
                'courses.description',
            ])
            ->selectRaw('COALESCE(course_stats.avg_grade, 72) as avg_grade')
            ->selectRaw('COALESCE(course_stats.graded_attempts, 0) as graded_attempts')
            ->selectRaw('COALESCE(course_stats.failed_attempts, 0) as failed_attempts')
            ->selectRaw('CASE WHEN COALESCE(course_stats.graded_attempts, 0) > 0 THEN (course_stats.failed_attempts / course_stats.graded_attempts) * 100 ELSE 18 END as fail_rate')
            ->withCount('prerequisites')
            ->with(['prerequisites']);

        // 4. الفلترة الصارمة حسب التخصص
        if ($selectedMajorId) {
            $query->where(function ($q) use ($selectedMajorId, $selectedPlanVersion) {
                // جلب مواد تخصص الطالب فقط
                $q->where(function ($majorScope) use ($selectedMajorId, $selectedPlanVersion) {
                    $majorScope->where('major_id', $selectedMajorId)
                        ->where('study_plan_version', $selectedPlanVersion);
                })
                // أو متطلبات الجامعة (التي لا تتبع لتخصص محدد)
                ->orWhere(function ($universityScope) use ($selectedPlanVersion) {
                    $universityScope->whereNull('major_id')
                        ->where('study_plan_version', $selectedPlanVersion);
                });
            });
        }
        else {
            // في حال كان الطالب غير مربوط بتخصص، نعرض متطلبات الجامعة فقط
            $query->whereNull('major_id')
                ->where('study_plan_version', $selectedPlanVersion);
        }

        $courses = $query->get();

        $totalPassedHours = (int) $user->passedCourses()->sum('courses.credit_hours');
        $courses->transform(function (Course $course) {
            $course->minimum_passed_hours = CourseEligibility::minimumPassedHoursForCourse($course);

            return $course;
        });

        // 5. جلب معرفات المواد التي أنجزها الطالب الحالي (لتلوين الشجرة)
        $passed_course_ids = DB::table('course_user')
            ->where('user_id', $user->id)
            ->pluck('course_id')
            ->toArray();

        // 6. جلب المواد المنجزة بالتفصيل (مع العلامة ورقم الفصل) لتبويب السجل الأكاديمي الجديد
        $passedCourses = $user->passedCourses()
            ->select('courses.id', 'courses.name', 'courses.credit_hours', 'courses.code', 'courses.semester')
            ->withPivot('grade', 'studied_semester')
            ->get();

        // 7. Fetch user's cart (simulator) from DB
        $cart_course_ids = [];
        if ($user->cartCourses) {
            $cart_course_ids = $user->cartCourses->pluck('id')->toArray();
        }

        return Inertia::render('Tree/Index', [
            'courses' => $courses,
            'passed_course_ids' => $passed_course_ids,
            'initial_cart_ids' => $cart_course_ids,
            'passed_courses' => $passedCourses, // إرسال البيانات المفصلة للواجهة هنا
            'total_passed_hours' => $totalPassedHours,

            // إرسال بيانات الطالب للهيدر المخصص
            'student_name' => $user->name ?? 'طالب',
            'major_name' => $user->major ? $user->major->name : 'غير محدد',
            'college_name' => ($user->major && $user->major->college) ? $user->major->college->name : 'جامعة سنفور',
            'study_plan_version' => (int) ($user->study_plan_version ?? 12),
        ]);
    }

    /**
     * دالة تبديل حالة المادة (منجز / غير منجز) بطريقة الاستعلام المباشر (Bulletproof)
     */
    public function toggle(Request $request)
    {
        try {
            // 🔥 إضافة التحقق من صحة رقم الفصل المُرسل (إن وجد)
            $request->validate([
                'course_id' => 'required|exists:courses,id',
                'studied_semester' => 'nullable|integer|min:1|max:12' 
            ]);

            $userId = Auth::id();
            $courseId = $request->course_id;

            $user = Auth::user();

            $course = Course::with('prerequisites')
                ->where('id', $courseId)
                ->where(function ($query) use ($user) {
                    $query->where(function ($majorScope) use ($user) {
                        $majorScope->where('major_id', $user->major_id)
                            ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                    })->orWhere(function ($universityScope) use ($user) {
                        $universityScope->whereNull('major_id')
                            ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                    });
                })
                ->first();

            if (!$course) {
                return response()->json([
                    'status' => 'error',
                    'msg' => 'هذه المادة ليست ضمن خطتك الحالية.',
                ], 403);
            }

            // 1. فحص التواجد مباشرة من الجدول الوسيط (أسرع وأضمن طريقة)
            $exists = DB::table('course_user')
                ->where('user_id', $userId)
                ->where('course_id', $courseId)
                ->exists();

            if ($exists) {
                // المادة موجودة -> نقوم بحذفها (إلغاء الاجتياز)
                DB::table('course_user')
                    ->where('user_id', $userId)
                    ->where('course_id', $courseId)
                    ->delete();

                return response()->json(['status' => 'removed']);
            }
            else {
                // المادة غير موجودة -> نفحص المتطلبات قبل إضافتها
                $passedHours = (int) DB::table('course_user')
                    ->join('courses', 'courses.id', '=', 'course_user.course_id')
                    ->where('course_user.user_id', $userId)
                    ->sum('courses.credit_hours');

                $minimumPassedHours = CourseEligibility::minimumPassedHoursForCourse($course);
                if ($minimumPassedHours !== null && $passedHours < $minimumPassedHours) {
                    return response()->json([
                        'status' => 'error',
                        'msg' => "هذه المادة تتطلب إنهاء {$minimumPassedHours} ساعة معتمدة. الساعات الحالية: {$passedHours}.",
                    ], 422);
                }

                // جلب مصفوفة بأرقام المواد التي اجتازها الطالب
                $passedIds = DB::table('course_user')
                    ->where('user_id', $userId)
                    ->pluck('course_id')
                    ->toArray();

                $missingPrereqs = [];
                foreach ($course->prerequisites as $prereq) {
                    if (!in_array($prereq->id, $passedIds)) {
                        $missingPrereqs[] = $prereq->name;
                    }
                }

                if (empty($missingPrereqs)) {
                    
                    // 🔥 تحديد الفصل المُراد الحفظ بناءً عليه
                    // إذا أرسل الطالب رقماً نستخدمه، وإلا نستخدم الفصل الافتراضي للمادة، وإلا نجعله 1
                    $targetSemester = $request->studied_semester ?? $course->semester ?? 1;

                    DB::table('course_user')->insert([
                        'user_id' => $userId,
                        'course_id' => $courseId,
                        'studied_semester' => $targetSemester, // حفظ الفصل المُخصص هنا
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    
                    return response()->json(['status' => 'added']);
                }
                else {
                    return response()->json([
                        'status' => 'error',
                        'msg' => 'عذراً، يجب إنهاء المتطلبات السابقة: ' . implode(' ، ', $missingPrereqs)
                    ], 422);
                }
            }
        }
        catch (\Exception $e) {
            // إرجاع تفاصيل الخطأ بدقة في حال حدوثه للفرونت إند
            return response()->json([
                'message' => 'Error: ' . $e->getMessage() . ' | Line: ' . $e->getLine()
            ], 500);
        }
    }

    /**
    * 🔥 الدالة الجديدة المخصصة لإضافة أو إزالة مادة واحدة من التسجيل التجريبي فقط 🔥
     * هذه الدالة يتم استدعاؤها من واجهة المحادثة مع الذكاء الاصطناعي (سنفور)
     */
    public function toggleSingleCart(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id'
        ]);

        $user = Auth::user();
        $courseId = $request->course_id;
        $course = Course::where('id', $courseId)
            ->where(function ($query) use ($user) {
                $query->where(function ($majorScope) use ($user) {
                    $majorScope->where('major_id', $user->major_id)
                        ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                })->orWhere(function ($universityScope) use ($user) {
                    $universityScope->whereNull('major_id')
                        ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                });
            })
            ->firstOrFail();

        $passedHours = (int) $user->passedCourses()->sum('courses.credit_hours');
        $minimumPassedHours = CourseEligibility::minimumPassedHoursForCourse($course);

        if ($minimumPassedHours !== null && $passedHours < $minimumPassedHours) {
            return response()->json([
                'status' => 'error',
                'message' => "هذه المادة تتطلب إنهاء {$minimumPassedHours} ساعة معتمدة. الساعات الحالية: {$passedHours}.",
            ], 422);
        }

        // التحقق مما إذا كانت المادة موجودة في التسجيل التجريبي مسبقاً
        if ($user->cartCourses()->where('course_id', $courseId)->exists()) {
            // إزالة المادة من التسجيل التجريبي
            $user->cartCourses()->detach($courseId);
            return response()->json(['status' => 'removed', 'message' => 'تمت إزالة المادة من التسجيل التجريبي.']);
        } else {
            // إضافة المادة إلى التسجيل التجريبي
            $user->cartCourses()->attach($courseId);
            return response()->json(['status' => 'added', 'message' => 'تمت إضافة المادة إلى التسجيل التجريبي بنجاح.']);
        }
    }
}