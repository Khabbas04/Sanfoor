<?php

namespace App\Http\Controllers;

use App\Http\Resources\CourseTreeResource;
use App\Http\Resources\PassedCourseResource;
use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\GraduationPlan;
use App\Models\StudentActivityLog;
use App\Support\CourseEligibility;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;

class TreeController extends Controller
{
    private const TREE_CACHE_TTL_MINUTES = 15;
    private const TREE_CACHE_VERSION_KEY = 'tree:cache:version';

    /**
     * عرض صفحة الخطة الشجرية للطالب
     */
    public function index(Request $request)
    {
        $user = Auth::user()->load([
            'major:id,name,college_id',
            'major.college:id,name',
            'passedCourses' => function ($query) {
                $query->select('courses.id', 'courses.name', 'courses.code', 'courses.credit_hours', 'courses.semester')
                    ->withPivot('is_retake', 'attempt_number');
            },
            'cartCourses' => function ($query) {
                $query->select('courses.id');
            },
        ]);

        $isInstructor = $user->role === 'instructor';
        $collegeId = $user->major ? $user->major->college_id : null;
        
        $availableMajors = [];
        if ($isInstructor && $collegeId) {
            $availableMajors = \App\Models\Major::where('college_id', $collegeId)->get(['id', 'name']);
        }

        $requestedMajorId = $request->query('major_id');
        $selectedMajorId = $user->major_id;
        $majorName = $user->major ? $user->major->name : 'غير محدد';

        if ($isInstructor && $requestedMajorId) {
            $selectedMajor = clone \App\Models\Major::find($requestedMajorId);
            if ($selectedMajor && $selectedMajor->college_id === $collegeId) {
                $selectedMajorId = $requestedMajorId;
                $majorName = $selectedMajor->name;
            }
        }

        $requestedPlanVersion = $request->query('plan_version');
        $selectedPlanVersion = (int) ($user->study_plan_version ?? 12);
        
        if ($isInstructor && $requestedPlanVersion) {
            $selectedPlanVersion = (int) $requestedPlanVersion;
        }

        $layoutMajorId = (int) ($selectedMajorId ?? 0);

        $courses = Cache::remember(
            $this->treeCoursesCacheKey($layoutMajorId, $selectedPlanVersion),
            now()->addMinutes(self::TREE_CACHE_TTL_MINUTES),
            function () use ($selectedMajorId, $selectedPlanVersion, $layoutMajorId) {
                return $this->buildTreeCoursesPayload($selectedMajorId, $selectedPlanVersion, $layoutMajorId);
            }
        );

        $passedCourses = PassedCourseResource::collection($user->passedCourses)->resolve();
        $passed_course_ids = $user->passedCourses->pluck('id')->all();
        $totalPassedHours = (int) $user->passedCourses->sum('credit_hours');
        $cart_course_ids = $user->cartCourses->pluck('id')->all();
        $approvedPlan = GraduationPlan::query()
            ->where('user_id', $user->id)
            ->first();

        $latestScheduleReview = \App\Models\ScheduleReview::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        return Inertia::render('Tree/Index', [
            'courses' => $courses,
            'passed_course_ids' => $passed_course_ids,
            'initial_cart_ids' => $cart_course_ids,
            'passed_courses' => $passedCourses,
            'total_passed_hours' => $totalPassedHours,
            'student_name' => $user->name ?? 'طالب',
            'major_name' => $majorName,
            'current_major_id' => $selectedMajorId,
            'college_name' => ($user->major && $user->major->college) ? $user->major->college->name : 'جامعة سنفور',
            'study_plan_version' => $selectedPlanVersion,
            'approved_plan' => $approvedPlan ? [
                'id' => $approvedPlan->id,
                'payload' => $approvedPlan->payload,
                'approved_at' => optional($approvedPlan->approved_at)->toISOString(),
            ] : null,
            'latest_schedule_review' => $latestScheduleReview,
            'is_instructor' => $isInstructor,
            'available_majors' => $availableMajors,
        ]);
    }

