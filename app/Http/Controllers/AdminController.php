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

        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'students_count' => User::where('role', 'student')->count(),
                'admins_count' => User::whereRaw('LOWER(role) = ?', ['admin'])->count(),
                'owners_count' => User::whereRaw('LOWER(role) = ?', ['owner'])->count(),
                'courses_count' => Course::count(),
                'compulsory_count' => Course::where('type', 'compulsory')->count(),
                'elective_count' => Course::where('type', 'elective')->count(),
            ],
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
            'code'            => 'required|string|unique:courses,code',
            'credit_hours'    => 'required|integer',
            'minimum_passed_hours' => 'nullable|integer|min:1|max:200',
            'type'            => 'required|in:compulsory,elective,supporting,university_req',
            'major_id'        => 'nullable|exists:majors,id', 
            'semester'        => 'required|integer|min:1|max:12',
            'prerequisite_id' => 'nullable|exists:courses,id', 
            'description'     => 'nullable|string', 
        ]);

        $course = Course::create([
            'name'         => $validated['name'],
            'code'         => $validated['code'],
            'credit_hours' => $validated['credit_hours'],
            'minimum_passed_hours' => $validated['minimum_passed_hours'] ?? null,
            'type'         => $validated['type'],
            'major_id'     => $validated['major_id'],
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
            'code'            => 'required|string|unique:courses,code,' . $course->id,
            'credit_hours'    => 'required|integer',
            'minimum_passed_hours' => 'nullable|integer|min:1|max:200',
            'type'            => 'required|in:compulsory,elective,supporting,university_req',
            'major_id'        => 'nullable|exists:majors,id',
            'semester'        => 'required|integer|min:1|max:12',
            'prerequisite_id' => 'nullable|exists:courses,id',
            'description'     => 'nullable|string', 
        ]);

        $course->update([
            'name'         => $validated['name'],
            'code'         => $validated['code'],
            'credit_hours' => $validated['credit_hours'],
            'minimum_passed_hours' => $validated['minimum_passed_hours'] ?? null,
            'type'         => $validated['type'],
            'major_id'     => $validated['major_id'],
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
            fputcsv($handle, ['Code', 'Name', 'Credits', 'Type', 'Major', 'Semester', 'Prerequisites', 'Description']);

            $courses = Course::with(['major', 'prerequisites'])->get();
            foreach ($courses as $course) {
                fputcsv($handle, [
                    $course->code, $course->name, $course->credit_hours, $course->type,
                    $course->major ? $course->major->name : 'متطلب جامعة عام', 
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
        ]);

        $file = $request->file('csv_file');
        $selectedMajorId = $request->input('major_id');

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
                    ['code' => $code], 
                    [
                        'name' => $name,
                        'credit_hours' => $credits,
                        'semester' => 1, 
                        'type' => $type,
                        'major_id' => $selectedMajorId,
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
                    $pCourse = Course::where('code', trim($pCode))->first();
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

            $this->logAction('IMPORT_PLAN', "تم استيراد $count مادة وإعادة بناء العلاقات والمستويات الشجرية تلقائياً.");
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

        // 🔥 تعديل جوهري: حساب إجمالي الطلاب "النشطين" (الذين لديهم مواد في المحاكي) فقط
        // هذا يمنع ظهور نسبة 0% إذا كان هناك طلاب مسجلين ولكن لم يستخدموا المحاكي بعد.
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