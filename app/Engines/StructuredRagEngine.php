<?php

namespace App\Engines;

use App\Models\User;
use App\Models\Course;
use App\Models\AcademicPeriod;
use App\Support\AcademicCache;
use Illuminate\Support\Facades\Cache;

class StructuredRagEngine
{
    /** Locked courses the student did not ask about are context, not the answer. */
    private const LOCKED_POOL_LIMIT = 8;

    /**
     * Gather all structured academic data for the user.
     */
    public function gather(User $user): array
    {
        $profileData = $this->getStudentAcademicData($user);
        $cartData = $this->getCartData($user);
        
        $passedIds = $profileData['passed_course_ids'];
        $cartIds = $cartData['ids'];
        
        $coursesData = $this->getAvailableCourses($passedIds, $cartIds, $user, $profileData['total_passed_hours']);

        return [
            'profile' => $profileData,
            'cart' => $cartData,
            'available_courses' => $coursesData['available'],
            'locked_courses' => $coursesData['locked'],
        ];
    }

    /**
     * Intent-aware retrieval on top of gather().
     *
     * gather() stays byte-for-byte what it was — every existing caller keeps its
     * behaviour — and this method shapes the SAME data for a specific question:
     * courses the student actually named come first, the pool is trimmed to what
     * the intent can use, and the result says where each part came from and how
     * complete it is.
     *
     * No extra queries: gather() is cached, and everything here is post-processing.
     *
     * @param array{
     *     intent?: string,
     *     entities?: array{course_ids?: int[]},
     *     top_k?: int,
     *     include_locked?: bool
     * } $options
     */
    public function gatherFor(User $user, array $options = []): array
    {
        $base = $this->gather($user);

        $intent = (string) ($options['intent'] ?? 'unknown');
        $entityIds = array_map('intval', $options['entities']['course_ids'] ?? []);
        $topK = (int) ($options['top_k'] ?? $this->topKFor($intent));

        // Major and study-plan isolation is enforced by the query in
        // getAvailableCourses(); this is a second, cheap assertion of it so a
        // future change there cannot silently widen what the model sees.
        $planVersion = (int) ($user->study_plan_version ?? 12);
        $available = $this->isolate($base['available_courses'], $user, $planVersion);
        $locked = $this->isolate($base['locked_courses'], $user, $planVersion);

        // Courses the student named are the point of the question: they lead, and
        // they are never trimmed away by the top-K cut.
        $named = [];
        $rest = [];
        foreach ($available as $course) {
            if (in_array((int) $course['id'], $entityIds, true)) {
                $named[] = $course;
            } else {
                $rest[] = $course;
            }
        }

        $pool = array_merge($named, array_slice($rest, 0, max(0, $topK - count($named))));

        // A locked course the student asked about explains itself ("why can't I
        // take this?"), so it is surfaced even though it is not registrable.
        $namedLocked = array_values(array_filter(
            $locked,
            fn ($course) => in_array((int) $course['id'], $entityIds, true)
        ));

        return array_merge($base, [
            'intent' => $intent,
            'available_courses' => $pool,
            'locked_courses' => ($options['include_locked'] ?? true)
                ? array_merge($namedLocked, array_slice(
                    array_values(array_filter($locked, fn ($c) => !in_array((int) $c['id'], $entityIds, true))),
                    0,
                    self::LOCKED_POOL_LIMIT
                ))
                : $namedLocked,
            'named_courses' => $named,
            'named_locked_courses' => $namedLocked,
            'total_available_count' => count($available),
            'truncated' => count($available) > count($pool),
            'sources' => $this->sourcesFor($intent, $base, $pool),
            'completeness' => $this->completenessFor($base, $intent),
        ]);
    }

    /** How many candidate courses this kind of question can actually use. */
    private function topKFor(string $intent): int
    {
        return match ($intent) {
            'course_recommendation', 'semester_planning' => 12,
            'graduation_planning' => 14,
            'compare_courses', 'course_question', 'prerequisite_check' => 8,
            'cart_review', 'gpa_analysis', 'gpa_goal' => 6,
            'academic_policy', 'campus_location', 'calendar_question',
            'instructor_question', 'section_question', 'general_question' => 3,
            default => 10,
        };
    }

