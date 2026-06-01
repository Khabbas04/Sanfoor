<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StudentActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AdminStudentActivityLogController extends Controller
{
    /**
     * Display a listing of the student activity logs.
     */
    public function index(Request $request)
    {
        $query = StudentActivityLog::with(['user:id,name,portal_student_id,avatar', 'course:id,name,code,credit_hours']);

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('portal_student_id', 'like', "%{$search}%");
            });
        }

        if ($request->has('action') && $request->action) {
            $query->where('action', $request->action);
        }

        $logs = $query->latest()->paginate(20)->withQueryString();

        return Inertia::render('Admin/StudentLogs', [
            'logs' => $logs,
            'filters' => $request->only(['search', 'action']),
        ]);
    }
}
