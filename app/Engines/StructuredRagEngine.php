<?php

namespace App\Engines;

use App\Models\User;
use App\Models\Course;
use App\Models\AcademicPeriod;
use Illuminate\Support\Facades\Cache;

class StructuredRagEngine
{
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

    private function getStudentAcademicData(User $user): array
    {
        $cacheKey = "student_academic_data_{$user->id}";
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
        $cacheKey = "student_cart_data_{$user->id}";
        return Cache::remember($cacheKey, 600, function() use ($user) {
            $user->loadMissing('cartCourses');
            $map = $user->cartCourses->pluck('name', 'id')->toArray();

            return [
                'ids' => array_keys($map),
                'map' => $map,
                'list' => implode(' | ', $map),
                'hours' => $user->cartCourses->sum('credit_hours'),
            ];
        });
    }

    private function getAvailableCourses(array $passedCourseIds, array $cartCourseIds, User $user, int $passedHours): array
    {
        $currentPeriod = AcademicPeriod::current();
        $passedHash = md5(implode(',', $passedCourseIds) . '|' . implode(',', $cartCourseIds));
        $cacheKey = "rag_available_courses:{$user->id}:{$user->major_id}:{$user->study_plan_version}:{$passedHash}";

        return Cache::remember($cacheKey, 300, function () use ($passedCourseIds, $cartCourseIds, $user, $passedHours) {
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
