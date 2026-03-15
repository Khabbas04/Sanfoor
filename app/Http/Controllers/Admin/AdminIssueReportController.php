<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\IssueReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminIssueReportController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->query('status');

        $issuesQuery = IssueReport::query()
            ->with('user:id,name,email')
            ->latest();

        if (in_array($status, ['open', 'in_progress', 'resolved'], true)) {
            $issuesQuery->where('status', $status);
        }

        $issues = $issuesQuery->get();

        return Inertia::render('Admin/Issues/Index', [
            'issues' => $issues,
            'filters' => [
                'status' => $status,
            ],
            'summary' => [
                'open' => IssueReport::where('status', 'open')->count(),
                'in_progress' => IssueReport::where('status', 'in_progress')->count(),
                'resolved' => IssueReport::where('status', 'resolved')->count(),
                'total' => IssueReport::count(),
            ],
        ]);
    }

    public function updateStatus(Request $request, IssueReport $issueReport): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:open,in_progress,resolved'],
        ]);

        $issueReport->update([
            'status' => $data['status'],
        ]);

        return back()->with([
            'message' => 'تم تحديث حالة البلاغ.',
            'type' => 'success',
        ]);
    }
}