    /**
     * Keep only courses belonging to this student's plan.
     *
     * The pool arrives already scoped; entries without the scoping fields (the
     * shape gather() returns does not carry them) are kept, because dropping them
     * would silently empty the pool.
     */
    private function isolate(array $courses, User $user, int $planVersion): array
    {
        $collegeId = $user->major?->college_id;

        return array_values(array_filter($courses, function ($course) use ($user, $collegeId, $planVersion) {
            if (!is_array($course)) {
                return false;
            }
            if (array_key_exists('study_plan_version', $course) && (int) $course['study_plan_version'] !== $planVersion) {
                return false;
            }
            if (array_key_exists('major_id', $course) && $course['major_id'] !== null) {
                return (int) $course['major_id'] === (int) $user->major_id;
            }
            if (array_key_exists('college_id', $course) && $course['college_id'] !== null && $collegeId !== null) {
                return (int) $course['college_id'] === (int) $collegeId;
            }

            return true;
        }));
    }

    /**
     * Where the answer's facts come from, as data the UI can cite.
     *
     * Only sources that actually contributed are listed — an empty cart produces
     * no cart source — so "no sources" is meaningful rather than decorative.
     */
    private function sourcesFor(string $intent, array $base, array $pool): array
    {
        $sources = [];

        if ($pool !== []) {
            $sources[] = [
                'type' => 'study_plan',
                'label' => 'خطتك الدراسية',
                'entity_ids' => array_map(fn ($course) => (int) $course['id'], $pool),
            ];
        }

        if (!empty($base['cart']['ids'])) {
            $sources[] = [
                'type' => 'cart',
                'label' => 'تسجيلك التجريبي',
                'entity_ids' => array_map('intval', $base['cart']['ids']),
            ];
        }

        if (!empty($base['profile']['passed_course_ids'])) {
            $sources[] = [
                'type' => 'transcript',
                'label' => 'سجلك الأكاديمي',
                'entity_ids' => array_map('intval', $base['profile']['passed_course_ids']),
            ];
        }

        if (in_array($intent, ['gpa_analysis', 'gpa_goal', 'semester_planning', 'graduation_planning'], true)) {
            $sources[] = [
                'type' => 'academic_rules',
                'label' => 'أنظمة الساعات والحدود',
                'entity_ids' => [],
            ];
        }

        return $sources;
    }

    /**
     * What is known and what is missing.
     *
     * This deployment has no academic-calendar, sections/instructors or campus
     * directory tables, so questions about them cannot be grounded. Saying so is
     * the point: the alternative is the model answering from general knowledge.
     */
    private function completenessFor(array $base, string $intent): array
    {
        $completeness = [
            'has_academic_records' => (bool) ($base['profile']['has_academic_records'] ?? false),
            'has_cart' => !empty($base['cart']['ids'] ?? []),
            'available_course_count' => count($base['available_courses'] ?? []),
            'has_calendar_data' => false,
            'has_section_data' => true,
            'has_directory_data' => false,
        ];

        $completeness['grounded'] = match ($intent) {
            'calendar_question' => $completeness['has_calendar_data'],
            'section_question', 'instructor_question' => $completeness['has_section_data'],
            'gpa_analysis', 'gpa_goal' => $completeness['has_academic_records'],
            'cart_review' => $completeness['has_cart'],
            default => true,
        };

        return $completeness;
    }

