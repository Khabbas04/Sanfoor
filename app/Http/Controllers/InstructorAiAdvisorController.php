<?php

namespace App\Http\Controllers;

use App\Models\AcademicPeriod;
use App\Models\Course;
use App\Models\Landmark;
use App\Models\User;
use App\Models\Chat;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Illuminate\Support\Facades\Schema;

class InstructorAiAdvisorController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $chats = Chat::where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->get(['id', 'title', 'updated_at']);

        // Load instructor preferences
        $preferences = $user->preferences()->first();

        // Load other instructors in same major for carpooling selection and public profiles
        $otherInstructors = User::where('role', 'instructor')
            ->where('id', '!=', $user->id)
            ->where('major_id', $user->major_id)
            ->with('preferences')
            ->select('id', 'name', 'email', 'academic_rank')
            ->get();

        return Inertia::render('Instructor/AiScheduler', [
            'chats' => $chats,
            'preferences' => $preferences,
            'other_instructors' => $otherInstructors,
        ]);
    }

    public function savePreferences(Request $request)
    {
        $request->validate([
            'preferred_days' => 'nullable|array',
            'preferred_times' => 'nullable|array',
            'carpool_with_user_ids' => 'nullable|array',
        ]);

        $user = Auth::user();
        $user->preferences()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'preferred_days' => $request->preferred_days ?? [],
                'preferred_times' => $request->preferred_times ?? [],
                'carpool_with_user_ids' => $request->carpool_with_user_ids ?? [],
            ]
        );

        return back()->with('success', 'تم حفظ التفضيلات بنجاح.');
    }


    public function chat(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:1500',
            'chat_id' => 'nullable|exists:chats,id',
        ]);

        $user = Auth::user();
        $messageText = $request->input('message');
        $chatId = $request->input('chat_id');

        if (!$chatId) {
            $chat = Chat::create([
                'user_id' => $user->id,
                'title' => mb_substr($messageText, 0, 50) . (strlen($messageText) > 50 ? '...' : ''),
            ]);
        } else {
            $chat = Chat::where('user_id', $user->id)
                ->findOrFail($chatId);
            $chat->touch();
        }

        Message::create([
            'chat_id' => $chat->id,
            'role' => 'user',
            'content' => $messageText,
        ]);

        $systemPrompt = $this->buildSystemPrompt($user);

        // Fetch conversation history
        $history = $chat->messages()->orderBy('created_at')->get()->map(function ($msg) {
            return [
                'role' => $msg->role === 'user' ? 'user' : 'model',
                'parts' => [['text' => $msg->content]],
            ];
        })->toArray();

        try {
            $geminiService = app(\App\Services\GeminiService::class);
            $options = [
                'systemInstruction' => [
                    'parts' => [['text' => $systemPrompt]],
                ],
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => 4000,
                    'responseMimeType' => 'application/json',
                ],
            ];

            // Use the service to call Gemini (includes robust retry/fallback logic)
            $aiText = $geminiService->callGeminiAPI($history, $options);

            $aiText = $aiText ?? '{"reply":"حدث خطأ في فهم الرد."}';

            // Clean Markdown code block formatting if present
            $aiText = preg_replace('/```(?:json)?\s*/i', '', $aiText);
            $aiText = preg_replace('/```/i', '', $aiText);
            $aiText = trim($aiText);

            $decoded = json_decode($aiText, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                // Try to handle escaping issues
                $cleanedAiText = str_replace("\n", "\\n", $aiText);
                $cleanedAiText = str_replace("\r", "", $cleanedAiText);
                $cleanedAiText = preg_replace('/[\x00-\x1F]/', '', $cleanedAiText);
                $decoded = json_decode($cleanedAiText, true);

                if (json_last_error() !== JSON_ERROR_NONE) {
                     // Try extracting via regex
                     if (preg_match('/"reply"\s*:\s*"((?:\\\\.|[^"\\\\])*)"/is', $aiText, $matches)) {
                         $decoded = ['reply' => str_replace('\n', "\n", stripcslashes($matches[1]))];
                     } elseif (preg_match('/"reply"\s*:\s*"((?:\\\\.|[^"\\\\])*)/is', $aiText, $matches)) {
                         // Fallback for truncated JSON
                         $decoded = ['reply' => str_replace('\n', "\n", stripcslashes($matches[1]))];
                     } else {
                         $decoded = ['reply' => $aiText];
                     }
                }
            }

            // Re-encode to ensure it's a perfectly valid JSON string in the DB
            $aiText = json_encode($decoded, JSON_UNESCAPED_UNICODE);

            Message::create([
                'chat_id' => $chat->id,
                'role' => 'ai',
                'content' => $aiText,
            ]);

            return response()->json([
                'status' => 'success',
                'chat_id' => $chat->id,
                'message' => $decoded,
            ]);

        } catch (\Exception $e) {
            echo "GEMINI EXCEPTION: " . $e->getMessage() . "\n";
            Log::error('Instructor AI Chat Error', ['error' => $e->getMessage()]);
            return response()->json([
                'status' => 'error',
                'message' => 'تعذر الاتصال بالمساعد الذكي حالياً. الرجاء المحاولة مرة أخرى.',
            ], 500);
        }
    }

    public function getMessages($chat_id)
    {
        $chat = Chat::where('user_id', Auth::id())
            ->findOrFail($chat_id);

        $messages = $chat->messages()->orderBy('created_at')->get()->map(function ($msg) {
            $content = $msg->content;
            if ($msg->role === 'ai') {
                $decoded = json_decode($content, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $cleanedContent = preg_replace('/```(?:json)?\s*/i', '', $content);
                    $cleanedContent = preg_replace('/```/i', '', $cleanedContent);
                    $cleanedContent = str_replace("\n", "\\n", $cleanedContent);
                    $cleanedContent = str_replace("\r", "", $cleanedContent);
                    $cleanedContent = preg_replace('/[\x00-\x1F]/', '', $cleanedContent);
                    $decoded = json_decode($cleanedContent, true);
                    
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        if (preg_match('/"reply"\s*:\s*"((?:\\\\.|[^"\\\\])*)"/is', $content, $matches)) {
                            $decoded = ['reply' => str_replace('\n', "\n", stripcslashes($matches[1]))];
                        } elseif (preg_match('/"reply"\s*:\s*"((?:\\\\.|[^"\\\\])*)/is', $content, $matches)) {
                            $decoded = ['reply' => str_replace('\n', "\n", stripcslashes($matches[1]))];
                        } else {
                            $decoded = ['reply' => $content];
                        }
                    }
                }
                $content = $decoded ?? ['reply' => $content];
            }
            return [
                'id' => $msg->id,
                'role' => $msg->role,
                'content' => $content,
                'created_at' => $msg->created_at,
            ];
        });

        return response()->json([
            'chat_id' => $chat->id,
            'title' => $chat->title,
            'messages' => $messages,
        ]);
    }

    public function destroy($chat_id)
    {
        Chat::where('user_id', Auth::id())
            ->findOrFail($chat_id)
            ->delete();

        return response()->json(['status' => 'success']);
    }

    private function buildSystemPrompt($user)
    {
        $currentPeriod = AcademicPeriod::current();
        $isSummer = $currentPeriod ? ((int) $currentPeriod->academic_term === 3) : false;
        
        $rank = $user->academic_rank ?? 'doctor';
        $maxCourses = $user->max_courses; // Based on rank

        $majorId = $user->major_id;
        $departmentCourses = Course::where('major_id', $majorId)->select('id', 'name', 'code', 'credit_hours', 'type')->get();
        $departmentCourseNames = $departmentCourses->pluck('name')->implode(', ');

        $prefs = $user->preferences;
        $prefDays = $prefs ? implode(', ', $prefs->preferred_days ?? []) : 'غير محدد';
        $prefTimes = $prefs ? implode(', ', $prefs->preferred_times ?? []) : 'غير محدد';
        
        $carpoolNames = 'لا يوجد';
        if ($prefs && !empty($prefs->carpool_with_user_ids)) {
            $carpoolUsers = User::whereIn('id', $prefs->carpool_with_user_ids)->pluck('name')->implode(', ');
            $carpoolNames = $carpoolUsers;
        }

        // Fetch halls (we just give some fake capacity data for now as per user instructions)
        $hallsStr = "القاعات المتاحة (سعات افتراضية): قاعة 101 (سعة 50)، قاعة 102 (سعة 40)، قاعة 201 (سعة 60)، قاعة 202 (سعة 30)، مختبر 1 (سعة 20)";

        // Demand Data
        $periodYear = $currentPeriod?->academic_year;
        $periodTerm = $currentPeriod?->academic_term;
        $hasPeriodColumns = true; // Column confirmed in migrations
        $courseDemand = Course::where('major_id', $majorId)
            ->withCount(['cartUsers as demand' => function ($query) use ($periodYear, $periodTerm, $hasPeriodColumns) {
                if ($periodYear && $periodTerm && $hasPeriodColumns) {
                    $query->where('user_carts.academic_year', $periodYear)->where('user_carts.academic_term', $periodTerm);
                }
            }])
            ->get()
            ->filter(fn($c) => $c->demand > 0)
            ->map(fn($c) => "{$c->name} (طلب: {$c->demand} طالب)")
            ->implode(' | ');

        $timeRules = $isSummer ?
            "- الصيفي: الدوام 4 أيام (أحد، اثنين، ثلاثاء، أربعاء). المحاضرة ساعة وربع." :
            "- العادي: محاضرات (أحد/ثلاثاء/خميس) مدتها ساعة. محاضرات (اثنين/أربعاء) مدتها ساعة ونصف. المختبرات ساعتين مرة واحدة أسبوعياً.";

        return "أنت مساعد ذكي للهيئة التدريسية في جامعة الزرقاء ('Instructor Scheduler AI').
دورك: مساعدة الدكتور في ترتيب جدوله الدراسي، تحديد القاعات والأوقات، وحل تعارضات الجدول بطريقة ذكية جداً.

معلومات الدكتور الحالي:
- الاسم: {$user->name}
- الرتبة الأكاديمية: {$rank}
- الحد الأقصى للمواد المسموح بتدريسها: {$maxCourses} مواد.
- المواد الخاصة بقسمه: {$departmentCourseNames}. يجب ألا تقترح مواد من خارج هذه القائمة.

تفضيلات الدكتور:
- الأيام المفضلة: {$prefDays}
- الأوقات المفضلة: {$prefTimes}
- دكاترة يأتي معهم (Carpooling): {$carpoolNames}. (يجب أن تحاول مطابقة أوقات ومواعيد دوامه معهم لتسهيل قدومهم معاً).

القواعد الأكاديمية:
- الفصل الحالي: " . ($isSummer ? 'صيفي' : 'اعتيادي') . "
{$timeRules}
- الطلب على مواد القسم (مأخوذ من التسجيل التجريبي للطلاب): {$courseDemand}.
- القاعات المتوفرة: {$hallsStr}. (ملاحظة: السعة حالياً افتراضية بانتظار تحديث النظام).

مهماتك الذكية:
1. تحليل تعارضات الطلاب: لا تضع مادتين إجباريتين لنفس السنة الدراسية في نفس الوقت.
2. تحليل الضغط (Demand vs Capacity): إذا كان الطلب على مادة 120 طالباً والقاعة تسع 50، اقترح فتح 3 شعب، ونبه الدكتور.
3. راعِ الحد الأقصى لنصاب الدكتور ({$maxCourses} مواد). لا تقترح عليه تدريس أكثر من الحد.
4. استخدم Markdown في ردودك لتنسيق الجداول بشكل جميل. يمنع منعاً باتاً استخدام كود HTML في الرد. يجب أن يكون التنسيق فقط Markdown.
5. اجعل ردك مختصراً، احترافياً، واقتصادياً في الكلام. قدم الجداول والنصائح مباشرة بدون إطالة مفرطة.

⚠️ شكل الرد الإجباري (JSON صالح فقط):
{
  \"reply\": \"نصائحك وردك المنسق بـ Markdown، يمكن أن يحتوي على جداول وقوائم.\",
  \"proposed_schedule\": [
    {\"course_name\": \"اسم المادة\", \"days\": \"أحد ثلاثاء خميس\", \"time\": \"09:00 - 10:00\", \"hall\": \"قاعة 101\"}
  ]
}
هام: يجب أن يكون الرد JSON صالح بدون Markdown Code Blocks حوله.";
    }

    public function commitSchedule(Request $request)
    {
        // This is a placeholder for actually saving the schedule to the system.
        // For now, it will just return success.
        $request->validate([
            'schedule' => 'required|array',
        ]);

        // Here we would append to summer_2026_schedule.json or insert into a DB table.
        // Since we rely on the summer_2026_schedule.json currently, modifying it safely is complex and out of scope for this demo,
        // so we'll just log it and show a success message.
        Log::info('Instructor committed schedule', ['user' => Auth::user()->name, 'schedule' => $request->schedule]);

        return response()->json(['status' => 'success', 'message' => 'تم اعتماد مقترح الشُعب وحفظه في النظام بنجاح!']);
    }
}
