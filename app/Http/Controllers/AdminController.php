<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Major;
use App\Models\College;
use App\Models\User;
use App\Models\AdminLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    /**
     * تسجيل حركات الأدمن في قاعدة البيانات
     */
    private function logAction($action, $details) {
        AdminLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'details' => $details
        ]);
    }

    /**
     * لوحة المعلومات الإحصائية
     */
    public function dashboard()
    {
        return Inertia::render('Admin/Dashboard', [
            'stats' => [
                'students_count' => User::where('role', 'student')->count(),
                'courses_count' => Course::count(),
                'compulsory_count' => Course::where('type', 'compulsory')->count(),
                'elective_count' => Course::where('type', 'elective')->count(),
            ],
            'logs' => AdminLog::with('user')->latest()->take(10)->get()
        ]);
    }

    /**
     * عرض قائمة المواد - تم حذف الترتيب حسب الفصل والاعتماد على العلاقات
     */
    public function index()
    {
        return Inertia::render('Admin/Index', [
            // جلب المواد مع التخصص والمتطلبات السابقة للعرض في الجدول
            'courses' => Course::with(['major', 'prerequisites'])->latest()->get(),
            'majors' => Major::all(),
            'colleges' => College::all(),
            'logs' => AdminLog::with('user')->latest()->take(50)->get()
        ]);
    }

    /**
     * 🔥 إضافة مادة يدوياً - تم حذف حقل الفصل والتركيز على المتطلب 🔥
     */
    public function store(Request $request)
    {
        // التحقق من البيانات المرسلة (بدون حقل semester)
        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'code'            => 'required|string|unique:courses,code',
            'credit_hours'    => 'required|integer',
            'type'            => 'required|string',
            'major_id'        => 'nullable|exists:majors,id',
            'prerequisite_id' => 'nullable|exists:courses,id', // المتطلب السابق
        ]);

        // إنشاء المادة مع إعطاء قيمة افتراضية للفصل داخلياً لضمان عمل قاعدة البيانات
        $course = Course::create([
            'name'         => $validated['name'],
            'code'         => $validated['code'],
            'credit_hours' => $validated['credit_hours'],
            'type'         => $validated['type'],
            'major_id'     => $validated['major_id'],
            'semester'     => 1, // قيمة افتراضية تقنية لا تظهر في الواجهة
        ]);

        // 🔥 الربط بالمتطلب السابق فوراً لإنشاء السهم في الشجرة
        if (!empty($validated['prerequisite_id'])) {
            $course->prerequisites()->attach($validated['prerequisite_id']);
        }

        $this->logAction('ADD_COURSE', "تم إضافة المادة وربط المتطلب: {$course->name} ({$course->code})");

        return redirect()->back()->with('success', 'تم حفظ المادة بنجاح وتفعيل نظام المتطلبات! 🎉');
    }

    /**
     * حذف المواد وعلاقاتها
     */
    public function bulkDelete(Request $request)
    {
        $ids = $request->input('ids');
        
        if (!empty($ids)) {
            $count = Course::whereIn('id', $ids)->delete();
            
            // حذف العلاقات المرتبطة بالمواد المحذوفة من جدول course_prerequisites
            DB::table('course_prerequisites')->whereIn('course_id', $ids)
                                             ->orWhereIn('prerequisite_id', $ids)
                                             ->delete();
            
            $this->logAction('BULK_DELETE', "تم حذف $count مادة مع كافة علاقاتها الشجرية.");
            return redirect()->back()->with('success', "تم حذف المواد بنجاح.");
        }
        
        return redirect()->back()->with('error', 'لم يتم تحديد أي مادة.');
    }

    /**
     * تصدير البيانات مع المتطلبات وبدون الفصل
     */
    public function export()
    {
        $fileName = 'Academic_Tree_Plan_' . date('Y-m-d') . '.csv';
        
        return response()->streamDownload(function () {
            $handle = fopen('php://output', 'w');
            fputs($handle, "\xEF\xBB\xBF");

            fputcsv($handle, ['Code', 'Name', 'Credits', 'Type', 'Major', 'Prerequisites']);

            $courses = Course::with(['major', 'prerequisites'])->get();

            foreach ($courses as $course) {
                fputcsv($handle, [
                    $course->code,
                    $course->name,
                    $course->credit_hours,
                    $course->type,
                    $course->major ? $course->major->name : 'General',
                    $course->prerequisites->pluck('code')->implode(', ')
                ]);
            }
            fclose($handle);
        }, $fileName);
    }

    /**
     * الاستيراد الذكي - يعتمد على بناء الشجرة عبر المتطلبات
     */
    public function import(Request $request)
    {
        $request->validate([
            'csv_file' => 'required|file|mimes:csv,txt|max:10240',
            'major_id' => 'required|exists:majors,id',
        ]);

        $file = $request->file('csv_file');
        $selectedMajorId = $request->input('major_id');

        if (($handle = fopen($file->getPathname(), 'r')) !== false) {
            fgetcsv($handle); 

            $prerequisitesMap = []; 
            $count = 0;

            // المرحلة 1: إنشاء المواد
            while (($row = fgetcsv($handle)) !== false) {
                if (count($row) < 6) continue;

                $prereqRaw  = trim($row[0]); 
                $credits    = (int) trim($row[3]);
                $name       = trim($row[4]);
                $code       = trim($row[5]);
                $typeAr     = trim($row[2]);

                $type = (str_contains($typeAr, 'إجباري') || str_contains($typeAr, 'اجباري')) ? 'compulsory' : 'elective';

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

                if (!empty($prereqRaw) && $prereqRaw !== 'NULL') {
                    $cleanPrereq = str_replace(['"', "'", '[', ']', '(', ')'], '', $prereqRaw);
                    $pCodes = preg_split('/[\s,]+/', $cleanPrereq, -1, PREG_SPLIT_NO_EMPTY);
                    $prerequisitesMap[$course->id] = $pCodes;
                }
                $count++;
            }
            fclose($handle);

            // المرحلة 2: ربط المتطلبات (بناء الأسهم) 🔥
            foreach ($prerequisitesMap as $courseId => $pCodes) {
                $course = Course::find($courseId);
                $pIds = [];

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

            $this->logAction('IMPORT_PLAN', "تم استيراد $count مادة وإعادة بناء علاقات الشجرة.");
        }

        return redirect()->back()->with('success', "تم الاستيراد وبناء روابط الشجرة بنجاح! 🚀");
    }
}