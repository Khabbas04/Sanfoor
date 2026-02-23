<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use App\Models\Chat;
use App\Models\Message;
use App\Models\Course;
use Illuminate\Support\Facades\DB;

class AiAdvisorController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $user->load('major', 'chats');
        $majorName = $user->major ? $user->major->name : 'غير محدد';
        $chats = $user->chats()->select('id', 'title', 'created_at')->get();

        return Inertia::render('AI/Advisor', [
            'studentStats' => [
                'name' => $user->name ?? 'طالب',
                'major' => $majorName,
            ],
            'chats' => $chats
        ]);
    }

    public function getMessages($chat_id)
    {
        $chat = Chat::findOrFail($chat_id);
        if ($chat->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }
        return response()->json($chat->messages);
    }

    public function chat(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'chat_id' => 'nullable|exists:chats,id'
        ]);

        $userMessage = $request->message;
        $chatId = $request->chat_id;
        $apiKey = env('GEMINI_API_KEY');
        $user = Auth::user();

        if (!$apiKey) {
            return response()->json(['status' => 'error', 'message' => 'لم يتم العثور على مفتاح API في ملف .env'], 500);
        }

        if (!$chatId) {
            $chat = $user->chats()->create([
                'title' => mb_substr($userMessage, 0, 30) . '...' 
            ]);
            $chatId = $chat->id;
        } else {
            $chat = Chat::findOrFail($chatId);
            if ($chat->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        }

        $chat->messages()->create(['role' => 'user', 'content' => $userMessage]);

        // 🔥 1. جلب البيانات الشاملة المحدثة 🔥
        $user->load('major', 'passedCourses', 'cartCourses');
        $majorName = $user->major ? $user->major->name : 'تكنولوجيا المعلومات';
        
        $gpaData = $user->calculateGPA();
        $gpaText = "المعدل المئوي الحالي: {$gpaData['percentage']}% (أو {$gpaData['gpa4']} من 4.00)";

        // المواد المنجزة وتحليل المهارات لـ Skill-Based CV
        $passedCourses = $user->passedCourses;
        $passedCourseIds = $passedCourses->pluck('id')->toArray();
        $passedCoursesString = $passedCourses->isEmpty() ? 'لا يوجد مواد منجزة بعد' : $passedCourses->pluck('name')->implode('، ');
        $totalPassedHours = $passedCourses->sum('credit_hours');

        // 🔥 2. قراءة المحاكي (الخطة القادمة) 🔥
        $cartCourses = $user->cartCourses;
        $cartHours = $cartCourses->sum('credit_hours');
        $cartCoursesList = $cartCourses->map(fn($c) => "{$c->name} ({$c->code} - {$c->credit_hours}س)")->implode(' | ');

        // 🔥 3. تحليل المواد المتاحة والمسار الحرج (Fast-Track) 🔥
        $availableCourses = Course::whereNotIn('id', $passedCourseIds)->get();
        $availableCoursesList = $availableCourses->map(function($c) {
            return "{$c->name} (رمز: {$c->code}, ساعات: {$c->credit_hours}, متطلب: " . ($c->prerequisite_id ?? 'لا يوجد') . ")";
        })->implode(' | ');

        // 🔥 4. نظام التعليمات المطور للـ Agent 🔥
        $systemPrompt = "أنت 'سنفور'، المساعد الأكاديمي الذكي لفريق Kollia بجامعة الزرقاء. أنت تمتلك صلاحيات تنفيذية.
        
        بيانات الطالب: {$user->name} | تخصص: {$majorName} | {$gpaText} | ساعات منجزة: {$totalPassedHours}س.
        ✅ المواد التي أنجزها الطالب بنجاح: [ {$passedCoursesString} ].
        مواد المحاكي حالياً: [ {$cartCoursesList} ] (إجمالي: {$cartHours}ساعة).
        مواد متاحة (اسم، رمز، متطلب): [ {$availableCoursesList} ].

        وظائفك وخدماتك:
        1. 🚀 (Fast-Track): إذا طلب الطالب التخرج بأسرع وقت، اقترح عليه مواد 'المسار الحرج' (التي تفتح مواداً أخرى) واستخدم [SET_CART: CODE1, CODE2].
        2. 📈 (GPA Predictor): إذا سأل 'كم لازم أجيب؟' للوصول لمعدل معين، احسبها له بناءً على معدله الحالي وساعات المحاكي.
        3. 📄 (CV Skills): إذا سأل عن مهاراته، حلل المواد المنجزة (المذكورة أعلاه) وحولها لمهارات سوق عمل (مثال: Database -> SQL).
        4. ⚠️ (Conflict Detector): إذا طلب إضافة مادة لم ينهِ متطلبها السابق، حذره فوراً ولا تضفها.
        5. 🎯 (Electives): اقترح مواد اختيارية بناءً على ميوله المهنية (برمجة، أمن، ذكاء).

        الأوامر التنفيذية (ضعها في نهاية ردك عند الحاجة):
        - للتحديث الشامل: [SET_CART: CODE1, CODE2]
        - للإضافة فقط: [ADD_TO_CART: CODE1]";

        $previousMessages = $chat->messages()->orderBy('created_at', 'asc')->get();
        $contents = [];
        foreach ($previousMessages as $index => $msg) {
            $text = $msg->content;
            if ($index === 0 && $msg->role === 'user') {
                $text = "تعليمات النظام: \n" . $systemPrompt . "\n\nسؤال الطالب: \n" . $text;
            }
            $contents[] = ['role' => $msg->role === 'ai' ? 'model' : 'user', 'parts' => [['text' => $text]]];
        }

        try {
            // 🔥 الحل: إضافة withoutVerifying لتخطي الـ SSL المحلي 🔥
            $response = Http::withoutVerifying()
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", [
                    'contents' => $contents
                ]);

            if ($response->successful()) {
                $reply = $response->json('candidates.0.content.parts.0.text');
                
                // 🔥 5. تنفيذ الأوامر (Execution Logic) 🔥
                $actionPerformed = "";
                
                // أمر الاستبدال (SET)
                if (preg_match('/\[SET_CART:\s*(.*?)\]/', $reply, $matches)) {
                    $codes = array_map('trim', explode(',', $matches[1]));
                    $ids = Course::whereIn('code', $codes)->pluck('id')->toArray();
                    if (!empty($ids)) {
                        $user->cartCourses()->sync($ids);
                        $actionPerformed = "\n\n*(✨ إشعار: تم تحديث جدولك بالكامل في المحاكي بنجاح!)*";
                    }
                    $reply = preg_replace('/\[SET_CART:\s*(.*?)\]/', '', $reply);
                }

                // أمر الإضافة (ADD)
                if (preg_match('/\[ADD_TO_CART:\s*(.*?)\]/', $reply, $matches)) {
                    $codes = array_map('trim', explode(',', $matches[1]));
                    $ids = Course::whereIn('code', $codes)->pluck('id')->toArray();
                    if (!empty($ids)) {
                        $user->cartCourses()->syncWithoutDetaching($ids);
                        $actionPerformed = "\n\n*(✨ إشعار: تم إضافة المواد الجديدة لمحاكيك!)*";
                    }
                    $reply = preg_replace('/\[ADD_TO_CART:\s*(.*?)\]/', '', $reply);
                }

                $reply = trim($reply) . $actionPerformed;
                $chat->messages()->create(['role' => 'ai', 'content' => $reply]);

                return response()->json(['status' => 'success', 'reply' => $reply, 'chat_id' => $chatId]);
            }

            // 🔥 طباعة رسالة الخطأ الحقيقية القادمة من جوجل في ملف اللوج (storage/logs/laravel.log) 🔥
            Log::error("Gemini API Error: " . $response->body());
            return response()->json(['status' => 'error', 'message' => 'خطأ من سيرفرات جوجل، يرجى المحاولة لاحقاً.'], 500);

        } catch (\Exception $e) {
            Log::error("Gemini Exception: " . $e->getMessage());
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    public function getAdminReports()
    {
        $topDemandedCourses = DB::table('user_carts')
            ->join('courses', 'user_carts.course_id', '=', 'courses.id')
            ->select('courses.name', 'courses.code', DB::raw('count(user_carts.user_id) as student_count'))
            ->groupBy('courses.id', 'courses.name', 'courses.code')
            ->orderBy('student_count', 'desc')
            ->limit(10)
            ->get();

        $graduationAudit = DB::table('course_user')
            ->join('courses', 'course_user.course_id', '=', 'courses.id')
            ->select('user_id', DB::raw('sum(courses.credit_hours) as total_hours'))
            ->groupBy('user_id')
            ->get();

        return response()->json([
            'demanded_courses' => $topDemandedCourses,
            'graduation_status' => $graduationAudit
        ]);
    }
}