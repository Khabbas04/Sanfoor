<?php

namespace App\Http\Controllers;

use App\Models\ContactMessage;
use App\Services\BrevoMailer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ContactMessageController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', 'max:180'],
            'phone' => ['nullable', 'string', 'max:40'],
            'subject' => ['required', 'string', 'min:5', 'max:180'],
            'message' => ['required', 'string', 'min:15', 'max:4000'],
            'source_page' => ['nullable', 'url', 'max:2048'],
        ]);

        $contact = ContactMessage::create([
            'user_id' => $request->user()?->id,
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'subject' => $data['subject'],
            'message' => $data['message'],
            'status' => 'new',
            'source_page' => $data['source_page'] ?? null,
            'ip_address' => (string) $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        $this->notifySupport($contact);

        return redirect()->route('public.contact')->with([
            'message' => 'تم إرسال رسالتك بنجاح. سنعود إليك في أقرب وقت.',
            'type' => 'success',
        ]);
    }

    private function notifySupport(ContactMessage $contact): void
    {
        $receiver = (string) (config('mail.support_address') ?: config('mail.from.address'));
        $apiKey = (string) config('services.brevo.key', '');

        if ($receiver === '' || $apiKey === '') {
            return;
        }

        $subject = 'رسالة تواصل جديدة #' . $contact->id;
        $html = $this->buildSupportEmailHtml($contact);

        try {
            BrevoMailer::send($receiver, $subject, $html);
        } catch (\Throwable $exception) {
            Log::warning('Failed to send contact message notification.', [
                'contact_message_id' => $contact->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function buildSupportEmailHtml(ContactMessage $contact): string
    {
        $phone = $contact->phone ?: 'غير متوفر';
        $source = $contact->source_page ?: 'غير متوفر';

        return "
        <div style='font-family:Arial,sans-serif;line-height:1.7;color:#0f172a'>
            <h2 style='margin-bottom:10px;'>رسالة تواصل جديدة</h2>
            <p><strong>الرقم:</strong> #{$contact->id}</p>
            <p><strong>الاسم:</strong> {$contact->name}</p>
            <p><strong>البريد:</strong> {$contact->email}</p>
            <p><strong>الهاتف:</strong> {$phone}</p>
            <p><strong>الموضوع:</strong> {$contact->subject}</p>
            <p><strong>الرسالة:</strong><br>{$contact->message}</p>
            <p><strong>الصفحة:</strong> {$source}</p>
        </div>
        ";
    }
}
