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
use Illuminate\Support\Str;
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

            DB::transaction(function () use ($user, $validated, $studentData, $courses): void {
                $this->syncUserAcademicProfile($user, $validated['student_id'], $studentData, $courses);
                $this->syncPassedCourses($user, $courses);
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
                ]);
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
     * @param array<int, array{course_name:string, grade:?float, grade_raw:?string, credits:?float}> $courses
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
            && Schema::hasTable('majors')
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
     * @param array<int, array{course_name:string, grade:?float, grade_raw:?string, credits:?float}> $courses
     */
    private function syncPassedCourses(User $user, array $courses): void
    {
        if (!Schema::hasTable('courses') || !Schema::hasTable('course_user')) {
            return;
        }

        $courseColumns = array_flip(Schema::getColumnListing('courses'));
        $pivotColumns = array_flip(Schema::getColumnListing('course_user'));

        $majorId = $user->major_id;
        $studyPlanVersion = (int) ($user->study_plan_version ?? 12);

        foreach ($courses as $courseData) {
            $courseName = trim((string) ($courseData['course_name'] ?? ''));
            if ($courseName === '') {
                continue;
            }

            $credits = max(0, (int) round((float) ($courseData['credits'] ?? 0)));
            $courseCode = $this->buildCourseCode($courseName, $majorId, $studyPlanVersion);

            $lookup = ['code' => $courseCode];
            if (isset($courseColumns['major_id'])) {
                $lookup['major_id'] = $majorId;
            }
            if (isset($courseColumns['study_plan_version'])) {
                $lookup['study_plan_version'] = $studyPlanVersion;
            }

            $create = [
                'name' => $courseName,
                'credit_hours' => $credits,
            ];

            if (isset($courseColumns['type'])) {
                $create['type'] = 'compulsory';
            }
            if (isset($courseColumns['semester'])) {
                $create['semester'] = null;
            }
            if (isset($courseColumns['minimum_passed_hours'])) {
                $create['minimum_passed_hours'] = 0;
            }

            $course = Course::query()->firstOrCreate($lookup, $create);

            $updates = [];
            if (isset($courseColumns['name']) && $course->name !== $courseName) {
                $updates['name'] = $courseName;
            }
            if (isset($courseColumns['credit_hours']) && (int) $course->credit_hours !== $credits) {
                $updates['credit_hours'] = $credits;
            }

            if (!empty($updates)) {
                $course->fill($updates);
                $course->save();
            }

            $pivotData = [];
            if (isset($pivotColumns['grade'])) {
                $pivotData['grade'] = $courseData['grade'];
            }
            if (isset($pivotColumns['studied_semester'])) {
                $pivotData['studied_semester'] = null;
            }
            if (isset($pivotColumns['studied_year'])) {
                $pivotData['studied_year'] = null;
            }
            if (isset($pivotColumns['studied_term'])) {
                $pivotData['studied_term'] = null;
            }

            $user->passedCourses()->syncWithoutDetaching([
                $course->id => $pivotData,
            ]);
        }
    }

    private function buildCourseCode(string $courseName, $majorId, int $studyPlanVersion): string
    {
        $asciiName = Str::ascii($courseName);
        $slug = Str::upper(Str::slug($asciiName, '_'));

        if ($slug === '') {
            $slug = 'COURSE';
        }

        $slug = substr($slug, 0, 16);
        $hash = substr(md5($courseName.'|'.(string) $majorId.'|'.$studyPlanVersion), 0, 8);

        return 'ZU_'.$slug.'_'.$hash;
    }
}
