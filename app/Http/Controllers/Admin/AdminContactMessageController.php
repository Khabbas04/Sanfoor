<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\ContactMessage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminContactMessageController extends Controller
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
        $status = (string) $request->query('status', '');

        $messagesQuery = ContactMessage::query()
            ->with('user:id,name,email')
            ->latest();

        if (in_array($status, ['new', 'in_progress', 'resolved'], true)) {
            $messagesQuery->where('status', $status);
        }

        $messages = $messagesQuery->get();

        return Inertia::render('Admin/ContactMessages/Index', [
            'messages' => $messages,
            'filters' => [
                'status' => $status,
            ],
            'summary' => [
                'new' => ContactMessage::where('status', 'new')->count(),
                'in_progress' => ContactMessage::where('status', 'in_progress')->count(),
                'resolved' => ContactMessage::where('status', 'resolved')->count(),
                'total' => ContactMessage::count(),
            ],
        ]);
    }

    public function updateStatus(Request $request, ContactMessage $contactMessage): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:new,in_progress,resolved'],
        ]);

        $contactMessage->update([
            'status' => $data['status'],
        ]);

        $this->logAction('UPDATE_CONTACT_MESSAGE_STATUS', "تم تحديث حالة رسالة التواصل #{$contactMessage->id} إلى {$data['status']}");

        return back()->with([
            'message' => 'تم تحديث حالة طلب التواصل.',
            'type' => 'success',
        ]);
    }

    public function destroy(ContactMessage $contactMessage): RedirectResponse
    {
        $messageId = $contactMessage->id;
        $contactMessage->delete();

        $this->logAction('DELETE_CONTACT_MESSAGE', "تم حذف رسالة التواصل #{$messageId}");

        return back()->with([
            'message' => 'تم حذف طلب التواصل بنجاح.',
            'type' => 'success',
        ]);
    }
}
