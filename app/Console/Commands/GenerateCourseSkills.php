<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Course;
use Illuminate\Support\Facades\Http;

class GenerateCourseSkills extends Command
{
    // اسم الأمر اللي رح نكتبه بالتيرمينال
    protected $signature = 'ai:generate-skills';

    // وصف الأمر
    protected $description = 'يحلل المواد الفارغة ويستنتج مهاراتها عبر Gemini AI';

    public function handle()
    {
        // استخدمت المفتاح المباشر كما أرسلته لتجاوز مشكلة الـ Cache مؤقتاً
$apiKey = env('GEMINI_API_KEY');        
        if (!$apiKey) {
            $this->error('يرجى التأكد من وضع GEMINI_API_KEY في ملف .env');
            return;
        }

        // نجلب فقط المواد التي لا تحتوي على مهارات
        $courses = Course::whereNull('skills')->orWhere('skills', '')->get();

        if ($courses->isEmpty()) {
            $this->info('🎉 جميع المواد تمتلك مهارات مسبقاً! لا يوجد شيء لتحليله.');
            return;
        }

        $this->info("🤖 تم العثور على {$courses->count()} مواد تحتاج لتحليل المهارات. جاري العمل...");

        foreach ($courses as $course) {
            $this->line("جاري تحليل مادة: <fg=cyan>{$course->name}</>...");

            // نوجه الـ AI ليعطينا مهارات دقيقة لسوق العمل
            $prompt = "استخرج 3 إلى 5 مهارات تقنية أو عملية رئيسية يكتسبها الطالب من دراسة مادة أكاديمية باسم '{$course->name}'. 
            إذا كانت المادة برمجية اذكر اللغات (مثل Java, OOP). وإذا كانت عامة اذكر مهارات ناعمة (مثل Communication).
            أرجع النتيجة ككلمات باللغة الإنجليزية فقط، مفصولة بفاصلة فقط (مثال: Problem Solving, Database Design, C++). 
            ممنوع كتابة أي نص إضافي أو مقدمات.";

            try {
                // 🔥 تم إضافة withoutVerifying() لتخطي شهادات SSL المحلية في Laragon 🔥
                $response = Http::withoutVerifying()
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", [
                        'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]]
                    ]);

                if ($response->successful()) {
                    // تنظيف النص من النجمات أو الأسطر الزائدة
                    $skills = trim($response->json('candidates.0.content.parts.0.text'));
                    $skills = str_replace(["\n", "\r", '"', "'", '*'], '', $skills);
                    
                    // حفظها في قاعدة البيانات
                    $course->update(['skills' => $skills]);
                    $this->line("<fg=green>تمت الإضافة:</> $skills \n");
                } else {
                    // 🔥 تم تعديل رسالة الخطأ لتطبع تفاصيل المشكلة من سيرفرات جوجل 🔥
                    $this->error("فشل! السبب من جوجل: " . $response->body());
                }

                // نوقف السكريبت ثانيتين عشان ما نتجاوز الحد المسموح لطلبات Gemini (Rate Limit)
                sleep(2);

            } catch (\Exception $e) {
                $this->error("حدث خطأ في السيرفر: " . $e->getMessage());
            }
        }

        $this->info('✅ انتهى الذكاء الاصطناعي من تعبئة جميع المهارات بنجاح! تفقد الداشبورد الآن.');
    }
}