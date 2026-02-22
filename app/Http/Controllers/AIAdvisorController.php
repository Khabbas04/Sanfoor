<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use App\Models\Chat;
use App\Models\Message;
use App\Models\Course; // 🔥 مهم جداً جلب الموديل

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

        // 🔥 1. جلب البيانات الشاملة (بما فيها المحاكي/السلة) 🔥
        $user->load('major', 'passedCourses', 'cartCourses');
        $majorName = $user->major ? $user->major->name : 'تكنولوجيا المعلومات';
        
        $gpaData = $user->calculateGPA();
        $gpaText = "المعدل المئوي: {$gpaData['percentage']}% (أو {$gpaData['gpa4']} من 4.00)";

        // المواد المنجزة
        $passedCourseIds = $user->passedCourses->pluck('id')->toArray();
        $passedCoursesString = $user->passedCourses->pluck('name')->implode('، ');
        if(empty($passedCoursesString)) $passedCoursesString = "لم ينجز أي مواد بعد.";
        $totalPassedHours = $user->passedCourses->sum('credit_hours');

        // 🔥 2. قراءة ما بداخل المحاكي حالياً ليعرفه الذكاء الاصطناعي 🔥
        $cartCoursesArray = $user->cartCourses->map(function($c) {
            return $c->name . ' (رمزها: ' . $c->code . ')';
        })->toArray();
        $cartCoursesString = empty($cartCoursesArray) 
            ? 'المحاكي فارغ حالياً (لا يوجد مواد مخطط لها للفصل القادم).' 
            : implode('، ', $cartCoursesArray);

        // المواد المتاحة (التي لم ينجزها)
        $availableCourses = Course::whereNotIn('id', $passedCourseIds)->get();
        $availableCoursesList = $availableCourses->map(function($c) {
            return $c->name . ' (رمزها: ' . $c->code . ' - ' . $c->credit_hours . 'ساعات)';
        })->implode(' | ');

        // 🔥 3. حقن تعليمات الذكاء الاصطناعي مع القدرة على مسح ووضع جدول جديد 🔥
        $systemPrompt = "أنت مرشد أكاديمي ذكي اسمك 'سنفور'، تم تطويرك بواسطة فريق Kollia لمساعدة طلاب جامعة الزرقاء.
        
        بيانات الطالب الحالية:
        - الاسم: {$user->name} | التخصص: {$majorName}
        - {$gpaText}
        - الساعات المنجزة: {$totalPassedHours} ساعة.
        - المواد المنجزة: [ {$passedCoursesString} ]
        - 🔥 المواد الموجودة في المحاكي الخاص به الآن (خطته للفصل القادم): [ {$cartCoursesString} ]
        - المواد المتبقية المتاحة له: [ {$availableCoursesList} ]

        قواعدك:
        1. كن ودوداً، مختصراً، واستخدم إيموجي.
        2. إذا سألك الطالب 'ما رأيك بموادي التي نزلتها؟'، انظر إلى (المواد الموجودة في المحاكي) وقيمها له.
        3. ⚡️ ميزة التحكم واعتماد الجداول ⚡️: إذا طلب منك الطالب اقتراح جدول كامل وتنزيله له، اختر المواد المناسبة له، ثم ضع هذا الكود السري في نهاية ردك:
        [SET_CART: CODE1, CODE2, CODE3]
        (استبدل CODE بالرموز الإنجليزية الصحيحة للمواد). هذا الكود سيقوم بمسح محاكيه القديم ووضع الجدول الذي اقترحته أنت تلقائياً.";

        $previousMessages = $chat->messages()->orderBy('created_at', 'asc')->get();
        $contents = [];

        foreach ($previousMessages as $index => $msg) {
            $text = $msg->content;
            if ($index === 0 && $msg->role === 'user') {
                $text = "تعليمات النظام: \n" . $systemPrompt . "\n\nرسالة الطالب: \n" . $text;
            }
            $contents[] = [
                'role' => $msg->role === 'ai' ? 'model' : 'user',
                'parts' => [['text' => $text]]
            ];
        }

        try {
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
            ])->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={$apiKey}", [
                'contents' => $contents
            ]);

            if ($response->successful()) {
                $reply = $response->json('candidates.0.content.parts.0.text');
                
                // 🔥 4. خوارزمية تنفيذ الكود السري (رفع الجدول للمحاكي تلقائياً) 🔥
                if (preg_match('/\[SET_CART:\s*(.*?)\]/', $reply, $matches)) {
                    $codes = explode(',', $matches[1]);
                    $codes = array_map('trim', $codes);
                    
                    // جلب أرقام المواد (IDs) بناءً على الرموز
                    $courseIdsToCart = Course::whereIn('code', $codes)->pluck('id')->toArray();
                    
                    if (!empty($courseIdsToCart)) {
                        // استخدام sync لـ "مسح" الجدول القديم ووضع الجدول المقترح الجديد
                        $user->cartCourses()->sync($courseIdsToCart);
                    }

                    // إخفاء الكود السري عن الطالب، وإظهار رسالة تأكيد أن المهمة تمت
                    $reply = preg_replace('/\[SET_CART:\s*(.*?)\]/', '', $reply);
                    $reply = trim($reply) . "\n\n*(✨ إشعار من النظام: تم رفع الجدول المقترح إلى محاكيك بنجاح! يمكنك رؤيته في صفحة الخطة الشجرية)*";
                }

                $chat->messages()->create(['role' => 'ai', 'content' => $reply]);

                return response()->json([
                    'status' => 'success',
                    'reply' => $reply,
                    'chat_id' => $chatId 
                ]);
            }

            return response()->json(['status' => 'error', 'message' => 'خطأ داخلي.'], 500);

        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => 'فشل الاتصال.'], 500);
        }
    }
}