    public static function flushCourseTreeCache(): void
    {
        Cache::forever(self::TREE_CACHE_VERSION_KEY, (string) Str::uuid());
    }

    private function treeCoursesCacheKey(int $majorId, int $planVersion): string
    {
        $version = (string) Cache::get(self::TREE_CACHE_VERSION_KEY, 'v1');

        return "tree:courses:{$version}:major:{$majorId}:plan:{$planVersion}";
    }

    private function buildTreeCoursesPayload(?int $selectedMajorId, int $selectedPlanVersion, int $layoutMajorId): array
    {
        $layoutPositions = DB::table('tree_course_positions')
            ->select('course_id', 'position_x', 'position_y')
            ->where('major_id', $layoutMajorId)
            ->where('study_plan_version', $selectedPlanVersion)
            ->get()
            ->keyBy('course_id');

        $courseStatsSubquery = DB::table('course_user')
            ->selectRaw('course_id')
            ->selectRaw('AVG(grade) as avg_grade')
            ->selectRaw('COUNT(*) as graded_attempts')
            ->selectRaw('SUM(CASE WHEN grade < 60 THEN 1 ELSE 0 END) as failed_attempts')
            ->whereNotNull('grade')
            ->groupBy('course_id');

        $query = Course::query()
            ->where('is_quiz_only', false)
            ->leftJoinSub($courseStatsSubquery, 'course_stats', function ($join) {
                $join->on('courses.id', '=', 'course_stats.course_id');
            })
            ->select([
                'courses.id',
                'courses.name',
                'courses.code',
                'courses.credit_hours',
                'courses.difficulty_level',
                'courses.minimum_passed_hours',
                'courses.type',
                'courses.semester',
                'courses.tree_position_x',
                'courses.tree_position_y',
                'courses.major_id',
                'courses.study_plan_version',
                'courses.description',
            ])
            ->selectRaw('COALESCE(course_stats.avg_grade, 72) as avg_grade')
            ->selectRaw('COALESCE(course_stats.graded_attempts, 0) as graded_attempts')
            ->selectRaw('COALESCE(course_stats.failed_attempts, 0) as failed_attempts')
            ->selectRaw('CASE WHEN COALESCE(course_stats.graded_attempts, 0) > 0 THEN (course_stats.failed_attempts / course_stats.graded_attempts) * 100 ELSE 18 END as fail_rate')
            ->withCount('prerequisites')
            ->with([
                'prerequisites' => function ($query) {
                    $query->select('courses.id', 'courses.name', 'courses.code', 'courses.semester');
                },
            ])
            ->orderBy('courses.semester')
            ->orderBy('courses.code');

        if ($selectedMajorId) {
            $query->where(function ($q) use ($selectedMajorId, $selectedPlanVersion) {
                $q->where(function ($majorScope) use ($selectedMajorId, $selectedPlanVersion) {
                    $majorScope->where('major_id', $selectedMajorId)
                        ->where('study_plan_version', $selectedPlanVersion);
                })->orWhere(function ($universityScope) use ($selectedPlanVersion) {
                    $universityScope->whereNull('major_id')
                        ->where('study_plan_version', $selectedPlanVersion);
                });
            });
        } else {
            $query->whereNull('major_id')
                ->where('study_plan_version', $selectedPlanVersion);
        }

        $courses = $query->get();

        $courses->each(function (Course $course) use ($layoutPositions) {
            $position = $layoutPositions->get($course->id);
            $course->tree_position_x = $position ? (float) $position->position_x : null;
            $course->tree_position_y = $position ? (float) $position->position_y : null;
            $course->minimum_passed_hours = CourseEligibility::minimumPassedHoursForCourse($course);
        });

        return CourseTreeResource::collection($courses)->resolve();
    }

