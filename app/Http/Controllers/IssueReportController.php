<?php

namespace App\Http\Controllers;

use App\Models\IssueReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use App\Services\BrevoMailer;

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

        $issue = IssueReport::create([
            'user_id' => $request->user()->id,
            'category' => $data['category'],
            'subject' => $data['subject'],
            'message' => $data['message'],
            'priority' => $data['priority'],
            'status' => 'open',
            'page_url' => $data['page_url'] ?? null,
            'user_agent' => (string) $request->userAgent(),
        ]);

        $this->notifySupport($issue);

        return redirect()->route('support.issue.create')->with([
            'message' => 'تم إرسال البلاغ بنجاح. سيقوم فريق الإدارة بمراجعته قريبًا.',
            'type' => 'success',
        ]);
    }

    private function notifySupport(IssueReport $issue): void
    {
        $receiver = (string) (config('mail.support_address') ?: config('mail.from.address'));
        $apiKey = (string) config('services.brevo.key', '');

        if ($receiver === '' || $apiKey === '') {
            return;
        }

        $subject = 'بلاغ فني جديد #' . $issue->id . ' - ' . $issue->category;
        
        $url = $issue->page_url ?: 'غير متوفر';
        $priorityLabels = ['low' => 'منخفضة', 'medium' => 'متوسطة', 'high' => 'عاجلة'];
        $priority = $priorityLabels[$issue->priority] ?? $issue->priority;

        $html = "
        <div style='font-family:Arial,sans-serif;line-height:1.7;color:#0f172a'>
            <h2 style='margin-bottom:10px;'>بلاغ فني جديد</h2>
            <p><strong>الرقم:</strong> #{$issue->id}</p>
            <p><strong>القسم:</strong> {$issue->category}</p>
            <p><strong>الأولوية:</strong> {$priority}</p>
            <p><strong>العنوان:</strong> {$issue->subject}</p>
            <p><strong>التفاصيل:</strong><br>{$issue->message}</p>
            <p><strong>الرابط المتأثر:</strong> {$url}</p>
        </div>
        ";

        try {
            BrevoMailer::send($receiver, $subject, $html);
        } catch (\Throwable $exception) {
            Log::warning('Failed to send issue report notification.', [
                'issue_id' => $issue->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
