<?php

namespace Tests\Unit;

use App\Models\Course;
use App\Services\CourseIdentityService;
use PHPUnit\Framework\TestCase;

class CourseIdentityServiceTest extends TestCase
{
    private CourseIdentityService $identity;

    protected function setUp(): void
    {
        parent::setUp();
        $this->identity = new CourseIdentityService;
    }

    public function test_it_normalizes_arabic_spelling_and_merges_close_course_names(): void
    {
        $first = $this->course(1, 'إدارة مشروع البرمجيات', 'CS401');
        $second = $this->course(2, 'ادارة مشاريع البرمجيات', 'SE401');

        $this->assertTrue($this->identity->same($first, $second));
    }

    public function test_it_does_not_merge_numbered_or_semantically_different_courses(): void
    {
        $this->assertFalse($this->identity->same(
            $this->course(1, 'برمجة 1', 'CS101'),
            $this->course(2, 'برمجة 2', 'CS102'),
        ));

        $this->assertFalse($this->identity->same(
            $this->course(3, 'قواعد البيانات', 'CS220'),
            $this->course(4, 'مختبر قواعد البيانات', 'CS221'),
        ));
    }

    public function test_identical_codes_are_authoritative_across_majors(): void
    {
        $this->assertTrue($this->identity->same(
            $this->course(1, 'مهارات الحاسوب', 'UC100'),
            $this->course(2, 'مهارات حاسوبية', 'UC-100'),
        ));
    }

    private function course(int $id, string $name, string $code): Course
    {
        $course = new Course(['name' => $name, 'code' => $code]);
        $course->id = $id;

        return $course;
    }
}
