<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ExtractPdfText extends Command
{
    protected $signature = 'extract:pdf {filename=university_rules.pdf}';
    protected $description = 'Extracts text from an Arabic PDF using Gemini API directly without cache dependencies';

    public function handle()
    {
        $filename = $this->argument('filename');
        $filePath = storage_path('app/private/' . $filename);

        if (!file_exists($filePath)) {
            $this->error("الملف غير موجود في المسار: {$filePath}");
            return;
        }

        $this->info("جاري قراءة الملف: {$filename}");
        $this->info("يتم الآن إرسال الملف لـ Gemini لقراءة الصور واستخراج النصوص العربية بدقة...");

        $pdfData = base64_encode(file_get_contents($filePath));
        $apiKey = env('GEMINI_API_KEY');

        if (empty($apiKey)) {
            $this->error("لم يتم العثور على مفتاح GEMINI_API_KEY في ملف .env");
            return;
        }

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        [
                            'text' => "أنت خبير في قراءة المستندات وقوانين الجامعات. قم باستخراج جميع النصوص الموجودة في هذا الملف بدقة متناهية باللغة العربية. حافظ على أرقام القوانين، الشروط، وترتيب المواد. لا تلخص أبداً، فقط استخرج النص بالكامل وبشكل مقروء، خصوصاً الأرقام (مثل عدد الغيابات أو الساعات)."
                        ],
                        [
                            'inlineData' => [
                                'mimeType' => 'application/pdf',
                                'data' => $pdfData
                            ]
                        ]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.1,
                'responseMimeType' => 'text/plain', 
            ]
        ];

        try {
            $model = config('services.gemini.model', 'gemini-3.5-flash-lite');
            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
            
            $response = Http::withoutVerifying()
                ->timeout(120)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post($url, $payload);

            if (!$response->successful()) {
                $this->error("فشل الاتصال: " . $response->body());
                return;
            }

            $candidate = $response->json('candidates.0');
            $extractedText = $candidate['content']['parts'][0]['text'] ?? '';

            if (empty(trim($extractedText))) {
                $this->error("لم يتم استخراج أي نص من الملف.");
                return;
            }
            
            $outputPath = storage_path('app/private/extracted_rules.txt');
            file_put_contents($outputPath, $extractedText);
            
            // Auto inject into Seeder
            $seederPath = database_path('seeders/DocumentSeeder.php');
            $seederContent = file_get_contents($seederPath);
            $newSeederContent = preg_replace(
                '/(\$universityRulesText\s*=\s*<<<TEXT\n).*?(\nTEXT;)/s',
                '$1' . $extractedText . '$2',
                $seederContent
            );
            file_put_contents($seederPath, $newSeederContent);

            $this->info("✅ نجح الأمر! تم استخراج النصوص وحفظها في: {$outputPath}");
            $this->info("✅ تم حقن النص تلقائياً داخل DocumentSeeder.php!");

        } catch (\Exception $e) {
            $this->error("حدث خطأ أثناء الاتصال: " . $e->getMessage());
        }
    }
}
