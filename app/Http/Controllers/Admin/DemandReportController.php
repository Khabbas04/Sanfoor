<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Models\AdminLog;
use App\Models\College;
use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DemandReportController extends Controller
{
    private const SECTION_CAPACITY = 30;

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'college_id' => ['nullable', 'integer', 'exists:colleges,id'],
            'major_id' => ['nullable', 'integer', 'exists:majors,id'],
        ]);

        $period = AcademicPeriod::current();
        $periodYear = $period?->academic_year;
        $periodTerm = $period?->academic_term;

        $courseDemand = Course::query()
            ->select([
                'id', 'name', 'code', 'credit_hours', 'difficulty_level',
                'minimum_passed_hours', 'type', 'semester', 'major_id',
                'college_id', 'study_plan_version', 'description',
            ])
            ->with([
                'major:id,name,college_id',
                'major.college:id,name',
                'college:id,name',
                'prerequisites:id',
            ])
            ->whereHas('cartUsers', function ($query) use ($periodYear, $periodTerm) {
                $query->where('users.role', 'student');
                $this->applyPeriodToRelation($query, $periodYear, $periodTerm);
            })
            ->withCount(['cartUsers as cart_users_count' => function ($query) use ($periodYear, $periodTerm) {
                $query->where('users.role', 'student');
                $this->applyPeriodToRelation($query, $periodYear, $periodTerm);
            }])
            ->when($filters['college_id'] ?? null, function ($query, $collegeId) {
                $query->where(function ($scope) use ($collegeId) {
                    $scope->where('courses.college_id', $collegeId)
                        ->orWhereHas('major', fn ($major) => $major->where('college_id', $collegeId));
                });
            })
            ->when($filters['major_id'] ?? null, fn ($query, $majorId) => $query->where('courses.major_id', $majorId))
            ->orderByDesc('cart_users_count')
            ->orderBy('name')
            ->get()
            ->values()
            ->map(function (Course $course, int $index) {
                $count = (int) $course->cart_users_count;
                $college = $course->college ?? $course->major?->college;

                return [
                    'id' => $course->id,
                    'rank' => $index + 1,
                    'name' => $course->name,
                    'code' => $course->code,
                    'credit_hours' => (int) $course->credit_hours,
                    'difficulty_level' => (int) ($course->difficulty_level ?? 3),
                    'minimum_passed_hours' => $course->minimum_passed_hours !== null ? (int) $course->minimum_passed_hours : null,
                    'type' => $course->type,
                    'semester' => (int) ($course->semester ?? 1),
                    'major_id' => $course->major_id,
                    'major_name' => $course->major?->name ?? 'متطلب عام',
                    'college_id' => $college?->id,
                    'college_name' => $college?->name ?? 'الجامعة',
                    'study_plan_version' => (int) ($course->study_plan_version ?? 12),
                    'description' => $course->description,
                    'prerequisite_ids' => $course->prerequisites->pluck('id')->map(fn ($id) => (int) $id)->values(),
                    'cart_users_count' => $count,
                    'recommended_sections' => max(1, (int) ceil($count / self::SECTION_CAPACITY)),
                ];
            });

        $registrations = $this->registrationQuery($periodYear, $periodTerm, $filters);
        $totalSelections = (clone $registrations)->count();
        $totalStudents = (clone $registrations)->distinct()->count('user_carts.user_id');
        $totalHours = (int) (clone $registrations)->sum('courses.credit_hours');

        $typeDistribution = $courseDemand
            ->groupBy('type')
            ->map(fn ($courses, $type) => [
                'type' => $type,
                'count' => $courses->sum('cart_users_count'),
                'courses' => $courses->count(),
            ])
            ->values();

        return Inertia::render('Admin/Reports/Demand', [
            'courseDemand' => $courseDemand,
            'summary' => [
                'total_students' => $totalStudents,
                'total_selections' => $totalSelections,
                'demanded_courses' => $courseDemand->count(),
                'average_courses_per_student' => $totalStudents > 0 ? round($totalSelections / $totalStudents, 1) : 0,
                'average_hours_per_student' => $totalStudents > 0 ? round($totalHours / $totalStudents, 1) : 0,
                'estimated_sections' => $courseDemand->sum('recommended_sections'),
                'section_capacity' => self::SECTION_CAPACITY,
            ],
            'typeDistribution' => $typeDistribution,
            'colleges' => College::query()->select('id', 'name')->orderBy('name')->get(),
            'majors' => Major::query()->select('id', 'name', 'college_id')->orderBy('name')->get(),
            'filters' => $filters,
            'report' => [
                'generated_at' => now()->toIso8601String(),
                'period' => $period ? [
                    'academic_year' => $period->academic_year,
                    'academic_term' => (int) $period->academic_term,
                    'label' => $period->displayLabel(),
                    'max_hours' => $period->maxHours(),
                ] : null,
            ],
        ]);
    }

    public function students(Course $course): JsonResponse
    {
        $period = AcademicPeriod::current();
        $periodYear = $period?->academic_year;
        $periodTerm = $period?->academic_term;

        $cartTotals = DB::table('user_carts')
            ->join('courses', 'courses.id', '=', 'user_carts.course_id')
            ->selectRaw('user_carts.user_id, COUNT(*) as cart_courses_count, COALESCE(SUM(courses.credit_hours), 0) as cart_hours');
        $this->applyPeriodToQuery($cartTotals, $periodYear, $periodTerm);
        $cartTotals->groupBy('user_carts.user_id');

        $students = DB::table('user_carts')
            ->join('users', 'users.id', '=', 'user_carts.user_id')
            ->leftJoin('majors', 'majors.id', '=', 'users.major_id')
            ->leftJoin('colleges', 'colleges.id', '=', 'majors.college_id')
            ->leftJoinSub($cartTotals, 'cart_totals', fn ($join) => $join->on('cart_totals.user_id', '=', 'users.id'))
            ->where('users.role', 'student')
            ->where('user_carts.course_id', $course->id)
            ->select([
                'users.id', 'users.name', 'users.email', 'users.portal_student_id',
                'users.study_plan_version', 'users.portal_gpa', 'users.portal_passed_hours',
                'majors.name as major_name', 'colleges.name as college_name',
                'user_carts.created_at as registered_at',
                'cart_totals.cart_courses_count', 'cart_totals.cart_hours',
            ]);
        $this->applyPeriodToQuery($students, $periodYear, $periodTerm);

        return response()->json([
            'course' => [
                'id' => $course->id,
                'name' => $course->name,
                'code' => $course->code,
            ],
            'students' => $students
                ->orderBy('users.name')
                ->get()
                ->map(fn ($student) => [
                    'id' => (int) $student->id,
                    'name' => $student->name,
                    'email' => $student->email,
                    'student_number' => $student->portal_student_id,
                    'major' => $student->major_name ?? 'غير محدد',
                    'college' => $student->college_name ?? 'غير محدد',
                    'study_plan_version' => (int) ($student->study_plan_version ?? 12),
                    'gpa' => $student->portal_gpa !== null ? (float) $student->portal_gpa : null,
                    'passed_hours' => $student->portal_passed_hours !== null ? (int) $student->portal_passed_hours : null,
                    'cart_courses_count' => (int) ($student->cart_courses_count ?? 0),
                    'cart_hours' => (int) ($student->cart_hours ?? 0),
                    'registered_at' => $student->registered_at,
                ]),
        ]);
    }

    public function removeStudent(Course $course, User $student): JsonResponse
    {
        abort_unless(strtolower((string) $student->role) === 'student', 403);

        $period = AcademicPeriod::current();
        $query = DB::table('user_carts')
            ->where('user_id', $student->id)
            ->where('course_id', $course->id);
        $this->applyPeriodToQuery($query, $period?->academic_year, $period?->academic_term);

        $deleted = $query->delete();
        abort_if($deleted === 0, 404, 'التسجيل غير موجود في الفصل الحالي.');

        AdminLog::create([
            'user_id' => auth()->id(),
            'action' => 'REMOVE_DEMAND_REGISTRATION',
            'details' => "إزالة {$course->code} من التسجيل التجريبي للطالب {$student->email}",
            'ip_address' => request()->ip(),
            'meta' => [
                'course_id' => $course->id,
                'student_id' => $student->id,
                'academic_year' => $period?->academic_year,
                'academic_term' => $period?->academic_term,
            ],
        ]);

        Cache::forget('admin_dashboard_demand_report');

        return response()->json(['message' => 'تمت إزالة تسجيل الطالب من المادة.']);
    }

    private function registrationQuery(?string $periodYear, ?int $periodTerm, array $filters): Builder
    {
        $query = DB::table('user_carts')
            ->join('users', 'users.id', '=', 'user_carts.user_id')
            ->join('courses', 'courses.id', '=', 'user_carts.course_id')
            ->leftJoin('majors', 'majors.id', '=', 'courses.major_id')
            ->where('users.role', 'student');

        $this->applyPeriodToQuery($query, $periodYear, $periodTerm);

        if (! empty($filters['college_id'])) {
            $collegeId = (int) $filters['college_id'];
            $query->where(fn ($scope) => $scope
                ->where('courses.college_id', $collegeId)
                ->orWhere('majors.college_id', $collegeId));
        }

        if (! empty($filters['major_id'])) {
            $query->where('courses.major_id', (int) $filters['major_id']);
        }

        return $query;
    }

    private function applyPeriodToRelation($query, ?string $periodYear, ?int $periodTerm): void
    {
        if ($periodYear !== null && $periodTerm !== null) {
            $query->where('user_carts.academic_year', $periodYear)
                ->where('user_carts.academic_term', $periodTerm);
        }
    }

    private function applyPeriodToQuery(Builder $query, ?string $periodYear, ?int $periodTerm): void
    {
        if ($periodYear !== null && $periodTerm !== null) {
            $query->where('user_carts.academic_year', $periodYear)
                ->where('user_carts.academic_term', $periodTerm);
        }
    }
}
