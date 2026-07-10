$course = \App\Models\Course::find(13);
if ($course) {
    $course->name = 'تحدي تجربة المنصة 🏆';
    $course->code = 'DEMO2026';
    $course->save();
    echo 'DB updated locally';
}
