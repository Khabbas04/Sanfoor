<?php

namespace App\Http\Controllers;

use App\Models\IssueReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IssueReportController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('Support/ReportIssue', [
            'current_url' => url()->previous(),
            'categories' => [
                'tree' => 'الخطة الشجرية',
                'calculator' => 'حاسبة التفوق',
                'ai' => 'المستشار الذكي',
                'account' => 'الحساب والتسجيل',
                'performance' => 'بطء أو تعليق',
                'other' => 'مشكلة أخرى',
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'category' => ['required', 'in:tree,calculator,ai,account,performance,other'],
            'subject' => ['required', 'string', 'max:180'],
            'message' => ['required', 'string', 'min:15', 'max:3000'],
            'priority' => ['required', 'in:low,medium,high'],
            'page_url' => ['nullable', 'url', 'max:2048'],
        ]);

        IssueReport::create([
            'user_id' => $request->user()->id,
            'category' => $data['category'],
            'subject' => $data['subject'],
            'message' => $data['message'],
            'priority' => $data['priority'],
            'status' => 'open',
            'page_url' => $data['page_url'] ?? null,
            'user_agent' => (string) $request->userAgent(),
        ]);

        return redirect()->route('support.issue.create')->with([
            'message' => 'تم إرسال البلاغ بنجاح. سيقوم فريق الإدارة بمراجعته قريبًا.',
            'type' => 'success',
        ]);
    }
}
