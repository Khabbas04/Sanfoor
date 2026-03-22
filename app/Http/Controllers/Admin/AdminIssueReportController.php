<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\IssueReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminIssueReportController extends Controller
{
    private function logAction(string $action, string $details): void
    {
        AdminLog::create([
            'user_id' => auth()->id(),
            'action' => $action,
            'details' => $details,
            'ip_address' => request()->ip(),
        ]);
    }

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

        $this->logAction('UPDATE_ISSUE_STATUS', "تم تحديث حالة البلاغ #{$issueReport->id} إلى {$data['status']}");

        return back()->with([
            'message' => 'تم تحديث حالة البلاغ.',
            'type' => 'success',
        ]);
    }

    public function destroy(IssueReport $issueReport): RedirectResponse
    {
        $issueId = $issueReport->id;
        $issueReport->delete();

        $this->logAction('DELETE_ISSUE_REPORT', "تم حذف البلاغ #{$issueId}");

        return back()->with([
            'message' => 'تم حذف البلاغ بنجاح.',
            'type' => 'success',
        ]);
    }
}
