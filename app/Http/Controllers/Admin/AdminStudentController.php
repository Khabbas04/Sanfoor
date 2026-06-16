<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\User;
use App\Models\Major;
use App\Models\College; 
use Inertia\Inertia;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AdminStudentController extends Controller
{
    private function logAction(string $action, string $details): void
    {
        AdminLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'details' => $details,
            'ip_address' => request()->ip(),
        ]);
    }

    public function index(Request $request)
    {
        // 1. استعلام الطلاب مع الفلترة الذكية
        $students = User::where('role', 'student')
            ->with(['major.college', 'passedCourses', 'cartCourses']) 
            ->when($request->search, function ($query, $search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
            })
            ->when($request->college_id, function ($query, $collegeId) {
                $query->whereHas('major', function ($q) use ($collegeId) {
                    $q->where('college_id', $collegeId);
                });
            })
            ->when($request->major_id, function ($query, $majorId) {
                $query->where('major_id', $majorId);
            })
            ->latest()
            ->paginate(15)
            ->through(function ($student) {
                
                $totalCredits = 0;
                $weightedSum = 0;

                // ✅ تصحيح: استخدام passedCourses (Camel Case) كما هي معرفة في الموديل
                foreach ($student->passedCourses as $course) {
                    $grade = $course->pivot ? floatval($course->pivot->grade) : 0;
                    if ($grade > 0) {
                        $totalCredits += $course->credit_hours;
                        $weightedSum += ($grade * $course->credit_hours);
                    }
                }

                $gpa = $totalCredits > 0 ? round($weightedSum / $totalCredits, 2) : 0;

                $cartHours = 0;
                if ($student->cartCourses && $student->cartCourses->count() > 0) {
                    $cartHours = (int) $student->cartCourses->sum('credit_hours');
                }

                $lastSession = DB::table('sessions')->where('user_id', $student->id)->max('last_activity');
                $lastSeen = $lastSession ? Carbon::createFromTimestamp((int) $lastSession)->diffForHumans() : 'لم يسجل';

                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'avatar' => $student->avatar,
                    'email' => $student->email,
                    'major_id' => $student->major_id,
                    'study_plan_version' => (int) ($student->study_plan_version ?? 12),
                    'ip_address' => $student->ip_address ?? 'غير مسجل',
                    'last_login' => ($student->last_login_at instanceof \Carbon\Carbon)
                        ? $student->last_login_at->diffForHumans()
                        : 'لم يسجل دخول',
                    'last_seen' => $lastSeen,
                    'created_at' => $student->created_at ? $student->created_at->format('Y-m-d') : '---',
                    'major' => $student->major ? $student->major->name : 'غير محدد',
                    'college' => $student->major && $student->major->college ? $student->major->college->name : 'غير محدد',
                    'portal_student_id' => $student->portal_student_id,
                    'graduation_eligibility' => $student->isEligibleForGraduation(),
                    'stats' => [
                        'gpa' => $gpa,
                        'total_passed_credits' => $totalCredits,
                        'cart_courses_count' => $student->cartCourses ? $student->cartCourses->count() : 0,
                        'cart_hours' => $cartHours,
                    ],
                    // ✅ تصحيح العلاقات لضمان ظهور البيانات في ملف الطالب (Sidebar)
                    'passed_courses' => $student->passedCourses, 
                    'cart_courses' => $student->cartCourses,
                ];
            });

        $colleges = College::select('id', 'name')->get();
        $majors = Major::select('id', 'name', 'college_id')->get();

        return Inertia::render('Admin/Students/Index', [
            'students' => $students,
            'colleges' => $colleges,
            'majors' => $majors,
            'filters' => $request->only(['search', 'college_id', 'major_id'])
        ]);
    }

    /**
     * تحديث بيانات الطالب
     */
    public function update(Request $request, User $student)
    {
        if (strtolower((string) $student->role) !== 'student') {
            abort(403, 'غير مصرح بتعديل بيانات هذا الحساب.');
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $student->id,
            'major_id' => 'nullable|exists:majors,id',
            'study_plan_version' => 'required|integer|in:11,12',
        ]);

        $student->update($data);
        $this->logAction('UPDATE_STUDENT', "تم تحديث بيانات الطالب {$student->email}");

        return back()->with('message', 'تم تحديث بيانات الطالب بنجاح');
    }

    /**
     * حذف حساب الطالب نهائياً
     */
    public function destroy(User $student)
    {
        if (strtolower((string) $student->role) !== 'student') {
            abort(403, 'غير مصرح بحذف هذا الحساب.');
        }

        $email = $student->email;
        $student->delete();
        $this->logAction('DELETE_STUDENT', "تم حذف حساب الطالب {$email}");
        return back()->with('message', 'تم حذف حساب الطالب بنجاح');
    }

    /**
     * حظر وحذف حساب الطالب نهائياً
     */
    public function banAndDestroy(User $student)
    {
        if (strtolower((string) $student->role) !== 'student') {
            abort(403, 'غير مصرح بحظر هذا الحساب.');
        }

        $email = $student->email;

        \App\Models\BannedUser::firstOrCreate([
            'email' => $email
        ], [
            'reason' => 'Banned by admin via dashboard'
        ]);

        $student->delete();
        $this->logAction('BAN_STUDENT', "تم حظر وحذف حساب الطالب {$email}");
        
        return back()->with('message', 'تم حظر وحذف حساب الطالب بنجاح، ولن يتمكن من التسجيل مجدداً.');
    }

    /**
     * Remove a course from a student's trial cart (admin action).
     */
    public function removeCartCourse(Request $request, User $student, $courseId)
    {
        if (strtolower((string) $student->role) !== 'student') {
            abort(403, 'غير مصرح بالتعديل على مسودة هذا الحساب.');
        }

        $this->logAction('REMOVE_CART_COURSE', "حذف مادة {$courseId} من تسجيل الطالب {$student->email}");

        $exists = $student->cartCourses()->where('course_id', (int) $courseId)->exists();
        if (!$exists) {
            return back()->with('message', 'المادة غير موجودة في تسجيل الطالب');
        }

        $student->cartCourses()->detach((int) $courseId);

        return back()->with('message', 'تمت إزالة المادة من تسجيل الطالب');
    }
}