<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Major;
use App\Models\College;
use App\Models\User;
use App\Models\AdminLog;
use App\Models\IssueReport;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    /**
     * تسجيل حركات الأدمن في قاعدة البيانات
     */
    private function logAction($action, $details) {
        AdminLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'details' => $details,
            'ip_address' => request()->ip()
        ]);
    }

    /**
     * لوحة المعلومات الإحصائية + تقارير المواد الأكثر طلباً
     */
    public function dashboard()
    {
        $demandReport = Course::whereHas('cartUsers') 
            ->withCount('cartUsers')
            ->orderBy('cart_users_count', 'desc')
            ->take(10)
            ->get();

        $issueSummary = [
            'open' => IssueReport::where('status', 'open')->count(),
            'in_progress' => IssueReport::where('status', 'in_progress')->count(),
            'resolved' => IssueReport::where('status', 'resolved')->count(),
            'total' => IssueReport::count(),
        ];

        // 🔥 حساب النشطين حالياً (آخر 30 دقيقة)
        $thirtyMinutesAgo = now()->subMinutes(30)->timestamp;
        
        $activeStudentIds = DB::table('sessions')
            ->whereIn('user_id', User::where('role', 'student')->pluck('id'))
            ->where('last_activity', '>=', $thirtyMinutesAgo)
            ->distinct('user_id')
            ->pluck('user_id');
        
        $activeAdminIds = DB::table('sessions')
            ->whereIn('user_id', User::whereRaw('LOWER(role) = ?', ['admin'])->pluck('id'))
            ->where('last_activity', '>=', $thirtyMinutesAgo)
            ->distinct('user_id')
            ->pluck('user_id');

        // 🔥 الحصول على قائمة المستخدمين النشطين مع تفاصيلهم
        $onlineUsers = DB::table('sessions as s')
            ->join('users as u', 's.user_id', '=', 'u.id')
            ->select('u.id', 'u.name', 'u.email', 'u.role', 's.last_activity')
            ->where('s.last_activity', '>=', $thirtyMinutesAgo)
            ->orderByDesc('s.last_activity')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'last_activity_ago' => \Carbon\Carbon::createFromTimestamp($user->last_activity)->diffForHumans(),
                ];
            });

        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'students_count' => User::where('role', 'student')->count(),
                'active_students_now' => $activeStudentIds->count(),
                'admins_count' => User::whereRaw('LOWER(role) = ?', ['admin'])->count(),
                'active_admins_now' => $activeAdminIds->count(),
                'owners_count' => User::whereRaw('LOWER(role) = ?', ['owner'])->count(),
                'courses_count' => Course::count(),
                'compulsory_count' => Course::where('type', 'compulsory')->count(),
                'elective_count' => Course::where('type', 'elective')->count(),
            ],
            'onlineUsers' => $onlineUsers,
            'platform' => [
                'colleges_count' => College::count(),
                'majors_count' => Major::count(),
            ],
            'colleges' => College::select('id', 'name')->orderBy('name')->get(),
            'majors' => Major::select('id', 'name', 'code', 'college_id')->orderBy('name')->get(),
            'demandReport' => $demandReport,
            'issueSummary' => $issueSummary,
            'recentIssues' => IssueReport::with('user:id,name,email')->latest()->take(6)->get(),
            'logs' => AdminLog::with('user:id,name,email')->latest()->take(25)->get(),
        ]);
    }

    /**
     * API: جلب المستخدمين النشطين (للـ polling في لوحة الإدارة)
     */
    public function getOnlineUsers()
    {
        $thirtyMinutesAgo = now()->subMinutes(30)->timestamp;

        $onlineUsers = DB::table('sessions as s')
            ->join('users as u', 's.user_id', '=', 'u.id')
            ->select('u.id', 'u.name', 'u.email', 'u.role', 's.last_activity')
            ->whereNotNull('s.user_id')
            ->where('s.last_activity', '>=', $thirtyMinutesAgo)
            ->orderByDesc('s.last_activity')
            ->get()
            ->unique('id')
            ->values()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'last_activity_ago' => \Carbon\Carbon::createFromTimestamp((int) $user->last_activity)->diffForHumans(),
                ];
            });

        $activeStudentsNow = $onlineUsers->where('role', 'student')->count();
        $activeAdminsNow = $onlineUsers->filter(function ($u) {
            return strtolower((string) $u['role']) === 'admin';
        })->count();

        return response()->json([
            'online_users' => $onlineUsers,
            'active_students_now' => $activeStudentsNow,
            'active_admins_now' => $activeAdminsNow,
            'total_online' => $onlineUsers->count(),
        ]);
    }

    /**
     * API: تحديث last_activity للمستخدم الحالي
     */
    public function updateLastActivity()
    {
        if (Auth::check()) {
            DB::table('sessions')
                ->where('user_id', Auth::id())
                ->update(['last_activity' => now()->timestamp]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * API: تسجيل إغلاق التبويب/النافذة
     */
    public function handleBrowserClose()
    {
        if (Auth::check()) {
            DB::table('sessions')
                ->where('user_id', Auth::id())
                ->delete();
        }

        return response()->json(['ok' => true]);
    }

    /**
     * عرض قائمة المواد - مع إرسال الهيكلة الأكاديمية كاملة للفلترة
     */
    public function index()
    {
        return Inertia::render('Admin/Index', [
            'courses' => Course::with(['major', 'prerequisites'])->latest()->get(),
            // 🔥 تم إزالة universities بناءً على طلبك 🔥
            'colleges' => College::all(),
            'majors' => Major::all(),
            'logs' => AdminLog::with('user')->latest()->take(50)->get()
        ]);
    }

    /**
     * صفحة مستقلة لإدارة الكليات والتخصصات
     */
    public function structure()
    {
        return Inertia::render('Admin/Structure', [
            'platform' => [
                'colleges_count' => College::count(),
                'majors_count' => Major::count(),
            ],
            'colleges' => College::select('id', 'name')->orderBy('name')->get(),
            'majors' => Major::select('id', 'name', 'code', 'college_id')->orderBy('name')->get(),
        ]);
    }

    /**
     * صفحة مستقلة لسجل عمليات الإدارة
     */
    public function logs()
    {
        return Inertia::render('Admin/Logs', [
            'logs' => AdminLog::with('user:id,name,email')->select('*')->latest()->take(200)->get(),
            'loginLogs' => AdminLog::with('user:id,name,email,role')
                ->where('action', 'USER_LOGIN')
                ->latest()
                ->take(120)
                ->get(),
        ]);
    }

    /**
     * تنفيذ تفريغ كاش النظام بأوامر Artisan بشكل آمن.
     */
    public function clearCache(Request $request)
    {
        $actor = Auth::user();

        try {
            Artisan::call('optimize:clear');
            Artisan::call('config:cache');

            $warning = null;
            try {
                Artisan::call('route:cache');
            } catch (\Throwable $routeCacheError) {
                // Route cache can fail when any route uses a Closure; keep the system operational.
                Artisan::call('route:clear');
                $warning = 'Route cache was skipped because closure-based routes are present.';

                Log::warning('Route cache skipped during clear-cache operation', [
                    'user_id' => Auth::id(),
                    'error' => $routeCacheError->getMessage(),
                ]);
            }

            $details = "تم تنفيذ تفريغ كاش النظام بواسطة {$actor?->name} ({$actor?->email})";
            if ($warning) {
                $details .= ' - تم تجاوز route:cache بسبب وجود Closure routes.';
            }

            $this->logAction('CLEAR_SYSTEM_CACHE', $details);

            return response()->json([
                'success' => true,
                'message' => $warning
                    ? 'System cache cleared successfully (route cache skipped).'
                    : 'System cache cleared successfully',
                'warning' => $warning,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to clear system cache', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to clear system cache. Please try again.',
            ], 500);
        }
    }

    // =========================================================
    // 🔥 الدوال الجديدة لإضافة الكليات والتخصصات من لوحة التحكم 🔥
    // =========================================================

    public function storeCollege(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            // 🔥 تم إزالة validation الـ university_id 🔥
        ]);

        $college = College::create($validated);
        $this->logAction('ADD_COLLEGE', "تم إضافة كلية جديدة: {$college->name}");

        return redirect()->back()->with('success', 'تم إضافة الكلية بنجاح! 🏛️');
    }

    public function storeMajor(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|unique:majors,code',
            'college_id' => 'required|exists:colleges,id',
        ]);

        $major = Major::create($validated);
        $this->logAction('ADD_MAJOR', "تم إضافة تخصص جديد: {$major->name} ({$major->code})");

        return redirect()->back()->with('success', 'تم إضافة التخصص بنجاح! 🎓');
    }

    // =========================================================
    // الدوال الخاصة بالمواد الدراسية
    // =========================================================

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'code'            => [
                'required',
                'string',
                Rule::unique('courses')->where(function ($query) use ($request) {
                    $majorId = $request->input('major_id');

                    $query->where('study_plan_version', (int) $request->input('study_plan_version'));

                    if (empty($majorId)) {
                        $query->whereNull('major_id');
                    } else {
                        $query->where('major_id', $majorId);
                    }
                }),
            ],
            'credit_hours'    => 'required|integer',
            'minimum_passed_hours' => 'nullable|integer|min:1|max:200',
            'type'            => 'required|in:compulsory,elective,supporting,university_req',
            'major_id'        => 'nullable|exists:majors,id',
            'study_plan_version' => 'required|integer|in:11,12',
            'semester'        => 'required|integer|min:1|max:12',
            'prerequisite_id' => 'nullable|exists:courses,id',
            'description'     => 'nullable|string',
        ]);

        if (!empty($validated['prerequisite_id'])) {
            $prerequisite = Course::find($validated['prerequisite_id']);
            if (!$prerequisite || $prerequisite->major_id != $validated['major_id'] || (int) $prerequisite->study_plan_version !== (int) $validated['study_plan_version']) {
                return redirect()->back()->withErrors([
                    'prerequisite_id' => 'المتطلب السابق يجب أن يكون من نفس التخصص ونفس رقم الخطة.',
                ])->withInput();
            }
        }

        $course = Course::create([
            'name'         => $validated['name'],
            'code'         => $validated['code'],
            'credit_hours' => $validated['credit_hours'],
            'minimum_passed_hours' => $validated['minimum_passed_hours'] ?? null,
            'type'         => $validated['type'],
            'major_id'     => $validated['major_id'],
            'study_plan_version' => $validated['study_plan_version'],
            'semester'     => $validated['semester'],
            'description'  => $validated['description'],
        ]);

        if (!empty($validated['prerequisite_id'])) {
            $course->prerequisites()->attach($validated['prerequisite_id']);
        }

        $this->logAction('ADD_COURSE', "تم إضافة المادة وربط المتطلب: {$course->name} ({$course->code})");
        return redirect()->back()->with('success', 'تم حفظ المادة بنجاح وتفعيل نظام المتطلبات! 🎉');
    }

    public function update(Request $request, Course $course)
    {
        $validated = $request->validate([
            'name'            => 'required|string',
            'code'            => [
                'required',
                'string',
                Rule::unique('courses')->ignore($course->id)->where(function ($query) use ($request) {
                    $majorId = $request->input('major_id');

                    $query->where('study_plan_version', (int) $request->input('study_plan_version'));

                    if (empty($majorId)) {
                        $query->whereNull('major_id');
                    } else {
                        $query->where('major_id', $majorId);
                    }
                }),
            ],
            'credit_hours'    => 'required|integer',
            'minimum_passed_hours' => 'nullable|integer|min:1|max:200',
            'type'            => 'required|in:compulsory,elective,supporting,university_req',
            'major_id'        => 'nullable|exists:majors,id',
            'study_plan_version' => 'required|integer|in:11,12',
            'semester'        => 'required|integer|min:1|max:12',
            'prerequisite_id' => 'nullable|exists:courses,id',
            'description'     => 'nullable|string',
        ]);

        if (!empty($validated['prerequisite_id']) && (int) $validated['prerequisite_id'] === (int) $course->id) {
            return redirect()->back()->withErrors([
                'prerequisite_id' => 'لا يمكن ربط المادة بنفسها كمتطلب.',
            ])->withInput();
        }

        if (!empty($validated['prerequisite_id'])) {
            $prerequisite = Course::find($validated['prerequisite_id']);
            if (!$prerequisite || $prerequisite->major_id != $validated['major_id'] || (int) $prerequisite->study_plan_version !== (int) $validated['study_plan_version']) {
                return redirect()->back()->withErrors([
                    'prerequisite_id' => 'المتطلب السابق يجب أن يكون من نفس التخصص ونفس رقم الخطة.',
                ])->withInput();
            }
        }

        $course->update([
            'name'         => $validated['name'],
            'code'         => $validated['code'],
            'credit_hours' => $validated['credit_hours'],
            'minimum_passed_hours' => $validated['minimum_passed_hours'] ?? null,
            'type'         => $validated['type'],
            'major_id'     => $validated['major_id'],
            'study_plan_version' => $validated['study_plan_version'],
            'semester'     => $validated['semester'],
            'description'  => $validated['description'],
        ]);

        if (!empty($validated['prerequisite_id'])) {
            $course->prerequisites()->sync([$validated['prerequisite_id']]);
        } else {
            $course->prerequisites()->detach(); 
        }

        $this->logAction('UPDATE_COURSE', "تم تعديل المادة: {$course->name}");
        return redirect()->back()->with('success', 'تم تعديل المادة بنجاح!');
    }

    public function destroy(Course $course)
    {
        $courseName = $course->name;
        DB::table('course_prerequisites')->where('course_id', $course->id)->orWhere('prerequisite_id', $course->id)->delete();
        $course->delete();

        $this->logAction('DELETE_COURSE', "تم حذف المادة: {$courseName}");
        return redirect()->back()->with('success', 'تم الحذف بنجاح');
    }

    public function bulkDelete(Request $request)
    {
        $ids = $request->input('ids');
        if (!empty($ids)) {
            $count = Course::whereIn('id', $ids)->delete();
            DB::table('course_prerequisites')->whereIn('course_id', $ids)->orWhereIn('prerequisite_id', $ids)->delete();
            $this->logAction('BULK_DELETE', "تم حذف $count مادة مع كافة علاقاتها الشجرية.");
            return redirect()->back()->with('success', "تم حذف المواد بنجاح.");
        }
        return redirect()->back()->with('error', 'لم يتم تحديد أي مادة.');
    }

    public function export()
    {
        $fileName = 'Academic_Tree_Plan_' . date('Y-m-d') . '.csv';
        return response()->streamDownload(function () {
            $handle = fopen('php://output', 'w');
            fputs($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Code', 'Name', 'Credits', 'Type', 'Major', 'Plan Version', 'Semester', 'Prerequisites', 'Description']);

            $courses = Course::with(['major', 'prerequisites'])->get();
            foreach ($courses as $course) {
                fputcsv($handle, [
                    $course->code, $course->name, $course->credit_hours, $course->type,
                    $course->major ? $course->major->name : 'متطلب جامعة عام',
                    $course->study_plan_version,
                    $course->semester,
                    $course->prerequisites->pluck('code')->implode(', '),
                    $course->description
                ]);
            }
            fclose($handle);
        }, $fileName);
    }

    public function import(Request $request)
    {
        $request->validate([
            'csv_file' => 'required|file|mimes:csv,txt|max:10240',
            'major_id' => 'required|exists:majors,id',
            'study_plan_version' => 'required|integer|in:11,12',
        ]);

        $file = $request->file('csv_file');
        $selectedMajorId = $request->input('major_id');
        $selectedPlanVersion = (int) $request->input('study_plan_version');

        if (($handle = fopen($file->getPathname(), 'r')) !== false) {
            
            $headers = fgetcsv($handle);
            $headers[0] = preg_replace('/[\x00-\x1F\x80-\xFF]/', '', $headers[0]); 
            $headers = array_map('trim', $headers);
            $headers = array_map('strtolower', $headers);

            $idxCode = -1; $idxName = -1; $idxCredits = -1; $idxGroup = -1; $idxPrereq = -1;
            foreach ($headers as $i => $h) {
                if (str_contains($h, 'course_id') || str_contains($h, 'code')) $idxCode = $i;
                if (str_contains($h, 'course_na') || str_contains($h, 'name')) $idxName = $i;
                if (str_contains($h, 'credit')) $idxCredits = $i;
                if (str_contains($h, 'group_ti') || str_contains($h, 'type')) $idxGroup = $i;
                if (str_contains($h, 'prereq')) $idxPrereq = $i;
            }

            if ($idxCode === -1 || $idxName === -1) {
                fclose($handle);
                return redirect()->back()->with('error', 'خطأ: لم يتم العثور على أعمدة رمز المادة واسمها في الترويسة!');
            }

            $prerequisitesMap = []; 
            $count = 0;
            $importedCourseIds = []; 

            while (($row = fgetcsv($handle)) !== false) {
                if (!isset($row[$idxCode]) || trim($row[$idxCode]) === '') continue;

                $code    = trim($row[$idxCode]);
                $name    = trim($row[$idxName]);
                $credits = ($idxCredits !== -1 && isset($row[$idxCredits])) ? (int) trim($row[$idxCredits]) : 3;
                
                $groupTitle = ($idxGroup !== -1 && isset($row[$idxGroup])) ? trim($row[$idxGroup]) : '';
                
                $type = 'compulsory';
                if (str_contains($groupTitle, 'اختياري') || str_contains(strtolower($groupTitle), 'elective')) {
                    $type = 'elective';
                } elseif (str_contains($groupTitle, 'مساند') || str_contains(strtolower($groupTitle), 'support')) {
                    $type = 'supporting';
                } elseif (str_contains($groupTitle, 'جامعة') || str_contains(strtolower($groupTitle), 'university')) {
                    $type = 'university_req';
                }

                $course = Course::updateOrCreate(
                    [
                        'code' => $code,
                        'major_id' => $selectedMajorId,
                        'study_plan_version' => $selectedPlanVersion,
                    ],
                    [
                        'name' => $name,
                        'credit_hours' => $credits,
                        'semester' => 1,
                        'type' => $type,
                        'major_id' => $selectedMajorId,
                        'study_plan_version' => $selectedPlanVersion,
                    ]
                );

                $importedCourseIds[] = $course->id;

                if ($idxPrereq !== -1 && isset($row[$idxPrereq]) && trim($row[$idxPrereq]) !== '') {
                    $prereqRaw = trim($row[$idxPrereq]);
                    if (strtoupper($prereqRaw) !== 'NULL' && $prereqRaw !== '0' && $prereqRaw !== '-') {
                        $prerequisitesMap[$course->id] = $prereqRaw;
                    }
                }
                $count++;
            }
            fclose($handle);

            foreach ($prerequisitesMap as $courseId => $prereqString) {
                $course = Course::find($courseId);
                $pIds = [];

                $cleanPrereq = str_replace(['"', "'", '[', ']', '(', ')', '،'], ',', $prereqString);
                $pCodes = preg_split('/[\s,]+/', $cleanPrereq, -1, PREG_SPLIT_NO_EMPTY);

                foreach ($pCodes as $pCode) {
                    $pCourse = Course::where('code', trim($pCode))
                        ->where('major_id', $selectedMajorId)
                        ->where('study_plan_version', $selectedPlanVersion)
                        ->first();
                    if ($pCourse) {
                        $pIds[] = $pCourse->id;
                    }
                }

                if (!empty($pIds)) {
                    $course->prerequisites()->sync($pIds);
                }
            }

            $allCourses = Course::whereIn('id', $importedCourseIds)->with('prerequisites')->get();
            $changed = true;
            
            while($changed) {
                $changed = false;
                foreach($allCourses as $c) {
                    $maxPrereqLvl = 0;
                    foreach($c->prerequisites as $p) {
                        if ($p->semester > $maxPrereqLvl) {
                            $maxPrereqLvl = $p->semester;
                        }
                    }
                    if ($maxPrereqLvl > 0 && $maxPrereqLvl + 1 > $c->semester) {
                        $c->semester = $maxPrereqLvl + 1;
                        $c->save();
                        $changed = true; 
                    }
                }
            }

            $this->logAction('IMPORT_PLAN', "تم استيراد $count مادة للتخصص {$selectedMajorId} بالخطة {$selectedPlanVersion} مع إعادة بناء العلاقات والمستويات الشجرية تلقائياً.");
        }

        return redirect()->back()->with('success', "تم الاستيراد بنجاح! 🚀 تم بناء الأسهم والمستويات تلقائياً لـ $count مادة.");
    }

    /**
     * 🔥 دالة تقرير المواد الأكثر طلباً 🔥
     */
    public function demandReport(Request $request)
    {
        $courseDemand = Course::whereHas('cartUsers')
            ->when($request->college_id, function ($query, $collegeId) {
                $query->whereHas('major', function ($q) use ($collegeId) {
                    $q->where('college_id', $collegeId);
                });
            })
            ->when($request->major_id, function ($query, $majorId) {
                $query->where('major_id', $majorId);
            })
            ->withCount('cartUsers')
            ->orderBy('cart_users_count', 'desc')
            ->take(15) 
            ->get();

        $colleges = College::select('id', 'name')->get();
        $majors = Major::select('id', 'name', 'college_id')->get();

        // 🔥 تعديل جوهري: حساب إجمالي الطلاب "النشطين" (الذين لديهم مواد في التسجيل التجريبي) فقط
        // هذا يمنع ظهور نسبة 0% إذا كان هناك طلاب مسجلين ولكن لم يستخدموا التسجيل التجريبي بعد.
        $totalStudents = User::whereHas('cartCourses')->count();

        return Inertia::render('Admin/Reports/Demand', [
            'courseDemand' => $courseDemand,
            'colleges' => $colleges,
            'majors' => $majors,
            'filters' => $request->only(['college_id', 'major_id']),
            'totalStudents' => $totalStudents
        ]);
    }
}