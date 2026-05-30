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

class AdminInstructorController extends Controller
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
        // 1. استعلام الدكاترة مع الفلترة الذكية
        $instructors = User::where('role', 'instructor')
            ->with(['taughtCourses']) 
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
            ->through(function ($instructor) {
                
                $lastSession = DB::table('sessions')->where('user_id', $instructor->id)->max('last_activity');
                $lastSeen = $lastSession ? Carbon::createFromTimestamp((int) $lastSession)->diffForHumans() : 'لم يسجل';

                return [
                    'id' => $instructor->id,
                    'name' => $instructor->name,
                    'avatar' => $instructor->avatar,
                    'email' => $instructor->email,
                    'major_id' => $instructor->major_id,
                    'ip_address' => $instructor->ip_address ?? 'غير مسجل',
                    'last_login' => ($instructor->last_login_at instanceof \Carbon\Carbon)
                        ? $instructor->last_login_at->diffForHumans()
                        : 'لم يسجل دخول',
                    'last_seen' => $lastSeen,
                    'created_at' => $instructor->created_at ? $instructor->created_at->format('Y-m-d') : '---',
                    'major' => $instructor->major ? $instructor->major->name : 'غير محدد',
                    'college' => $instructor->major && $instructor->major->college ? $instructor->major->college->name : 'غير محدد',
                    'taught_courses_count' => $instructor->taughtCourses ? $instructor->taughtCourses->count() : 0,
                    'taught_courses' => $instructor->taughtCourses,
                ];
            });

        $colleges = College::select('id', 'name')->get();
        $majors = Major::select('id', 'name', 'college_id')->get();

        return Inertia::render('Admin/Instructors/Index', [
            'instructors' => $instructors,
            'colleges' => $colleges,
            'majors' => $majors,
            'filters' => $request->only(['search', 'college_id', 'major_id'])
        ]);
    }

    /**
     * تحديث بيانات الدكتور
     */
    public function update(Request $request, User $instructor)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $instructor->id,
            'major_id' => 'nullable|exists:majors,id',
        ]);

        $instructor->update($data);
        $this->logAction('UPDATE_INSTRUCTOR', "تم تحديث بيانات الدكتور {$instructor->email}");

        return back()->with('message', 'تم تحديث بيانات الكادر التدريسي بنجاح');
    }

    /**
     * حذف حساب الدكتور نهائياً
     */
    public function destroy(User $instructor)
    {
        $email = $instructor->email;
        $instructor->delete();
        $this->logAction('DELETE_INSTRUCTOR', "تم حذف حساب الدكتور {$email}");
        return back()->with('message', 'تم حذف حساب الكادر التدريسي بنجاح');
    }
}