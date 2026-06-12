<?php

namespace App\Http\Controllers;

use App\Models\ScheduleReview;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ScheduleReviewController extends Controller
{
    /**
     * Display a listing of the requests.
     */
    public function index()
    {
        $user = Auth::user();

        // Admin and Instructors can view requests.
        abort_unless($user->isAdminOrOwner() || $user->isInstructor(), 403);

        $reviews = ScheduleReview::with(['user:id,name,major_id', 'user.major:id,name'])
            ->orderByRaw("CASE WHEN status = 'pending' THEN 1 ELSE 2 END")
            ->latest()
            ->paginate(15);

        return Inertia::render('ScheduleReviews/Index', [
            'reviews' => $reviews,
        ]);
    }

    /**
     * Display the specified request details.
     */
    public function show(ScheduleReview $scheduleReview)
    {
        $user = Auth::user();
        abort_unless($user->isAdminOrOwner() || $user->isInstructor(), 403);

        $scheduleReview->load([
            'user:id,name,major_id,study_plan_version', 
            'user.major:id,name',
            'reviewer:id,name',
            'user.passedCourses' => function ($query) {
                $query->select('courses.id', 'courses.name', 'courses.code', 'courses.credit_hours', 'courses.type', 'courses.semester')
                    ->withPivot('grade');
            }
        ]);

        $student = $scheduleReview->user;
        $gpaData = $student->calculateGPA();

        return Inertia::render('ScheduleReviews/Show', [
            'schedule_review' => $scheduleReview,
            'student_stats' => [
                'gpa' => $gpaData['percentage'],
                'passed_hours' => $gpaData['completed_hours'],
                'major_name' => $student->major ? $student->major->name : 'غير محدد',
                'study_plan_version' => $student->study_plan_version,
            ],
            'passed_courses' => $student->passedCourses,
        ]);
    }

    /**
     * Submit feedback for a request.
     */
    public function submitFeedback(Request $request, ScheduleReview $scheduleReview)
    {
        $user = Auth::user();
        abort_unless($user->isAdminOrOwner() || $user->isInstructor(), 403);

        $request->validate([
            'feedback' => 'required|string|max:1000',
            'status' => 'required|in:reviewed,rejected',
        ]);

        $scheduleReview->update([
            'feedback' => $request->feedback,
            'status' => $request->status,
            'reviewed_by' => $user->id,
        ]);

        return redirect()->back()->with('success', 'تم إرسال التقييم للطالب بنجاح.');
    }
}
