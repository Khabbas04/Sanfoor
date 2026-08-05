<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use App\Models\AcademicPeriod;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;
use App\Support\AcademicCache;
use Illuminate\Support\Facades\Cache;
use Maatwebsite\Excel\Facades\Excel;
use App\Imports\CourseSectionsImport;

class CourseSectionController extends Controller
{
    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,csv,xls|max:10240', // max 10MB
        ]);

        try {
            $period = AcademicPeriod::current();
            Excel::import(new CourseSectionsImport($period), $request->file('file'));
            
            // Invalidate caches
            AcademicCache::bump();
            Cache::increment('academic_insights_version');
            if ($period) {
                Cache::forget("course_sections_{$period->academic_year}_{$period->academic_term}");
            }

            return back()->with('success', 'تم استيراد الشُعب بنجاح.');
        } catch (\Exception $e) {
            return back()->withErrors(['file' => 'حدث خطأ أثناء الاستيراد: ' . $e->getMessage()]);
        }
    }

    public function index(Request $request)
    {
        $query = CourseSection::with('course')
            ->orderBy('course_id')
            ->orderBy('id');

        if ($request->has('search') && $request->search != '') {
            $search = $request->search;
            $query->whereHas('course', function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            })->orWhere('instructor', 'like', "%{$search}%");
        }

        $sections = $query->paginate(20)->withQueryString();

        return Inertia::render('Admin/CourseSections/Index', [
            'sections' => $sections,
            'filters' => $request->only(['search']),
        ]);
    }

    public function update(Request $request, CourseSection $section)
    {
        $validated = $request->validate([
            'instructor' => 'nullable|string|max:255',
            'days' => 'nullable|string|max:255',
            'time' => 'nullable|string|max:255',
            'hall' => 'nullable|string|max:255',
            'capacity' => 'nullable|integer|min:1',
        ]);

        $section->update($validated);

        // Invalidate caches
        AcademicCache::bump();
        Cache::increment('academic_insights_version');
        Cache::forget("course_sections_{$section->academic_year}_{$section->academic_term}");

        return back()->with('success', 'تم تحديث بيانات الشعبة بنجاح.');
    }

    public function destroy(CourseSection $section)
    {
        $section->delete();
        
        // Invalidate caches
        AcademicCache::bump();
        Cache::increment('academic_insights_version');
        Cache::forget("course_sections_{$section->academic_year}_{$section->academic_term}");

        return back()->with('success', 'تم حذف الشعبة بنجاح.');
    }
}
