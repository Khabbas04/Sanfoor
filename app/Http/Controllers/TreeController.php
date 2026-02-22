<?php

namespace App\Http\Controllers;

use App\Models\Course;
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

        // 3. بناء الاستعلام مع المتطلبات
        $query = Course::with(['prerequisites']);

        // 4. الفلترة الصارمة حسب التخصص
        if ($selectedMajorId) {
            $query->where(function ($q) use ($selectedMajorId) {
                // جلب مواد تخصص الطالب فقط
                $q->where('major_id', $selectedMajorId)
                    // أو متطلبات الجامعة (التي لا تتبع لتخصص محدد)
                    ->orWhereNull('major_id');
            });
        }
        else {
            // في حال كان الطالب غير مربوط بتخصص، نعرض متطلبات الجامعة فقط
            $query->whereNull('major_id');
        }

        $courses = $query->get();

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
        if ($user->cart) {
            $cart_course_ids = $user->cart->courses->pluck('id')->toArray();
        }

        return Inertia::render('Tree/Index', [
            'courses' => $courses,
            'passed_course_ids' => $passed_course_ids,
            'initial_cart_ids' => $cart_course_ids,
            'passed_courses' => $passedCourses, // إرسال البيانات المفصلة للواجهة هنا

            // إرسال بيانات الطالب للهيدر المخصص
            'student_name' => $user->name ?? 'طالب',
            'major_name' => $user->major ? $user->major->name : 'غير محدد',
            'college_name' => ($user->major && $user->major->college) ? $user->major->college->name : 'جامعة سنفور',
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
                $course = Course::with('prerequisites')->find($courseId);

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
}