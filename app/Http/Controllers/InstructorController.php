<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\Chapter;
use App\Models\Course;
use App\Models\Question;
use App\Models\User;
use App\Models\College;
use App\Models\Major;
use App\Models\AcademicPeriod;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class InstructorController extends Controller
{
    /**
     * Instructor dashboard with statistics and quick links.
     */
    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        $user->load('taughtCourses');

        $totalStudents = User::where('role', 'student')->count();
        $totalCourses = Course::count();
        $totalChapters = Chapter::withoutGlobalScopes()->count();
        $totalQuestions = Question::count();

        $taughtCourses = $user->taughtCourses()
            ->select('courses.id', 'courses.name', 'courses.code', 'courses.credit_hours')
            ->get();

        $recentAnnouncements = $user->announcements()
            ->with('course:id,name,code')
            ->latest()
            ->take(5)
            ->get();

        $allCourses = Course::select('id', 'name', 'code')
            ->orderBy('name')
            ->get();

        return Inertia::render('Instructor/Dashboard', [
            'stats' => [
                'total_students' => $totalStudents,
                'total_courses' => $totalCourses,
                'total_chapters' => $totalChapters,
                'total_questions' => $totalQuestions,
                'taught_courses_count' => $taughtCourses->count(),
                'announcements_count' => $user->announcements()->count(),
            ],
            'taught_courses' => $taughtCourses,
            'recent_announcements' => $recentAnnouncements,
            'all_courses' => $allCourses,
        ]);
    }

    /**
     * List all students with search and filter capabilities.
     */
    public function students(Request $request): Response
    {
        $students = User::where('role', 'student')
            ->with('major.college')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
                });
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
            ->paginate(20)
            ->through(function ($student) {
                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'major' => $student->major?->name ?? 'غير محدد',
                    'college' => $student->major?->college?->name ?? 'غير محدد',
                    'created_at' => $student->created_at?->format('Y-m-d'),
                    'last_login' => $student->last_login_at?->diffForHumans() ?? 'لم يسجل دخول',
                ];
            });

        $colleges = College::select('id', 'name')->orderBy('name')->get();
        $majors = Major::select('id', 'name', 'college_id')->orderBy('name')->get();

        return Inertia::render('Instructor/Students', [
            'students' => $students,
            'colleges' => $colleges,
            'majors' => $majors,
            'filters' => $request->only(['search', 'college_id', 'major_id']),
        ]);
    }

    /**
     * List announcements and handle creation.
     */
    public function announcements(Request $request): Response
    {
        $user = $request->user();

        $announcements = $user->announcements()
            ->with('course:id,name,code')
            ->latest()
            ->paginate(15);

        $taughtCourses = $user->taughtCourses()
            ->select('courses.id', 'courses.name', 'courses.code')
            ->get();

        return Inertia::render('Instructor/Announcements', [
            'announcements' => $announcements,
            'taught_courses' => $taughtCourses,
        ]);
    }

    /**
     * Store a new announcement.
     */
    public function storeAnnouncement(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string|max:2000',
            'course_id' => 'nullable|exists:courses,id',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $request->user()->announcements()->create([
            'title' => $data['title'],
            'body' => $data['body'],
            'course_id' => $data['course_id'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
            'is_active' => true,
        ]);

        return back()->with('message', 'تم نشر الإعلان بنجاح.');
    }

    /**
     * Delete an announcement.
     */
    public function destroyAnnouncement(Request $request, Announcement $announcement): RedirectResponse
    {
        if ($announcement->user_id !== $request->user()->id && !$request->user()->isAdminOrOwner()) {
            return back()->with(['message' => 'لا يمكنك حذف هذا الإعلان.', 'type' => 'error']);
        }

        $announcement->delete();
        return back()->with('message', 'تم حذف الإعلان بنجاح.');
    }

    /**
     * Update an announcement.
     */
    public function updateAnnouncement(Request $request, Announcement $announcement): RedirectResponse
    {
        if ($announcement->user_id !== $request->user()->id && !$request->user()->isAdminOrOwner()) {
            return back()->with(['message' => 'لا يمكنك تعديل هذا الإعلان.', 'type' => 'error']);
        }

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string|max:2000',
            'course_id' => 'nullable|exists:courses,id',
            'expires_at' => 'nullable|date|after:now',
        ]);

        $announcement->update([
            'title' => $data['title'],
            'body' => $data['body'],
            'course_id' => $data['course_id'] ?? null,
            'expires_at' => $data['expires_at'] ?? null,
        ]);

        return back()->with('message', 'تم تعديل الإعلان بنجاح.');
    }

    /**
     * Update the courses this instructor teaches.
     */
    public function updateCourses(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'course_ids' => 'present|array',
            'course_ids.*' => 'exists:courses,id',
        ]);

        $request->user()->taughtCourses()->sync($data['course_ids']);

        return back()->with('message', 'تم تحديث المواد بنجاح.');
    }

    /**
     * Public page: show active announcements for students.
     */
    public function publicAnnouncements(): Response
    {
        $announcements = Announcement::active()
            ->with(['user:id,name', 'course:id,name,code'])
            ->latest()
            ->paginate(20);

        return Inertia::render('Public/Announcements', [
            'announcements' => $announcements,
        ]);
    }

    /**
     * 🔥 دالة تقرير المواد الأكثر طلباً 🔥 للكادر التدريسي
     */
    public function demandReport(Request $request)
    {
        $currentPeriod = AcademicPeriod::current();
        $periodYear = $currentPeriod?->academic_year;
        $periodTerm = $currentPeriod?->academic_term;
        $hasPeriodColumns = true;

        $courseDemand = Course::whereHas('cartUsers', function ($query) use ($periodYear, $periodTerm, $hasPeriodColumns) {
            if ($periodYear && $periodTerm && $hasPeriodColumns) {
                $query->where('user_carts.academic_year', $periodYear)
                    ->where('user_carts.academic_term', $periodTerm);
            }
        })
            ->when($request->college_id, function ($query, $collegeId) {
                $query->whereHas('major', function ($q) use ($collegeId) {
                    $q->where('college_id', $collegeId);
                });
            })
            ->when($request->major_id, function ($query, $majorId) {
                $query->where('major_id', $majorId);
            })
            ->withCount(['cartUsers as cart_users_count' => function ($query) use ($periodYear, $periodTerm, $hasPeriodColumns) {
                if ($periodYear && $periodTerm && $hasPeriodColumns) {
                    $query->where('user_carts.academic_year', $periodYear)
                        ->where('user_carts.academic_term', $periodTerm);
                }
            }])
            ->get()
            ->groupBy(function($course) {
                $name = mb_strtolower(trim($course->name));
                $name = preg_replace('/\s+/u', '', $name);
                $name = str_replace(['أ', 'إ', 'آ'], 'ا', $name);
                $name = str_replace('ة', 'ه', $name);
                $name = str_replace('ى', 'ي', $name);
                return $name;
            })
            ->map(function($group) {
                $first = $group->first();
                $first->cart_users_count = $group->sum('cart_users_count');
                $bestNameCourse = $group->sortByDesc(fn($c) => strlen($c->name))->first();
                $first->name = $bestNameCourse->name;
                return $first;
            })
            ->sortByDesc('cart_users_count')
            ->take(15) 
            ->values();

        $colleges = College::select('id', 'name')->get();
        $majors = Major::select('id', 'name', 'college_id')->get();

        $totalStudents = User::whereHas('cartCourses', function ($query) use ($periodYear, $periodTerm, $hasPeriodColumns) {
            if ($periodYear && $periodTerm && $hasPeriodColumns) {
                $query->where('user_carts.academic_year', $periodYear)
                    ->where('user_carts.academic_term', $periodTerm);
            }
        })->count();

        return Inertia::render('Instructor/Demand', [
            'courseDemand' => $courseDemand,
            'colleges' => $colleges,
            'majors' => $majors,
            'filters' => $request->only(['college_id', 'major_id']),
            'totalStudents' => $totalStudents
        ]);
    }
}