    private function getStudentAcademicData(User $user): array
    {
        $cacheKey = AcademicCache::key("student_academic_data_{$user->id}");
        return Cache::remember($cacheKey, 600, function() use ($user) {
            $user->loadMissing(['major', 'passedCourses', 'cartCourses']);
            
            $actuallyPassedCourses = $user->passedCourses->filter(function($course) {
                $grade = $course->pivot->grade;
                return $grade === null || (float) $grade >= 50;
            });

            $gpaData = $user->calculateGPA();
            $hasAcademicRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
            $isProbation = $hasAcademicRecords && isset($gpaData['percentage']) && (float) $gpaData['percentage'] < 60;

            return [
                'student_name' => $user->name,
                'major_name' => $user->major?->name ?? 'تخصص عام',
                'college_id' => $user->major?->college_id,
                'gpa_data' => $gpaData,
                'is_probation' => $isProbation,
                'has_academic_records' => $hasAcademicRecords,
                'passed_course_ids' => $actuallyPassedCourses->pluck('id')->toArray(),
                'passed_courses_names' => $actuallyPassedCourses->pluck('name')->implode('، '),
                'total_passed_hours' => $actuallyPassedCourses->sum('credit_hours'),
                'total_plan_hours' => $user->major && method_exists($user->major, 'getTotalHours') ? $user->major->getTotalHours() : 132,
                'passed_university_req' => $actuallyPassedCourses->where('type', 'university_req')->sum('credit_hours'),
                'passed_compulsory' => $actuallyPassedCourses->where('type', 'compulsory')->sum('credit_hours'),
                'passed_elective' => $actuallyPassedCourses->where('type', 'elective')->sum('credit_hours'),
                'passed_supporting' => $actuallyPassedCourses->where('type', 'supporting')->sum('credit_hours'),
            ];
        });
    }

    private function getCartData(User $user): array
    {
        $cacheKey = AcademicCache::key("student_cart_data_{$user->id}");
        return Cache::remember($cacheKey, 600, function() use ($user) {
            $user->loadMissing('cartCourses');
            $cartCourses = app(\App\Services\CourseIdentityService::class)
                ->deduplicateCourses($user->cartCourses);
            $map = $cartCourses->pluck('name', 'id')->toArray();

            return [
                'ids' => array_keys($map),
                'map' => $map,
                'list' => implode(' | ', $map),
                'hours' => $cartCourses->sum('credit_hours'),
            ];
        });
    }

