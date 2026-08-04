<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicPeriod;
use App\Models\AdminLog;
use App\Models\College;
use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use App\Services\CourseIdentityService;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DemandReportController extends Controller
{
    private const SECTION_CAPACITY = 30;

    public function index(Request $request, CourseIdentityService $courseIdentity): Response
    {
        $filters = $request->validate([
            'college_id' => ['nullable', 'integer', 'exists:colleges,id'],
            'major_id' => ['nullable', 'integer', 'exists:majors,id'],
        ]);

        $period = AcademicPeriod::current();
        $periodYear = $period?->academic_year;
        $periodTerm = $period?->academic_term;

        $catalogue = Course::query()
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
            // Keep the full catalogue visible even when current demand is zero.
            ->where('courses.is_quiz_only', false)
            ->when($filters['college_id'] ?? null, function ($query, $collegeId) {
                $query->where(function ($scope) use ($collegeId) {
                    $scope->where('courses.college_id', $collegeId)
                        ->orWhereHas('major', fn ($major) => $major->where('college_id', $collegeId));
                });
            })
            ->when($filters['major_id'] ?? null, fn ($query, $majorId) => $query->where('courses.major_id', $majorId))
            ->orderBy('name')
            ->get();

        $registrations = $this->registrationQuery($periodYear, $periodTerm, $filters)
            ->select(['user_carts.user_id', 'user_carts.course_id', 'user_carts.created_at'])
            ->get();
        $registrationsByCourse = $registrations->groupBy(fn ($row) => (int) $row->course_id);

        // A physical course row may be repeated per major/study plan. Aggregate it
        // by logical identity and count a student at most once inside each group.
        $courseDemand = $courseIdentity->group($catalogue)
            ->map(function (array $group) use ($registrationsByCourse) {
                /** @var Collection<int, Course> $members */
                $members = $group['members'];
                $memberIds = $members->pluck('id')->map(fn ($id) => (int) $id)->values();
                $groupRegistrations = $memberIds
                    ->flatMap(fn (int $id) => $registrationsByCourse->get($id, collect()))
                    ->unique(fn ($row) => (int) $row->user_id)
                    ->values();

                /** @var Course $course */
                $course = $members->sortBy(fn (Course $candidate) => [
                    -$registrationsByCourse->get((int) $candidate->id, collect())->unique('user_id')->count(),
                    (int) $candidate->id,
                ])->first();
                $count = $groupRegistrations->count();
                $college = $course->college ?? $course->major?->college;
                $majorNames = $members->map(fn (Course $member) => $member->major?->name)
                    ->filter()->unique()->values();
                $collegeNames = $members->map(fn (Course $member) => ($member->college ?? $member->major?->college)?->name)
                    ->filter()->unique()->values();

                return [
                    'id' => $course->id,
                    'name' => $course->name,
                    'code' => $course->code,
                    'course_ids' => $memberIds,
                    'variant_count' => $members->count(),
                    'codes' => $members->pluck('code')->filter()->unique()->values(),
                    'credit_hours' => (int) $course->credit_hours,
                    'difficulty_level' => (int) ($course->difficulty_level ?? 3),
                    'minimum_passed_hours' => $course->minimum_passed_hours !== null ? (int) $course->minimum_passed_hours : null,
                    'type' => $course->type,
                    'semester' => (int) ($course->semester ?? 1),
                    'major_id' => $course->major_id,
                    'major_name' => $majorNames->count() > 1
                        ? $majorNames->implode('، ')
                        : ($majorNames->first() ?? 'متطلب عام'),
                    'major_names' => $majorNames,
                    'college_id' => $college?->id,
                    'college_name' => $collegeNames->count() > 1
                        ? $collegeNames->implode('، ')
                        : ($collegeNames->first() ?? 'الجامعة'),
                    'college_names' => $collegeNames,
                    'study_plan_version' => (int) ($course->study_plan_version ?? 12),
                    'description' => $course->description,
                    'prerequisite_ids' => $course->prerequisites->pluck('id')->map(fn ($id) => (int) $id)->values(),
                    'cart_users_count' => $count,
                    'recommended_sections' => $count > 0 ? (int) ceil($count / self::SECTION_CAPACITY) : 0,
                ];
            })
            ->sortBy(fn (array $course) => [-$course['cart_users_count'], $course['name'], $course['id']])
            ->values()
            ->map(fn (array $course, int $index) => array_merge($course, ['rank' => $index + 1]));

        $totalSelections = (int) $courseDemand->sum('cart_users_count');
        $totalStudents = $registrations->unique('user_id')->count();
        $totalHours = (int) $courseDemand->sum(
            fn (array $course) => $course['cart_users_count'] * $course['credit_hours']
        );
        $totalRegisteredStudents = User::query()
            ->where('role', 'student')
            ->when($filters['college_id'] ?? null, fn ($query, $collegeId) => $query->whereHas('major', fn ($major) => $major->where('college_id', $collegeId)))
            ->when($filters['major_id'] ?? null, fn ($query, $majorId) => $query->where('major_id', $majorId))
            ->count();

        $typeDistribution = $courseDemand
            ->where('cart_users_count', '>', 0)
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
                'total_registered_students' => $totalRegisteredStudents,
                'total_students' => $totalStudents,
                'participation_rate' => $totalRegisteredStudents > 0 ? round(($totalStudents / $totalRegisteredStudents) * 100, 1) : 0,
                'total_selections' => $totalSelections,
                'catalog_courses' => $courseDemand->count(),
                'demanded_courses' => $courseDemand->where('cart_users_count', '>', 0)->count(),
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

    public function students(Course $course, CourseIdentityService $courseIdentity): JsonResponse
    {
        $period = AcademicPeriod::current();
        $periodYear = $period?->academic_year;
        $periodTerm = $period?->academic_term;
        $catalogue = Course::query()->where('is_quiz_only', false)->get(['id', 'name', 'code', 'credit_hours']);
        $equivalentIds = $courseIdentity->equivalentCourseIds($course, $catalogue);

        $studentRows = DB::table('user_carts')
            ->join('users', 'users.id', '=', 'user_carts.user_id')
            ->leftJoin('majors', 'majors.id', '=', 'users.major_id')
            ->leftJoin('colleges', 'colleges.id', '=', 'majors.college_id')
            ->where('users.role', 'student')
            ->whereIn('user_carts.course_id', $equivalentIds)
            ->select([
                'users.id', 'users.name', 'users.email', 'users.portal_student_id',
                'users.study_plan_version', 'users.portal_gpa', 'users.portal_passed_hours',
                'majors.name as major_name', 'colleges.name as college_name',
                'user_carts.created_at as registered_at',
            ]);
        $this->applyPeriodToQuery($studentRows, $periodYear, $periodTerm);
        $studentRows = $studentRows->orderBy('users.name')->get()->groupBy('id');

        $userIds = $studentRows->keys()->map(fn ($id) => (int) $id)->all();
        $allCartRows = DB::table('user_carts')
            ->join('courses', 'courses.id', '=', 'user_carts.course_id')
            ->whereIn('user_carts.user_id', $userIds)
            ->select(['user_carts.user_id', 'user_carts.course_id', 'courses.credit_hours']);
        $this->applyPeriodToQuery($allCartRows, $periodYear, $periodTerm);
        $allCartRows = $allCartRows->get()->groupBy('user_id');

        $canonicalIdByCourse = [];
        $hoursByCanonicalId = [];
        foreach ($courseIdentity->group($catalogue) as $group) {
            $representative = $group['representative'];
            $canonicalId = (int) $representative->id;
            $hoursByCanonicalId[$canonicalId] = (int) $representative->credit_hours;
            foreach ($group['members'] as $member) {
                $canonicalIdByCourse[(int) $member->id] = $canonicalId;
            }
        }

        $students = $studentRows->map(function (Collection $rows, $studentId) use ($allCartRows, $canonicalIdByCourse, $hoursByCanonicalId) {
            $student = $rows->first();
            $canonicalCartIds = $allCartRows->get((int) $studentId, collect())
                ->map(fn ($row) => $canonicalIdByCourse[(int) $row->course_id] ?? (int) $row->course_id)
                ->unique()->values();

            return [
                'id' => (int) $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'student_number' => $student->portal_student_id,
                'major' => $student->major_name ?? 'غير محدد',
                'college' => $student->college_name ?? 'غير محدد',
                'study_plan_version' => (int) ($student->study_plan_version ?? 12),
                'gpa' => $student->portal_gpa !== null ? (float) $student->portal_gpa : null,
                'passed_hours' => $student->portal_passed_hours !== null ? (int) $student->portal_passed_hours : null,
                'cart_courses_count' => $canonicalCartIds->count(),
                'cart_hours' => (int) $canonicalCartIds->sum(fn (int $id) => $hoursByCanonicalId[$id] ?? 0),
                'registered_at' => $rows->min('registered_at'),
            ];
        })->values();

        return response()->json([
            'course' => [
                'id' => $course->id,
                'name' => $course->name,
                'code' => $course->code,
                'course_ids' => $equivalentIds,
                'variant_count' => count($equivalentIds),
            ],
            'students' => $students,
        ]);
    }

    public function removeStudent(Course $course, User $student, CourseIdentityService $courseIdentity): JsonResponse
    {
        abort_unless(strtolower((string) $student->role) === 'student', 403);

        $period = AcademicPeriod::current();
        $equivalentIds = $courseIdentity->equivalentCourseIds($course);
        $query = DB::table('user_carts')
            ->where('user_id', $student->id)
            ->whereIn('course_id', $equivalentIds);
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
                'equivalent_course_ids' => $equivalentIds,
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
            ->where('users.role', 'student')
            ->where('courses.is_quiz_only', false);

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

    private function applyPeriodToQuery(Builder $query, ?string $periodYear, ?int $periodTerm): void
    {
        if ($periodYear !== null && $periodTerm !== null) {
            $query->where('user_carts.academic_year', $periodYear)
                ->where('user_carts.academic_term', $periodTerm);
        }
    }
}
