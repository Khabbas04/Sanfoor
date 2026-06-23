<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Major;
use App\Models\User;
use App\Services\UniversityScraperService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class PortalSyncController extends Controller
{
    public function sync(Request $request, UniversityScraperService $scraper): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'student_id' => ['required', 'string', 'max:50'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        /** @var User|null $user */
        $user = $request->user();
        if (!$user) {
            abort(401);
        }

        try {
            $scraper->login($validated['student_id'], $validated['password']);
            $studentData = $scraper->getStudentData();
            $courses = $scraper->getCourses();

            $hasProfileData = filled($studentData['name'] ?? null)
                || filled($studentData['major'] ?? null)
                || (($studentData['gpa'] ?? null) !== null);

            if (!$hasProfileData && count($courses) === 0) {
                throw new RuntimeException('تم تسجيل الدخول إلى البوابة، لكن تعذر قراءة بيانات الطالب والمواد. غالباً شكل الصفحة تغيّر ويحتاج تحديث parser.');
            }

            if ((bool) config('services.zu_portal.debug', false)) {
                Log::info('Portal sync extraction summary', [
                    'user_id' => $user->id,
                    'student' => $studentData,
                    'courses_count' => count($courses),
                    'courses_sample' => array_slice($courses, 0, 5),
                ]);
            }

            $syncStats = ['matched' => 0, 'skipped' => 0];

            DB::transaction(function () use ($user, $validated, $studentData, $courses, &$syncStats): void {
                $this->syncUserAcademicProfile($user, $validated['student_id'], $studentData, $courses);
                $syncStats = $this->syncPassedCourses($user, $courses);
            });

            $message = 'تمت مزامنة بيانات بوابة الجامعة بنجاح.';
            $missingParts = [];
            if (blank($studentData['major'] ?? null)) {
                $missingParts[] = 'التخصص';
            }
            if (($studentData['gpa'] ?? null) === null) {
                $missingParts[] = 'المعدل';
            }
            if (count($courses) === 0) {
                $missingParts[] = 'المواد';
            }

            if (!empty($missingParts)) {
                $message .= ' (ملاحظة: لم يتم العثور على '.implode(' و', $missingParts).' في الصفحة الحالية.)';
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $message,
                    'student' => $studentData,
                    'courses_synced' => count($courses),
                    'courses_matched' => $syncStats['matched'],
                    'courses_skipped' => $syncStats['skipped'],
                ]);
            }

            $message .= ' تم تعليم '.$syncStats['matched'].' مادة كمنجزة من مواد الشجرة.';
            if ($syncStats['skipped'] > 0) {
                $message .= ' وتجاهل '.$syncStats['skipped'].' مادة لأنها غير موجودة في الشجرة الحالية.';
            }

            return redirect()->route('profile.edit')->with('status', $message);
        } catch (Throwable $exception) {
            Log::warning('Portal sync failed', [
                'user_id' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            $errorMessage = $exception->getMessage() !== ''
                ? $exception->getMessage()
                : 'فشلت مزامنة بيانات البوابة. تحقق من الرقم الجامعي وكلمة المرور.';

            if ($request->expectsJson()) {
                return response()->json(['message' => $errorMessage], 422);
            }

            return redirect()->route('profile.edit')
                ->withErrors(['portal_sync' => $errorMessage])
                ->with('status', $errorMessage);
        }
    }

    /**
     * @param array{name:?string, major:?string, gpa:?float, gpa_raw:?string} $studentData
      * @param array<int, array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float, studied_year:?int, studied_term:?int}> $courses
     */
    private function syncUserAcademicProfile(User $user, string $studentId, array $studentData, array $courses): void
    {
        $columns = array_flip(Schema::getColumnListing('users'));

        $payload = [];

        if (isset($columns['name']) && filled($studentData['name'] ?? null)) {
            $payload['name'] = trim((string) $studentData['name']);
        }

        if (isset($columns['portal_student_id'])) {
            $payload['portal_student_id'] = trim($studentId);
        }

        if (isset($columns['portal_major_name']) && filled($studentData['major'] ?? null)) {
            $payload['portal_major_name'] = trim((string) $studentData['major']);
        }

        if (isset($columns['portal_gpa']) && ($studentData['gpa'] ?? null) !== null) {
            $payload['portal_gpa'] = (float) $studentData['gpa'];
        }

        if (isset($columns['portal_passed_hours'])) {
            $payload['portal_passed_hours'] = (int) round(array_sum(array_map(
                fn (array $course) => (float) ($course['credits'] ?? 0),
                $courses
            )));
        }

        if (isset($columns['portal_synced_at'])) {
            $payload['portal_synced_at'] = now();
        }

        if (
            isset($columns['major_id'])
            && filled($studentData['major'] ?? null)
        ) {
            $majorName = trim((string) $studentData['major']);
            $major = Major::query()
                ->whereRaw('LOWER(name) = ?', [mb_strtolower($majorName)])
                ->first();

            if (!$major) {
                $major = Major::query()
                    ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($majorName).'%'])
                    ->first();
            }

            if ($major) {
                $payload['major_id'] = $major->id;
            }
        }

        if (isset($columns['study_plan_version']) && blank($user->study_plan_version)) {
            $payload['study_plan_version'] = 12;
        }

        if (!empty($payload)) {
            $user->newQuery()->whereKey($user->id)->update($payload);
            $user->refresh();
        }
    }

    /**
    * @param array<int, array{course_name:string, course_code:?string, grade:?float, grade_raw:?string, credits:?float, studied_year:?int, studied_term:?int}> $courses
     * @return array{matched:int, skipped:int}
     */
    private function syncPassedCourses(User $user, array $courses): array
    {

        $pivotColumns = array_flip(Schema::getColumnListing('course_user'));

        $majorId = $user->major_id;
        $studyPlanVersion = (int) ($user->study_plan_version ?? 12);

        $treeCourses = Course::query()
            ->select('id', 'code', 'name', 'major_id', 'study_plan_version')
            ->where(function ($query) use ($majorId, $studyPlanVersion) {
                if ($majorId) {
                    $query->where(function ($majorScope) use ($majorId, $studyPlanVersion) {
                        $majorScope->where('major_id', $majorId)
                            ->where('study_plan_version', $studyPlanVersion);
                    })->orWhere(function ($universityScope) use ($studyPlanVersion) {
                        $universityScope->whereNull('major_id')
                            ->where('study_plan_version', $studyPlanVersion);
                    });

                    return;
                }

                $query->whereNull('major_id')
                    ->where('study_plan_version', $studyPlanVersion);
            })
            ->get();

        $coursesByCode = [];
        $coursesByName = [];

        foreach ($treeCourses as $treeCourse) {
            $codeKey = $this->normalizeCourseCode((string) ($treeCourse->code ?? ''));
            if ($codeKey !== '') {
                $coursesByCode[$codeKey] = $treeCourse;
            }

            $nameKey = $this->normalizeCourseName((string) ($treeCourse->name ?? ''));
            if ($nameKey !== '' && !isset($coursesByName[$nameKey])) {
                $coursesByName[$nameKey] = $treeCourse;
            }
        }

        $matched = 0;
        $skipped = 0;

        foreach ($courses as $courseData) {
            $courseName = trim((string) ($courseData['course_name'] ?? ''));
            if ($courseName === '') {
                continue;
            }

            $course = null;

            $incomingCode = $this->normalizeCourseCode((string) ($courseData['course_code'] ?? ''));
            if ($incomingCode !== '' && isset($coursesByCode[$incomingCode])) {
                $course = $coursesByCode[$incomingCode];
            }

            if (!$course) {
                $incomingNameKey = $this->normalizeCourseName($courseName);
                if ($incomingNameKey !== '' && isset($coursesByName[$incomingNameKey])) {
                    $course = $coursesByName[$incomingNameKey];
                }
            }

            if (!$course) {
                $incomingNameKey = $this->normalizeCourseName($courseName);

                foreach ($coursesByName as $existingNameKey => $existingCourse) {
                    if (
                        $incomingNameKey !== ''
                        && (
                            str_contains($existingNameKey, $incomingNameKey)
                            || str_contains($incomingNameKey, $existingNameKey)
                        )
                    ) {
                        $course = $existingCourse;
                        break;
                    }
                }
            }

            if (!$course) {
                $skipped++;
                continue;
            }

            $studiedYear = $this->normalizeStudiedYear((string) ($courseData['studied_year'] ?? ''));
            $studiedTerm = $this->normalizeStudiedTerm((string) ($courseData['studied_term'] ?? ''));

            $pivotData = [];
            if (isset($pivotColumns['grade'])) {
                $pivotData['grade'] = $courseData['grade'];
            }
            if (isset($pivotColumns['studied_semester'])) {
                $pivotData['studied_semester'] = $studiedTerm;
            }
            if (isset($pivotColumns['studied_year'])) {
                $pivotData['studied_year'] = $studiedYear;
            }
            if (isset($pivotColumns['studied_term'])) {
                $pivotData['studied_term'] = $studiedTerm;
            }

            $user->passedCourses()->syncWithoutDetaching([
                $course->id => $pivotData,
            ]);

            $matched++;
        }

        return [
            'matched' => $matched,
            'skipped' => $skipped,
        ];
    }

    private function normalizeCourseCode(string $value): string
    {
        $clean = strtoupper($this->toWesternDigits(trim($value)));

        return preg_replace('/[^A-Z0-9]/', '', $clean) ?? '';
    }

    private function normalizeCourseName(string $value): string
    {
        $clean = mb_strtolower(trim($value));
        $clean = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $clean) ?? '';
        $clean = preg_replace('/\s+/u', ' ', $clean) ?? '';

        return trim($clean);
    }

    private function normalizeStudiedYear(string $academicYear): ?int
    {
        $digits = preg_replace('/\D+/', '', $this->toWesternDigits($academicYear)) ?? '';
        if ($digits === '') {
            return null;
        }

        $number = (int) $digits;
        if ($number <= 255) {
            return $number;
        }

        return (int) substr($digits, -2);
    }

    private function normalizeStudiedTerm(string $academicTerm): ?int
    {
        $normalized = mb_strtolower(trim($academicTerm));

        if (in_array($normalized, ['1', '01', 'first', '1st', 'الاول', 'الأول'], true)) {
            return 1;
        }

        if (in_array($normalized, ['2', '02', 'second', '2nd', 'الثاني', 'ثاني'], true)) {
            return 2;
        }

        if (in_array($normalized, ['3', '03', 'summer', '3rd', 'صيفي', 'الثالث'], true)) {
            return 3;
        }

        $digits = preg_replace('/\D+/', '', $this->toWesternDigits($academicTerm)) ?? '';
        if ($digits !== '' && in_array((int) $digits, [1, 2, 3], true)) {
            return (int) $digits;
        }

        return null;
    }

    private function toWesternDigits(string $value): string
    {
        return strtr($value, [
            '٠' => '0',
            '١' => '1',
            '٢' => '2',
            '٣' => '3',
            '٤' => '4',
            '٥' => '5',
            '٦' => '6',
            '٧' => '7',
            '٨' => '8',
            '٩' => '9',
        ]);
    }
}