    private function getAvailableCourses(array $passedCourseIds, array $cartCourseIds, User $user, int $passedHours): array
    {
        $currentPeriod = AcademicPeriod::current();
        $passedHash = md5(implode(',', $passedCourseIds) . '|' . implode(',', $cartCourseIds));
        $cacheKey = AcademicCache::key("rag_available_courses:{$user->id}:{$user->major_id}:{$user->study_plan_version}:{$passedHash}");

        return Cache::remember($cacheKey, 300, function () use ($passedCourseIds, $cartCourseIds, $user, $passedHours, $currentPeriod) {
            $planVersion = (int) ($user->study_plan_version ?? 12);

            $courses = Course::with(['prerequisites', 'children'])
                ->where(function ($query) use ($user, $planVersion) {
                    if ($user->major_id) {
                        $collegeId = $user->major ? $user->major->college_id : null;
                        
                        $query->where(function ($majorScope) use ($user, $planVersion) {
                            $majorScope->where('major_id', $user->major_id)
                                ->where('study_plan_version', $planVersion);
                        })->orWhere(function ($collegeScope) use ($collegeId, $planVersion) {
                            if ($collegeId) {
                                $collegeScope->whereNull('major_id')
                                    ->where('college_id', $collegeId)
                                    ->where('study_plan_version', $planVersion);
                            } else {
                                $collegeScope->whereRaw('1 = 0');
                            }
                        })->orWhere(function ($universityScope) use ($planVersion) {
                            $universityScope->whereNull('major_id')
                                ->whereNull('college_id')
                                ->where('study_plan_version', $planVersion);
                        });
                    } else {
                        $query->whereNull('major_id')
                            ->whereNull('college_id')
                            ->where('study_plan_version', $planVersion);
                    }
                })
                ->whereNotIn('id', $passedCourseIds)
                ->get();

            $availableDetails = [];
            $lockedDetails = [];
            
            // Deduplicate logic
            $seenNames = [];
            $user->passedCourses->each(function($course) use (&$seenNames) {
                $grade = $course->pivot->grade;
                if ($grade === null || (float) $grade >= 50) {
                    $normName = $this->normalizeArabic($course->name);
                    $strictName = str_replace('ال', '', $normName);
                    $seenNames[$strictName] = true;
                }
            });

            $year = $currentPeriod ? $currentPeriod->academic_year : '2026/2027';
            $term = $currentPeriod ? (int) $currentPeriod->academic_term : 1;

            $sectionsByCourse = Cache::remember(
                "course_sections_{$year}_{$term}",
                3600,
                function () use ($year, $term) {
                    $sections = \App\Models\CourseSection::where('academic_year', $year)
                        ->where('academic_term', $term)
                        ->get();

                    if ($sections->isEmpty()) {
                        $sections = \App\Models\CourseSection::all();
                    }

                    return $sections->groupBy('course_id');
                }
            );

            foreach ($courses as $c) {
                $normName = $this->normalizeArabic($c->name);
                $strictName = str_replace('ال', '', $normName);
                if (isset($seenNames[$strictName])) continue;
                $seenNames[$strictName] = true;

                $unmetPrereqs = [];
                foreach ($c->prerequisites as $prereq) {
                    if (!in_array($prereq->id, $passedCourseIds)) {
                        $unmetPrereqs[] = $prereq->name;
                    }
                }

                $lockedByHours = false;
                if ($c->minimum_passed_hours !== null && $passedHours < $c->minimum_passed_hours) {
                    $lockedByHours = true;
                    $unmetPrereqs[] = "تحتاج {$c->minimum_passed_hours} ساعة لفتحها";
                }

                $sectionsList = [];
                $scheduleString = '';
                if (isset($sectionsByCourse[$c->id]) && $sectionsByCourse[$c->id]->isNotEmpty()) {
                    foreach ($sectionsByCourse[$c->id] as $sec) {
                        $sectionsList[] = [
                            'instructor' => $sec->instructor ?: 'غير محدد',
                            'days' => $sec->days ?: '',
                            'time' => $sec->time ?: '',
                            'hall' => $sec->hall ?: '',
                            'capacity' => $sec->capacity,
                        ];
                    }
                    $sectionStrs = array_map(
                        fn($sec) => "[{$sec['instructor']}|{$sec['days']}|{$sec['time']}|{$sec['hall']}]",
                        $sectionsList
                    );
                    $scheduleString = implode(',', $sectionStrs);
                }

                $courseInfo = [
                    'id' => $c->id,
                    'name' => $c->name,
                    'type' => $c->type,
                    'credit_hours' => $c->credit_hours,
                    'difficulty_level' => $c->difficulty_level,
                    'unlocks_count' => $c->children->count(),
                    'unlocks_courses' => $c->children->pluck('name')->toArray(),
                    'prereq_count' => $c->prerequisites->count(),
                    'prereqs' => $c->prerequisites->pluck('name')->toArray(),
                    'course_year' => $c->semester ? ceil($c->semester / 2) : 1,
                    'course_semester' => $c->semester ?: null,
                    'sections' => $sectionsList,
                    'schedule_info' => $scheduleString,
                ];

                if (empty($unmetPrereqs) && !$lockedByHours) {
                    if (!in_array($c->id, $cartCourseIds)) {
                        $availableDetails[] = $courseInfo;
                    }
                } else {
                    $courseInfo['reasons'] = $unmetPrereqs;
                    $lockedDetails[] = $courseInfo;
                }
            }

            return [
                'available' => $availableDetails,
                'locked' => $lockedDetails,
            ];
        });
    }

    private function normalizeArabic(string $text): string
    {
        $text = str_replace(['أ', 'إ', 'آ'], 'ا', $text);
        $text = str_replace(['ة'], 'ه', $text);
        $text = str_replace(['ى'], 'ي', $text);
        $text = preg_replace('/[^\p{Arabic}a-zA-Z0-9]/u', '', $text);
        return trim($text);
    }
}
