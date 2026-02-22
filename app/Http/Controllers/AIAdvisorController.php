<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class AIAdvisorController extends Controller
{
    /**
     * عرض صفحة المرشد الأكاديمي الذكي
     */
    public function index()
    {
        $user = Auth::user();

        // جلب بيانات الطالب الضرورية للتحليل
        // سنرسل الساعات المنجزة والتخصص لكي تظهر في واجهة الـ AI فوراً
        $studentData = [
            'name' => $user->name,
            'major' => $user->major ? $user->major->name : 'غير محدد',
            'passed_hours' => $user->passedCourses()->sum('credit_hours'),
            'total_plan_hours' => 132, // يمكنك جعلها ديناميكية حسب التخصص
        ];

        return Inertia::render('AI/Advisor', [
            'studentStats' => $studentData
        ]);
    }

    /**
     * استقبال الرسائل وإرسالها لمشروع البايثون (FastAPI)
     */
    public function chat(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:500',
        ]);

        try {
            // Simulate AI thinking time
            sleep(1);

            $userMessage = mb_strtolower($request->message);
            $studentName = Auth::user()->name ?? 'الطالب';

            $responses = [
                'default' => "أهلاً بك يا {$studentName}! أنا مرشدك الأكاديمي الذكي. يمكنني مساعدتك في تخطيط جدولك الدراسي للفصل القادم، واقتراح أفضل المواد بناءً على سجلّك الأكاديمي. كيف يمكنني مساعدتك اليوم؟",
                'مواد' => "بناءً على المواد التي اجتزتها بنجاح، أنصحك بالتركيز هذا الفصل على متطلبات التخصص الإجبارية التي تفتح لك مسارات أخرى (Prerequisites). هل تفضل المواد التي تعتمد على البرمجة أم الحفظ؟",
                'جدول' => "ممتاز! لنرتب جدولاً متوازناً. إذا كنت ترغب بتسجيل 15 ساعة، أقترح: مادتين تخصص، ومادة متطلب كلية للربط الأساسي، ومادة اختيارية (متطلب جامعة) لرفع المعدل. هل ترغب بأن أقترح أسماء مواد محددة؟",
                'معدل' => "هذا هدف ممتاز! لرفع المعدل التراكمي بشكل فعّال، ركز على المواد الاختيارية وابحث عن المواد التي تُعرف بأنها أقل تعقيداً. أيضاً، إن كان لديك مادة سابقة بعلامة متدنية، إعادة دراستها ستحدث فرقاً كبيراً في التراكمي.",
                'خطة' => "يبدو أن مسارك الأكاديمي يسير بثبات! من المهم الآن التأكد من استكمال مواد السنة الثانية قبل البدء بمواد التخصص الدقيقة لتجنب أي تعارض في المتطلبات السابقة لاحقاً."
            ];

            $reply = $responses['default'];
            $action = null;
            $newCartIds = null;

            if (mb_strpos($userMessage, 'مواد') !== false || mb_strpos($userMessage, 'مادي') !== false || mb_strpos($userMessage, 'انزل') !== false) {
                $reply = $responses['مواد'];
            }
            elseif (mb_strpos($userMessage, 'جدول') !== false || mb_strpos($userMessage, 'تسجيل') !== false) {
                $reply = $responses['جدول'];
            }
            elseif (mb_strpos($userMessage, 'معدل') !== false || mb_strpos($userMessage, 'علام') !== false || mb_strpos($userMessage, 'ارفع') !== false) {
                $reply = $responses['معدل'];
            }
            elseif (mb_strpos($userMessage, 'خطت') !== false || mb_strpos($userMessage, 'خطة') !== false) {
                $reply = $responses['خطة'];
            }
            elseif (mb_strpos($userMessage, 'ضف') !== false || mb_strpos($userMessage, 'ضيف') !== false || mb_strpos($userMessage, 'سجل') !== false) {
                // Mock AI Action: Find a random available course and add it to cart
                $course = \App\Models\Course::inRandomOrder()->first();
                if ($course) {
                    $cart = \App\Models\UserCart::firstOrCreate(['user_id' => Auth::id()]);
                    $cart->courses()->syncWithoutDetaching([$course->id]);
                    $reply = "تم إضافة مادة ({$course->name}) إلى محاكي خطتك بناءً على طلبك! تفقد الخريطة لترى التأثير.";
                    $action = 'update_cart';
                    $newCartIds = $cart->courses()->pluck('course_id')->toArray();
                }
            }

            return response()->json([
                'status' => 'success',
                'reply' => $reply,
                'action' => $action,
                'cart_ids' => $newCartIds
            ]);

        }
        catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'حدث خطأ أثناء الاتصال بالمرشد الذكي.'
            ], 500);
        }
    }
}