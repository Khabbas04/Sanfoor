<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class BrevoMailer
{
    public static function send(string $to, string $subject, string $html): void
    {
        Http::withHeaders([
            'api-key'      => env('BREVO_API_KEY'),
            'Content-Type' => 'application/json',
        ])->post('https://api.brevo.com/v3/smtp/email', [
            'sender' => [
                'email' => env('MAIL_FROM_ADDRESS'),
                'name'  => env('MAIL_FROM_NAME'),
            ],
            'to'          => [['email' => $to]],
            'subject'     => $subject,
            'htmlContent' => $html,
        ]);
    }

    public static function passwordResetHtml(string $resetUrl): string
    {
        return <<<HTML
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">

        <tr><td style="background:#4f46e5;padding:36px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:30px;font-weight:900;">سنفور</h1>
          <p style="color:#c7d2fe;margin:6px 0 0;font-size:13px;">منصة التخطيط الأكاديمي</p>
        </td></tr>

        <tr><td style="padding:40px 48px;direction:rtl;text-align:right;">
          <h2 style="color:#1e293b;font-size:20px;margin:0 0 14px;font-weight:800;">🔐 إعادة تعيين كلمة المرور</h2>
          <p style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 28px;">
            تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك على منصة <strong>سنفور</strong>.
            اضغط على الزر أدناه لاختيار كلمة مرور جديدة.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="{$resetUrl}"
               style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">
              إعادة تعيين كلمة المرور
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 6px;">
            ⚠️ إذا لم تطلب ذلك، تجاهل هذه الرسالة ولن يتغيّر أي شيء.
          </p>
          <p style="color:#94a3b8;font-size:13px;margin:0;">ينتهي صلاحية هذا الرابط خلال <strong>60 دقيقة</strong>.</p>
        </td></tr>

        <tr><td style="padding:0 48px 28px;direction:rtl;text-align:right;">
          <p style="color:#cbd5e1;font-size:11px;margin:0;">أو انسخ الرابط في متصفحك:</p>
          <p style="color:#6366f1;font-size:11px;word-break:break-all;margin:4px 0 0;">{$resetUrl}</p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:20px 48px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#cbd5e1;font-size:12px;margin:0;">© 2026 سنفور · جميع الحقوق محفوظة</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }

    public static function verifyEmailHtml(string $verifyUrl): string
    {
        return <<<HTML
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.08);">

        <tr><td style="background:#4f46e5;padding:36px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:30px;font-weight:900;">سنفور</h1>
          <p style="color:#c7d2fe;margin:6px 0 0;font-size:13px;">منصة التخطيط الأكاديمي</p>
        </td></tr>

        <tr><td style="padding:40px 48px;direction:rtl;text-align:right;">
          <h2 style="color:#1e293b;font-size:20px;margin:0 0 14px;font-weight:800;">✉️ تأكيد البريد الإلكتروني</h2>
          <p style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 28px;">
            شكرًا لتسجيلك في <strong>سنفور</strong>! قبل البدء، يرجى تأكيد
            عنوان بريدك الإلكتروني بالضغط على الزر أدناه.
          </p>
          <div style="text-align:center;margin:0 0 28px;">
            <a href="{$verifyUrl}"
               style="display:inline-block;background:#059669;color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;">
              تأكيد البريد الإلكتروني
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">
            إذا لم تقم بإنشاء حساب على سنفور، تجاهل هذه الرسالة.
          </p>
        </td></tr>

        <tr><td style="padding:0 48px 28px;direction:rtl;text-align:right;">
          <p style="color:#cbd5e1;font-size:11px;margin:0;">أو انسخ الرابط في متصفحك:</p>
          <p style="color:#6366f1;font-size:11px;word-break:break-all;margin:4px 0 0;">{$verifyUrl}</p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:20px 48px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#cbd5e1;font-size:12px;margin:0;">© 2026 سنفور · جميع الحقوق محفوظة</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
HTML;
    }
}