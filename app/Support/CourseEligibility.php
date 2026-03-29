<?php

namespace App\Support;

use App\Models\Course;
use Illuminate\Support\Str;

class CourseEligibility
{
    /**
     * Resolve minimum passed hours required to unlock a course.
     */
    public static function minimumPassedHoursForCourse(Course $course): ?int
    {
        $directMinimum = $course->minimum_passed_hours !== null
            ? (int) $course->minimum_passed_hours
            : null;

        if ($directMinimum !== null && $directMinimum > 0) {
            return $directMinimum;
        }

        $name = Str::lower(trim((string) ($course->name ?? '')));
        $code = Str::upper(trim((string) ($course->code ?? '')));
        $rules = config('course_eligibility.hour_rules', []);

        foreach ($rules as $rule) {
            $minimum = (int) ($rule['minimum_passed_hours'] ?? 0);
            if ($minimum <= 0) {
                continue;
            }

            $keywords = array_map(static fn ($value) => Str::lower((string) $value), (array) ($rule['keywords'] ?? []));
            foreach ($keywords as $keyword) {
                if ($keyword !== '' && Str::contains($name, $keyword)) {
                    return $minimum;
                }
            }

            $exactCodes = array_map(static fn ($value) => Str::upper((string) $value), (array) ($rule['codes'] ?? []));
            if ($code !== '' && in_array($code, $exactCodes, true)) {
                return $minimum;
            }

            $prefixes = array_map(static fn ($value) => Str::upper((string) $value), (array) ($rule['code_prefixes'] ?? []));
            foreach ($prefixes as $prefix) {
                if ($prefix !== '' && Str::startsWith($code, $prefix)) {
                    return $minimum;
                }
            }
        }

        return null;
    }

    /**
     * Check whether a course is still locked by the passed-hours rule.
     */
    public static function isLockedByPassedHours(Course $course, int $passedHours): bool
    {
        $minimum = self::minimumPassedHoursForCourse($course);

        return $minimum !== null && $passedHours < $minimum;
    }
}