    /**
     * حفظ موضع المادة على الشجرة بعد السحب.
     */
    public function updatePosition(Request $request)
    {
        $user = Auth::user();
        abort_unless($user && $user->isAdminOrOwner(), 403);

        $layoutMajorId = (int) ($user->major_id ?? 0);
        $layoutPlanVersion = (int) ($user->study_plan_version ?? 12);

        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'position_x' => ['required', 'numeric'],
            'position_y' => ['required', 'numeric'],
        ]);

        DB::table('tree_course_positions')->updateOrInsert(
            [
                'course_id' => $data['course_id'],
                'major_id' => $layoutMajorId,
                'study_plan_version' => $layoutPlanVersion,
            ],
            [
                'position_x' => $data['position_x'],
                'position_y' => $data['position_y'],
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        self::flushCourseTreeCache();

        return response()->json([
            'status' => 'saved',
            'course_id' => (int) $data['course_id'],
            'scope' => [
                'major_id' => $layoutMajorId,
                'study_plan_version' => $layoutPlanVersion,
            ],
            'position' => [
                'x' => (float) $data['position_x'],
                'y' => (float) $data['position_y'],
            ],
        ]);
    }

    /**
     * دالة تبديل حالة المادة (منجز / غير منجز) بطريقة الاستعلام المباشر (Bulletproof)
     */
    public function toggle(Request $request)
    {
        try {
            $request->validate([
                'course_id' => 'required|exists:courses,id',
                'studied_year' => 'nullable|integer|min:1|max:6',
                'studied_term' => 'nullable|integer|in:1,2,3',
                'studied_semester' => 'nullable|integer|min:1|max:18',
                'grade' => 'nullable|numeric|min:0|max:100',
            ]);

            $userId = Auth::id();
            $courseId = $request->course_id;
            $user = Auth::user();

            $course = Course::query()
                ->select([
                    'courses.id',
                    'courses.name',
                    'courses.code',
                    'courses.credit_hours',
                    'courses.minimum_passed_hours',
                    'courses.major_id',
                    'courses.study_plan_version',
                ])
                ->with([
                    'prerequisites' => function ($query) {
                        $query->select('courses.id', 'courses.name');
                    },
                ])
                ->where('id', $courseId)
                ->where(function ($query) use ($user) {
                    $query->where(function ($majorScope) use ($user) {
                        $majorScope->where('major_id', $user->major_id)
                            ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                    })->orWhere(function ($universityScope) use ($user) {
                        $universityScope->whereNull('major_id')
                            ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                    });
                })
                ->first();

            if (!$course) {
                return response()->json([
                    'status' => 'error',
                    'msg' => 'هذه المادة ليست ضمن خطتك الحالية.',
                ], 403);
            }

            $exists = DB::table('course_user')
                ->where('user_id', $userId)
                ->where('course_id', $courseId)
                ->exists();

            if ($exists) {
                DB::table('course_user')
                    ->where('user_id', $userId)
                    ->where('course_id', $courseId)
                    ->delete();

                StudentActivityLog::create([
                    'user_id' => $userId,
                    'course_id' => $courseId,
                    'action' => 'course_unpassed',
                ]);

                return response()->json(['status' => 'removed']);
            }

            $passedHours = (int) DB::table('course_user')
                ->join('courses', 'courses.id', '=', 'course_user.course_id')
                ->where('course_user.user_id', $userId)
                ->sum('courses.credit_hours');

            $minimumPassedHours = CourseEligibility::minimumPassedHoursForCourse($course);
            if ($minimumPassedHours !== null && $passedHours < $minimumPassedHours) {
                return response()->json([
                    'status' => 'error',
                    'msg' => "هذه المادة تتطلب إنهاء {$minimumPassedHours} ساعة معتمدة. الساعات الحالية: {$passedHours}.",
                ], 422);
            }

            $passedIds = DB::table('course_user')
                ->where('user_id', $userId)
                ->pluck('course_id')
                ->toArray();

            $missingPrereqs = [];
            foreach ($course->prerequisites as $prereq) {
                if (!in_array($prereq->id, $passedIds, true)) {
                    $missingPrereqs[] = $prereq->name;
                }
            }

            if (!empty($missingPrereqs)) {
                return response()->json([
                    'status' => 'error',
                    'msg' => 'عذراً، يجب إنهاء المتطلبات السابقة: ' . implode(' ، ', $missingPrereqs),
                ], 422);
            }

            $studiedYear = $request->input('studied_year');
            $studiedTerm = $request->input('studied_term');

            if (!is_null($studiedYear) && !is_null($studiedTerm)) {
                $targetSemester = (($studiedYear - 1) * 3) + $studiedTerm;
            } else {
                $targetSemester = (int) ($request->studied_semester ?? $course->semester ?? 1);

                if (is_null($studiedYear) || is_null($studiedTerm)) {
                    $legacySemester = max(1, min(12, $targetSemester));
                    $studiedYear = (int) ceil($legacySemester / 2);
                    $studiedTerm = $legacySemester % 2 === 0 ? 2 : 1;
                }
            }

            $targetSemester = max(1, min(18, (int) $targetSemester));
            $studiedYear = max(1, min(6, (int) $studiedYear));
            $studiedTerm = in_array((int) $studiedTerm, [1, 2, 3], true) ? (int) $studiedTerm : 1;

            // التحقق من حد المواد الاختيارية (9 ساعات كحد أقصى)
            if ($course->type === 'elective') {
                $passedElectiveHours = (int) DB::table('course_user')
                    ->join('courses', 'courses.id', '=', 'course_user.course_id')
                    ->where('course_user.user_id', $userId)
                    ->where('courses.type', 'elective')
                    ->where('courses.id', '!=', $courseId)
                    ->sum('courses.credit_hours');

                $cartElectiveHours = (int) DB::table('user_carts')
                    ->join('courses', 'courses.id', '=', 'user_carts.course_id')
                    ->where('user_carts.user_id', $userId)
                    ->where('courses.type', 'elective')
                    ->where('courses.id', '!=', $courseId)
                    ->sum('courses.credit_hours');

                if ($passedElectiveHours + $cartElectiveHours + $course->credit_hours > 9) {
                    return response()->json([
                        'status' => 'error',
                        'msg' => 'عذراً، لا يمكن تجاوز الحد الأقصى للمواد الاختيارية وهو 9 ساعات.',
                    ], 422);
                }
            }

            $grade = $request->input('grade');
            $cleanGrade = ($grade === '' || is_null($grade)) ? null : (float) $grade;

            DB::table('course_user')->updateOrInsert(
                [
                    'user_id' => $userId,
                    'course_id' => $courseId,
                ],
                [
                    'grade' => $cleanGrade,
                    'studied_semester' => $targetSemester,
                    'studied_year' => $studiedYear,
                    'studied_term' => $studiedTerm,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );

            StudentActivityLog::create([
                'user_id' => $userId,
                'course_id' => $courseId,
                'action' => 'course_passed',
                'details' => ['grade' => $cleanGrade],
            ]);

            return response()->json(['status' => 'added']);
        } catch (\Throwable $e) {
            Log::error('Tree toggle failed', [
                'user_id' => Auth::id(),
                'course_id' => $request->input('course_id'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'تعذر تحديث حالة المادة الآن. حاول مرة أخرى.',
            ], 500);
        }
    }

    /**
     * تحديث علامة مادة منجزة مباشرة من الشجرة الأكاديمية
     */
    public function updateGrade(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
            'grade' => 'nullable|numeric|min:0|max:100',
        ]);

        try {
            $userId = Auth::id();
            $courseId = $request->course_id;
            $grade = $request->input('grade');
            $cleanGrade = ($grade === '' || is_null($grade)) ? null : (float) $grade;

            // تحديث علامة آخر محاولة للمادة
            $latestAttempt = DB::table('course_user')
                ->where('user_id', $userId)
                ->where('course_id', $courseId)
                ->orderByDesc('attempt_number')
                ->first();

            if (!$latestAttempt) {
                return response()->json([
                    'status' => 'error',
                    'msg' => 'يجب تسجيل اجتياز المادة أولاً قبل إضافة علامة لها.',
                ], 404);
            }

            DB::table('course_user')
                ->where('user_id', $userId)
                ->where('course_id', $courseId)
                ->where('attempt_number', $latestAttempt->attempt_number)
                ->update([
                    'grade' => $cleanGrade,
                    'updated_at' => now(),
                ]);

            StudentActivityLog::create([
                'user_id' => $userId,
                'course_id' => $courseId,
                'action' => 'grade_updated',
                'details' => ['grade' => $cleanGrade],
            ]);

            $user = Auth::user();
            $newGpa = $user->calculateGPA();

            return response()->json([
                'status' => 'success',
                'grade' => $cleanGrade,
                'new_percentage' => $newGpa['percentage']
            ]);
        } catch (\Throwable $e) {
            Log::error('Tree updateGrade failed', [
                'user_id' => Auth::id(),
                'course_id' => $request->input('course_id'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'تعذر تحديث العلامة الآن. حاول مرة أخرى.',
            ], 500);
        }
    }

    /**
    * 🔥 الدالة الجديدة المخصصة لإضافة أو إزالة مادة واحدة من التسجيل التجريبي فقط 🔥
     * هذه الدالة يتم استدعاؤها من واجهة المحادثة مع الذكاء الاصطناعي (سنفور)
     */
    public function toggleSingleCart(Request $request)
    {
        $request->validate([
            'course_id' => 'required|exists:courses,id',
        ]);

        try {
            $user = Auth::user();
            $courseId = $request->course_id;
            $course = Course::query()
                ->with('prerequisites')
                ->select([
                    'courses.id',
                    'courses.major_id',
                    'courses.study_plan_version',
                    'courses.name',
                    'courses.credit_hours',
                    'courses.minimum_passed_hours',
                    'courses.type',
                ])
                ->where('id', $courseId)
                ->where(function ($query) use ($user) {
                    $query->where(function ($majorScope) use ($user) {
                        $majorScope->where('major_id', $user->major_id)
                            ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                    })->orWhere(function ($universityScope) use ($user) {
                        $universityScope->whereNull('major_id')
                            ->where('study_plan_version', (int) ($user->study_plan_version ?? 12));
                    });
                })
                ->first();

            if (!$course) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'هذه المادة ليست ضمن خطتك الحالية.',
                ], 422);
            }

            $passedCourseIds = $user->passedCourses()->pluck('courses.id')->toArray();
            
            $missingPrereqs = [];
            foreach ($course->prerequisites as $prereq) {
                if (!in_array($prereq->id, $passedCourseIds, true)) {
                    $missingPrereqs[] = $prereq->name;
                }
            }

            if (!empty($missingPrereqs)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'يجب عليك اجتياز المتطلبات السابقة أولاً: ' . implode('، ', $missingPrereqs),
                ], 422);
            }

            $passedHours = (int) $user->passedCourses()->sum('courses.credit_hours');
            $minimumPassedHours = CourseEligibility::minimumPassedHoursForCourse($course);

            if ($minimumPassedHours !== null && $passedHours < $minimumPassedHours) {
                return response()->json([
                    'status' => 'error',
                    'message' => "هذه المادة تتطلب إنهاء {$minimumPassedHours} ساعة معتمدة. الساعات الحالية: {$passedHours}.",
                ], 422);
            }

            if ($user->cartCourses()->where('course_id', $courseId)->exists()) {
                $user->cartCourses()->detach($courseId);

                StudentActivityLog::create([
                    'user_id' => $user->id,
                    'course_id' => $courseId,
                    'action' => 'course_cart_removed',
                ]);

                return response()->json(['status' => 'removed', 'message' => 'تمت إزالة المادة من التسجيل التجريبي.']);
            }

            // Enforce per-term trial hours limit
            $currentAcademic = \App\Models\AcademicPeriod::current();
            $isSummer = $currentAcademic ? ((int) $currentAcademic->academic_term === 3) : false;
            $maxTrialHours = $isSummer ? 9 : 18;

            // التحقق من حد المواد الاختيارية (9 ساعات كحد أقصى)
            if ($course->type === 'elective') {
                $passedElectives = (int) $user->passedCourses()
                    ->where('courses.type', 'elective')
                    ->sum('courses.credit_hours');

                $cartElectives = (int) $user->cartCourses()
                    ->where('courses.type', 'elective')
                    ->sum('courses.credit_hours');

                if ($passedElectives + $cartElectives + $course->credit_hours > 9) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'عذراً، لا يمكن تجاوز الحد الأقصى للمواد الاختيارية وهو 9 ساعات.',
                    ], 422);
                }
            }

            $currentCartHours = (int) $user->cartCourses()->sum('credit_hours');
            $courseHours = (int) ($course->credit_hours ?? 0);
            if (($currentCartHours + $courseHours) > $maxTrialHours) {
                return response()->json([
                    'status' => 'error',
                    'message' => "يتجاوز مجموع الساعات القصوى للتسجيل التجريبي في هذا الفصل ({$maxTrialHours} ساعة). لديك حالياً {$currentCartHours} ساعة.",
                ], 422);
            }

            $currentPeriod = AcademicPeriod::current();

            $insert = [
                'user_id' => Auth::id(),
                'course_id' => $courseId,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('user_carts', 'academic_year') && Schema::hasColumn('user_carts', 'academic_term')) {
                $insert['academic_year'] = $currentPeriod?->academic_year;
                $insert['academic_term'] = $currentPeriod?->academic_term;
            }

            DB::table('user_carts')->insertOrIgnore([$insert]);

            StudentActivityLog::create([
                'user_id' => $user->id,
                'course_id' => $courseId,
                'action' => 'course_cart_added',
            ]);

            return response()->json(['status' => 'added', 'message' => 'تمت إضافة المادة إلى التسجيل التجريبي بنجاح.']);
        } catch (\Throwable $e) {
            Log::error('Tree cart toggle failed', [
                'user_id' => Auth::id(),
                'course_id' => $request->input('course_id'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage() . ' at line ' . $e->getLine(),
            ], 500);
        }
    }

    /**
     * إعادة مادة رسب فيها الطالب (أقل من 50).
     * ينشئ سجل جديد في course_user مع is_retake = true و attempt_number يزيد واحد.
     * المادة تبقى "منجزة" في الشجرة حتى أثناء الإعادة.
     */
    public function retakeCourse(Request $request)
    {
        try {
            $request->validate([
                'course_id' => 'required|exists:courses,id',
                'studied_year' => 'nullable|integer|min:1|max:6',
                'studied_term' => 'nullable|integer|in:1,2,3',
            ]);

            $userId = Auth::id();
            $courseId = $request->course_id;

            // جلب آخر سجل لهذه المادة
            $latestAttempt = DB::table('course_user')
                ->where('user_id', $userId)
                ->where('course_id', $courseId)
                ->orderByDesc('attempt_number')
                ->first();

            if (!$latestAttempt) {
                return response()->json([
                    'status' => 'error',
                    'msg' => 'لم يتم العثور على سجل سابق لهذه المادة.',
                ], 404);
            }

            $latestGrade = $latestAttempt->grade !== null ? (float) $latestAttempt->grade : null;

            // التحقق: فقط المواد المرسوب فيها (أقل من 50) أو بدون علامة
            if ($latestGrade !== null && $latestGrade >= 50) {
                return response()->json([
                    'status' => 'error',
                    'msg' => 'هذه المادة ناجح فيها ولا تحتاج إعادة. يمكنك الإعادة فقط إذا كانت العلامة أقل من 50.',
                ], 422);
            }

            $newAttemptNumber = (int) ($latestAttempt->attempt_number ?? 1) + 1;

            $studiedYear = $request->input('studied_year', 1);
            $studiedTerm = $request->input('studied_term', 1);
            $studiedYear = max(1, min(6, (int) $studiedYear));
            $studiedTerm = in_array((int) $studiedTerm, [1, 2, 3], true) ? (int) $studiedTerm : 1;
            $targetSemester = (($studiedYear - 1) * 3) + $studiedTerm;

            // إدراج سجل جديد كإعادة
            DB::table('course_user')->insert([
                'user_id' => $userId,
                'course_id' => $courseId,
                'grade' => null, // لم تحدد العلامة بعد
                'studied_semester' => $targetSemester,
                'studied_year' => $studiedYear,
                'studied_term' => $studiedTerm,
                'is_retake' => true,
                'attempt_number' => $newAttemptNumber,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            StudentActivityLog::create([
                'user_id' => $userId,
                'course_id' => $courseId,
                'action' => 'course_retake_added',
                'details' => ['attempt_number' => $newAttemptNumber],
            ]);

            return response()->json([
                'status' => 'retake_added',
                'attempt_number' => $newAttemptNumber,
                'msg' => "تمت إضافة المادة كإعادة (المحاولة رقم {$newAttemptNumber}).",
            ]);
        } catch (\Throwable $e) {
            Log::error('Course retake failed', [
                'user_id' => Auth::id(),
                'course_id' => $request->input('course_id'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'msg' => 'تعذر إعادة المادة الآن. حاول مرة أخرى.',
            ], 500);
        }
    }

    /**
     * إعادة تعيين الخطة بالكامل (مسح كافة المواد المنجزة والمواد في التسجيل التجريبي)
     */
    public function resetPlan(Request $request)
    {
        try {
            $userId = Auth::id();

            // مسح المواد المنجزة
            DB::table('course_user')->where('user_id', $userId)->delete();

            // مسح التسجيل التجريبي
            DB::table('user_carts')->where('user_id', $userId)->delete();

            // مسح خطة التخرج المعتمدة إن وجدت
            DB::table('graduation_plans')->where('user_id', $userId)->delete();

            StudentActivityLog::create([
                'user_id' => $userId,
                'action' => 'plan_reset',
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'تم إعادة تعيين خطتك بالكامل بنجاح.'
            ]);
        } catch (\Throwable $e) {
            Log::error('Tree resetPlan failed', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'تعذر إعادة تعيين الخطة الآن. حاول مرة أخرى.',
            ], 500);
        }
    }

    /**
     * إرسال الخطة للتسجيل التجريبي إلى الإدارة أو الكادر التدريسي للمراجعة.
     */
    public function submitReview(Request $request)
    {
        $request->validate([
            'plan_data' => 'required|array',
        ]);

        try {
            $user = Auth::user();

            // تحديث الطلب السابق إن وجد، أو إنشاء طلب جديد (تذكرة واحدة لكل طالب)
            \App\Models\ScheduleReview::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'plan_data' => $request->input('plan_data'),
                    'status' => 'pending',
                    'feedback' => null,
                    'reviewed_by' => null,
                ]
            );

            StudentActivityLog::create([
                'user_id' => $user->id,
                'action' => 'schedule_review_submitted',
            ]);

            return response()->json([
                'status' => 'success',
                'message' => 'تم إرسال الخطة للمراجعة بنجاح! سيتم إشعارك عند الرد.'
            ]);

        } catch (\Throwable $e) {
            Log::error('Tree submitReview failed', [
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'status' => 'error',
                'message' => 'حدث خطأ أثناء إرسال الخطة. يرجى المحاولة مرة أخرى.',
            ], 500);
        }
    }
}