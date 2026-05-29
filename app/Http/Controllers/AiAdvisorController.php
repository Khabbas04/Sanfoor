<?php

namespace App\Http\Controllers;

use App\Models\Chat;
use App\Models\Course;
use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class AiAdvisorController extends Controller
{
    private const MAX_CONTEXT_MESSAGES = 8;
    private const RATE_LIMIT_PER_HOUR = 40;
    private const MAX_FOLLOW_UP_SUGGESTIONS = 3;
    private const MAX_WIDGET_ITEMS = 8;
    private const MAX_HOURS_NORMAL = 18;
    private const MAX_HOURS_PROBATION = 12;
    private const ENABLE_SMART_TITLE = false;
    private const DAILY_LIMIT = 5;

    private ?string $workingApiKey = null;

    public function index()
    {
        $user = Auth::user();

        if (!$user) {
            abort(403);
        }

        // Clear academic cache on page load to guarantee fresh cart and grades status
        $this->clearStudentCache($user->id);

        $user->load(['major', 'cartCourses', 'passedCourses']);

        $gpaData = $user->calculateGPA();
        $hasAcademicRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
        $isProbation = $hasAcademicRecords && isset($gpaData['percentage']) && (float) $gpaData['percentage'] < 60;

        $totalPassedHours = $user->passedCourses->sum('credit_hours');
        $cartHours = $user->cartCourses->sum('credit_hours');
        $totalPlanHours = $user->major && method_exists($user->major, 'getTotalHours') ? $user->major->getTotalHours() : null;
        $progressPercent = $totalPlanHours ? round(($totalPassedHours / max($totalPlanHours, 1)) * 100) : null;

        $chats = $user->chats()
            ->select('id', 'title', 'created_at')
            ->orderByDesc('created_at')
            ->get();

        $apiKeys = $this->getGeminiApiKeys();
        
        $usageKey = "ai_daily_usage_" . $user->id . "_" . date('Y-m-d');
        $usage = (int) Cache::get($usageKey, 0);
        $remaining = max(0, self::DAILY_LIMIT - $usage);

        return Inertia::render('Ai/Advisor', [
            'studentStats' => [
                'name' => $user->name ?? 'طالب',
                'major' => $user->major?->name ?? 'غير محدد',
                'gpa' => isset($gpaData['percentage']) ? number_format((float) $gpaData['percentage'], 2) : null,
                'gpa_percentage' => $gpaData['percentage'] ?? null,
                'hours_completed' => $totalPassedHours,
                'total_plan_hours' => $totalPlanHours,
                'progress_percent' => $progressPercent,
                'cart_hours' => $cartHours,
                'max_allowed_hours' => $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL,
                'is_probation' => $isProbation,
                'has_academic_records' => $hasAcademicRecords,
            ],
            'chats' => $chats,
            'initialCartIds' => $user->cartCourses->pluck('id')->toArray(),
            'dailyMessagesRemaining' => $remaining,
            'isAiActive' => !empty($apiKeys),
        ]);
    }

    public function getMessages($chat_id)
    {
        $chat = Chat::findOrFail($chat_id);

        if ($chat->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json($chat->messages()->orderBy('created_at')->get());
    }

    public function chat(Request $request)
    {
        set_time_limit(0);

        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'chat_id' => ['nullable', 'integer', 'exists:chats,id'],
        ]);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 403);
        }

        // Check student's daily message limits (max 5 per day)
        $usageKey = "ai_daily_usage_" . $user->id . "_" . date('Y-m-d');
        $usage = (int) Cache::get($usageKey, 0);
        if ($usage >= self::DAILY_LIMIT) {
            return response()->json([
                'status' => 'error',
                'message' => 'لقد استهلكت جميع محاولاتك الـ 5 المتاحة اليوم للمستشار الأكاديمي. حاول غداً ⏳',
                'daily_messages_remaining' => 0
            ], 429);
        }

        // Clear academic data cache to ensure fresh analysis
        $this->clearStudentCache($user->id);

        if (!$this->checkRateLimit($user->id)) {
            return response()->json([
                'status' => 'success',
                'reply' => '⏳ وصلت للحد الأقصى من الرسائل لهذا الوقت. حاول لاحقاً.',
                'suggested_courses' => [],
                'courses_to_remove' => [],
                'follow_up_suggestions' => [],
                'interactive_widget' => null,
                'chat_id' => $data['chat_id'] ?? null,
                'daily_messages_remaining' => max(0, self::DAILY_LIMIT - $usage)
            ]);
        }

        $chat = $this->resolveChat($user, $data['chat_id'] ?? null, $data['message']);
        $chatId = $chat->id;
        $isNewChat = $chat->wasRecentlyCreated;

        $chat->messages()->create([
            'role' => 'user',
            'content' => $data['message'],
        ]);

        $academicData = $this->getStudentAcademicData($user);
        $cartData = $this->getCartData($user);
        $availableCourses = $this->getAvailableCourses($academicData['passed_course_ids'], $cartData['ids'], $user);

        $apiKeys = $this->getGeminiApiKeys();
        $useFallback = empty($apiKeys);

        try {
            if ($useFallback) {
                $parsed = $this->getLocalFallbackResponse($data['message'], $user, $academicData, $cartData, $availableCourses);
                
                $replyText = $parsed['reply'];
                $followUpSuggestions = $parsed['follow_up_suggestions'];
                $interactiveWidget = $parsed['interactive_widget'];
                $suggestedDetails = $parsed['suggested_courses'];
                $removeDetails = $parsed['courses_to_remove'];
            } else {
                $systemPrompt = $this->buildSystemPrompt($user, $academicData, $cartData, $availableCourses, $data['message']);
                $contents = $this->buildConversationContext($chat, $systemPrompt);

                $rawText = $this->callGeminiAPI($contents, $apiKeys);
                $parsed = $this->parseAIResponse($rawText);

                $replyText = $this->normalizeReplyText((string) ($parsed['reply'] ?? ''));
                $followUpSuggestions = $this->sanitizeFollowUpSuggestions($parsed['follow_up_suggestions'] ?? []);
                $interactiveWidget = $this->sanitizeInteractiveWidget($parsed['interactive_widget'] ?? null);
                $interactiveWidget = $this->enrichWidgetWithCourseIds($interactiveWidget, $availableCourses['map'], $cartData['map']);

                $matched = $this->matchCoursesInReply($replyText, $availableCourses['map'], $cartData['map']);
                $suggestedDetails = !empty($matched['suggested'])
                    ? Course::whereIn('id', $matched['suggested'])->select('id', 'name', 'code', 'credit_hours', 'description')->get()->toArray()
                    : [];
                $removeDetails = !empty($matched['remove'])
                    ? Course::whereIn('id', $matched['remove'])->select('id', 'name', 'code', 'credit_hours', 'description')->get()->toArray()
                    : [];
            }

            $chat->messages()->create([
                'role' => 'ai',
                'content' => json_encode([
                    'reply' => $replyText,
                    'suggested_courses' => $suggestedDetails,
                    'courses_to_remove' => $removeDetails,
                    'follow_up_suggestions' => $followUpSuggestions,
                    'interactive_widget' => $interactiveWidget,
                ], JSON_UNESCAPED_UNICODE),
            ]);

            if ($isNewChat) {
                $title = !$useFallback && self::ENABLE_SMART_TITLE
                    ? $this->generateSmartTitle($data['message'], $replyText, $this->workingApiKey ?? $apiKeys[0])
                    : $this->makeFallbackTitle($data['message']);

                $chat->update(['title' => $title]);
            }

            // Increment daily message usage on success
            Cache::put($usageKey, $usage + 1, now()->endOfDay());
            $newRemaining = max(0, self::DAILY_LIMIT - ($usage + 1));

            return response()->json([
                'status' => 'success',
                'reply' => $replyText,
                'suggested_courses' => $suggestedDetails,
                'courses_to_remove' => $removeDetails,
                'follow_up_suggestions' => $followUpSuggestions,
                'interactive_widget' => $interactiveWidget,
                'chat_id' => $chatId,
                'chat_title' => $isNewChat ? $chat->title : null,
                'daily_messages_remaining' => $newRemaining,
                'is_fallback' => $useFallback,
            ]);
        } catch (\Throwable $e) {
            Log::error('Gemini AI Error: ' . $e->getMessage(), [
                'line' => $e->getLine(),
                'file' => $e->getFile(),
            ]);

            // Attempt dynamic fallback if API fails
            try {
                $parsed = $this->getLocalFallbackResponse($data['message'], $user, $academicData, $cartData, $availableCourses);
                
                $replyText = "💡 *(مستشار سنفور البديل)*\n\n" . $parsed['reply'];
                $followUpSuggestions = $parsed['follow_up_suggestions'];
                $interactiveWidget = $parsed['interactive_widget'];
                $suggestedDetails = $parsed['suggested_courses'];
                $removeDetails = $parsed['courses_to_remove'];

                $chat->messages()->create([
                    'role' => 'ai',
                    'content' => json_encode([
                        'reply' => $replyText,
                        'suggested_courses' => $suggestedDetails,
                        'courses_to_remove' => $removeDetails,
                        'follow_up_suggestions' => $followUpSuggestions,
                        'interactive_widget' => $interactiveWidget,
                    ], JSON_UNESCAPED_UNICODE),
                ]);

                // Increment daily message usage on fallback success
                Cache::put($usageKey, $usage + 1, now()->endOfDay());
                $newRemaining = max(0, self::DAILY_LIMIT - ($usage + 1));

                return response()->json([
                    'status' => 'success',
                    'reply' => $replyText,
                    'suggested_courses' => $suggestedDetails,
                    'courses_to_remove' => $removeDetails,
                    'follow_up_suggestions' => $followUpSuggestions,
                    'interactive_widget' => $interactiveWidget,
                    'chat_id' => $chatId,
                    'chat_title' => $isNewChat ? $chat->title : null,
                    'daily_messages_remaining' => $newRemaining,
                    'is_fallback' => true,
                ]);
            } catch (\Throwable $fallbackEx) {
                return response()->json([
                    'status' => 'success',
                    'reply' => '⚠️ واجهت مشكلة فنية مؤقتة بالوصول لمساعد سنفور الأكاديمي. يرجى المحاولة مرة أخرى لاحقاً.',
                    'suggested_courses' => [],
                    'courses_to_remove' => [],
                    'follow_up_suggestions' => [],
                    'interactive_widget' => null,
                    'chat_id' => $chatId,
                    'daily_messages_remaining' => max(0, self::DAILY_LIMIT - $usage),
                    'is_fallback' => true,
                ]);
            }
        }
    }

    public function regenerate(Request $request)
    {
        $data = $request->validate([
            'chat_id' => ['required', 'integer', 'exists:chats,id'],
        ]);

        $chat = Chat::findOrFail($data['chat_id']);
        if ($chat->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $lastAiMessage = $chat->messages()->where('role', 'ai')->latest()->first();
        if ($lastAiMessage) {
            $lastAiMessage->delete();
        }

        $lastUserMessage = $chat->messages()->where('role', 'user')->latest()->first();
        if (!$lastUserMessage) {
            return response()->json(['status' => 'error', 'message' => 'لا يوجد رسالة لإعادة توليدها.'], 400);
        }

        $lastUserMessage->delete();

        return $this->chat(new Request([
            'message' => $lastUserMessage->content,
            'chat_id' => $chat->id,
        ]));
    }

    public function feedback(Request $request)
    {
        $data = $request->validate([
            'message_id' => ['required', 'integer', 'exists:messages,id'],
            'rating' => ['required', 'in:up,down'],
            'comment' => ['nullable', 'string', 'max:500'],
        ]);

        $message = Message::findOrFail($data['message_id']);
        $chat = $message->chat;

        if (!$chat || $chat->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!Schema::hasTable('ai_feedbacks')) {
            return response()->json(['status' => 'saved']);
        }

        DB::table('ai_feedbacks')->updateOrInsert(
            ['message_id' => $message->id, 'user_id' => Auth::id()],
            [
                'rating' => $data['rating'],
                'comment' => $data['comment'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return response()->json(['status' => 'saved']);
    }

    public function destroy($chatId)
    {
        $chat = Chat::findOrFail($chatId);
        if ($chat->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $chat->messages()->delete();
        $chat->delete();

        return response()->json(['status' => 'deleted']);
    }

    public function destroyAll()
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $chatIds = $user->chats()->pluck('id');
        Message::whereIn('chat_id', $chatIds)->delete();
        $user->chats()->delete();

        return response()->json(['status' => 'all_deleted']);
    }

    public function getAdminReports()
    {
        try {
            $currentPeriod = \App\Models\AcademicPeriod::current();
            $hasPeriodColumns = Schema::hasColumn('user_carts', 'academic_year') && Schema::hasColumn('user_carts', 'academic_term');

            $query = DB::table('user_carts')
                ->join('courses', 'user_carts.course_id', '=', 'courses.id')
                ->select('courses.name', 'courses.code', DB::raw('count(user_carts.user_id) as student_count'));

            if ($currentPeriod && $hasPeriodColumns) {
                $query->where('user_carts.academic_year', $currentPeriod->academic_year)
                      ->where('user_carts.academic_term', $currentPeriod->academic_term);
            }

            $topDemandedCourses = $query->groupBy('courses.id', 'courses.name', 'courses.code')
                ->orderByDesc('student_count')
                ->limit(10)
                ->get();
        } catch (\Throwable $e) {
            $topDemandedCourses = collect();
        }

        $feedbackStats = Schema::hasTable('ai_feedbacks')
            ? DB::table('ai_feedbacks')
                ->selectRaw("count(case when rating = 'up' then 1 end) as positive")
                ->selectRaw("count(case when rating = 'down' then 1 end) as negative")
                ->selectRaw('count(*) as total')
                ->first()
            : (object) ['positive' => 0, 'negative' => 0, 'total' => 0];

        return response()->json([
            'demanded_courses' => $topDemandedCourses,
            'graduation_status' => DB::table('course_user')
                ->join('courses', 'course_user.course_id', '=', 'courses.id')
                ->select('user_id', DB::raw('sum(courses.credit_hours) as total_hours'))
                ->groupBy('user_id')
                ->get(),
            'ai_stats' => [
                'total_chats' => Chat::count(),
                'total_messages' => Message::count(),
                'active_users_today' => Chat::whereDate('created_at', today())->distinct('user_id')->count('user_id'),
                'avg_messages_per_chat' => round(Message::count() / max(Chat::count(), 1), 1),
            ],
            'top_questions' => Message::where('role', 'user')
                ->where('created_at', '>=', now()->subDays(7))
                ->select('content', DB::raw('count(*) as count'))
                ->groupBy('content')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
            'feedback_stats' => $feedbackStats,
        ]);
    }

    private function resolveChat($user, ?int $chatId, string $message): Chat
    {
        if ($chatId) {
            $chat = Chat::findOrFail($chatId);
            if ($chat->user_id !== $user->id) {
                abort(403, 'Unauthorized');
            }

            return $chat;
        }

        return $user->chats()->create([
            'title' => $this->makeFallbackTitle($message),
        ]);
    }

    private function makeFallbackTitle(string $message): string
    {
        $title = trim(mb_substr($message, 0, 35));

        return $title === '' ? 'محادثة جديدة' : $title . (mb_strlen($message, 'UTF-8') > 35 ? '...' : '');
    }

    private function clearStudentCache(int $userId): void
    {
        Cache::forget("student_academic_data_{$userId}");
        Cache::forget("student_cart_data_{$userId}");
    }

    private function getStudentAcademicData($user): array
    {
        $cacheKey = "student_academic_data_{$user->id}";
        return Cache::remember($cacheKey, 600, function() use ($user) {
            $user->loadMissing(['major', 'passedCourses', 'cartCourses']);
            $gpaData = $user->calculateGPA();
            $hasAcademicRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
            $isProbation = $hasAcademicRecords && isset($gpaData['percentage']) && (float) $gpaData['percentage'] < 60;

            return [
                'major_name' => $user->major?->name ?? 'تخصص عام',
                'gpa_data' => $gpaData,
                'is_probation' => $isProbation,
                'has_academic_records' => $hasAcademicRecords,
                'passed_course_ids' => $user->passedCourses->pluck('id')->toArray(),
                'passed_courses_names' => $user->passedCourses->pluck('name')->implode('، '),
                'total_passed_hours' => $user->passedCourses->sum('credit_hours'),
                'total_plan_hours' => $user->major && method_exists($user->major, 'getTotalHours') ? $user->major->getTotalHours() : 132,
                'max_allowed_hours' => $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL,
                'passed_university_req' => $user->passedCourses->where('type', 'university_req')->sum('credit_hours'),
                'passed_compulsory' => $user->passedCourses->where('type', 'compulsory')->sum('credit_hours'),
                'passed_elective' => $user->passedCourses->where('type', 'elective')->sum('credit_hours'),
                'passed_supporting' => $user->passedCourses->where('type', 'supporting')->sum('credit_hours'),
            ];
        });
    }

    private function getCartData($user): array
    {
        $cacheKey = "student_cart_data_{$user->id}";
        return Cache::remember($cacheKey, 600, function() use ($user) {
            $user->loadMissing('cartCourses');
            $map = $user->cartCourses->pluck('name', 'id')->toArray();

            return [
                'ids' => $user->cartCourses->pluck('id')->toArray(),
                'map' => $map,
                'list' => implode(' | ', $map),
                'hours' => $user->cartCourses->sum('credit_hours'),
            ];
        });
    }

    private function checkRateLimit(int $userId): bool
    {
        $key = "ai_rate_limit_{$userId}";
        $current = (int) Cache::get($key, 0);

        if ($current >= self::RATE_LIMIT_PER_HOUR) {
            return false;
        }

        Cache::put($key, $current + 1, now()->addHour());

        return true;
    }

    private function getAvailableCourses(array $passedCourseIds, array $cartCourseIds, $user): array
    {
        $passedStr = implode(',', $passedCourseIds);
        $cartStr = implode(',', $cartCourseIds);
        $cacheKey = "student_available_courses_{$user->id}_{$passedStr}_{$cartStr}";

        return Cache::remember($cacheKey, 600, function() use ($passedCourseIds, $cartCourseIds, $user) {
            $planVersion = (int) ($user->study_plan_version ?? 12);

            $courses = Course::with(['prerequisites', 'children'])
                ->where(function ($query) use ($user, $planVersion) {
                    if ($user->major_id) {
                        $query->where(function ($majorScope) use ($user, $planVersion) {
                            $majorScope->where('major_id', $user->major_id)
                                ->where('study_plan_version', $planVersion);
                        })->orWhere(function ($universityScope) use ($planVersion) {
                            $universityScope->whereNull('major_id')
                                ->where('study_plan_version', $planVersion);
                        });
                    } else {
                        $query->whereNull('major_id')->where('study_plan_version', $planVersion);
                    }
                })
                ->whereNotIn('id', $passedCourseIds)
                ->get();

            $map = [];
            $text = [];
            $details = [];
            $allEligible = [];

            foreach ($courses as $course) {
                $canTake = true;
                foreach ($course->prerequisites as $prereq) {
                    if (!in_array($prereq->id, $passedCourseIds, true)) {
                        $canTake = false;
                        break;
                    }
                }

                if (!$canTake) {
                    continue;
                }

                $map[$course->id] = $course->name;

                $courseYear = 1;
                if (strlen((string) $course->code) >= 4) {
                    $fourthDigit = (int) substr((string) $course->code, 3, 1);
                    $courseYear = ($fourthDigit >= 1 && $fourthDigit <= 5) ? $fourthDigit : 1;
                }

                $prereqCount = $course->prerequisites->count();
                $unlocksCount = $course->children->count();
                $inCart = in_array($course->id, $cartCourseIds, true);
                $manualDifficulty = max(1, min(5, (int) ($course->difficulty_level ?? 3)));
                $courseType = $course->type ?? 'غير محدد';

                $allEligible[] = [
                    'id' => $course->id,
                    'name' => $course->name,
                    'code' => $course->code,
                    'credit_hours' => $course->credit_hours,
                    'course_year' => $courseYear,
                    'type' => $courseType,
                    'prereq_count' => $prereqCount,
                    'unlocks' => $unlocksCount,
                    'in_cart' => $inCart,
                    'difficulty_level' => $manualDifficulty,
                ];

                $details[$course->id] = [
                    'name' => $course->name,
                    'code' => $course->code,
                    'credit_hours' => $course->credit_hours,
                    'course_year' => $courseYear,
                    'type' => $courseType,
                    'difficulty_level' => $manualDifficulty,
                    'prereq_count' => $prereqCount,
                    'unlocks' => $unlocksCount,
                    'in_cart' => $inCart,
                ];
            }

            $totalPassedHours = $user->passedCourses->sum('credit_hours');
            $studentYear = max(1, min(5, (int) ceil($totalPassedHours / 33)));

            usort($allEligible, function ($a, $b) use ($studentYear) {
                if ($a['in_cart'] !== $b['in_cart']) {
                    return $b['in_cart'] <=> $a['in_cart'];
                }
                if ($a['unlocks'] !== $b['unlocks']) {
                    return $b['unlocks'] <=> $a['unlocks'];
                }
                $diffA = abs($a['course_year'] - $studentYear);
                $diffB = abs($b['course_year'] - $studentYear);
                return $diffA <=> $diffB;
            });

            $topEligible = array_slice($allEligible, 0, 20);

            foreach ($topEligible as $course) {
                $line = "- {$course['name']} (رمز: {$course['code']}, ساعات: {$course['credit_hours']}, سنة: {$course['course_year']}, نوع: {$course['type']}, تفتح: {$course['unlocks']} مواد, صعوبة: {$course['difficulty_level']})";
                if ($course['in_cart']) {
                    $line .= ' [🛒 بالجدول التجريبي حالياً]';
                }
                $text[] = $line;
            }

            return [
                'map' => $map,
                'text' => $text ? implode("\n", $text) : 'لا يوجد مواد متاحة للتسجيل حالياً!',
                'details' => $details,
            ];
        });
    }

    private function buildStudentAdvisingRagContext(array $academicData, array $cartData, array $availableCourses, string $userMessage): string
    {
        $normalized = $this->normalizeArabic($userMessage);
        $intent = 'عام';

        if (preg_match('/(معدل|gpa|انذار|إنذار|رفع)/u', $normalized)) {
            $intent = 'رفع_المعدل';
        } elseif (preg_match('/(تخرج|خطة|مسار|فتح|متطلبات)/u', $normalized)) {
            $intent = 'تسريع_التخرج';
        } elseif (preg_match('/(تخفيف|ضغط|عبء|سهل|خفيف)/u', $normalized)) {
            $intent = 'تخفيف_العبء';
        }

        $availableDetails = array_values($availableCourses['details'] ?? []);
        usort($availableDetails, fn ($a, $b) => ($b['unlocks'] <=> $a['unlocks']) ?: ($a['prereq_count'] <=> $b['prereq_count']));

        $strategic = array_map(
            fn ($course) => "- {$course['name']} | سنة {$course['course_year']} | {$course['credit_hours']}س | يفتح {$course['unlocks']} | متطلبات {$course['prereq_count']}",
            array_slice($availableDetails, 0, 5)
        );

        $easy = [];
        $balanced = [];
        $heavy = [];

        foreach ($availableDetails as $course) {
            $difficulty = (int) ($course['difficulty_level'] ?? 3);
            if ($difficulty <= 2) {
                $easy[] = $course['name'];
            } elseif ($difficulty >= 4) {
                $heavy[] = $course['name'];
            } else {
                $balanced[] = $course['name'];
            }
        }

        $hoursState = ($cartData['hours'] ?? 0) > ($academicData['max_allowed_hours'] ?? self::MAX_HOURS_NORMAL) ? 'متجاوز_الحد' : 'ضمن_الحد';

        return "\n🎯 [RAG الإرشاد الطلابي]:\n- نية_السؤال: {$intent}\n- ساعات_الطالب_المنجزة: " . ($academicData['total_passed_hours'] ?? 0) . "\n- ساعات_التسجيل_التجريبي_الحالية: " . ($cartData['hours'] ?? 0) . "\n- حالة_الساعات: {$hoursState}\n- عدد_مواد_التسجيل_التجريبي: " . count($cartData['ids'] ?? []) . "\n- مواد_استراتيجية_مرشحة:\n" . ($strategic ? implode("\n", $strategic) : '- لا توجد مواد مرشحة حالياً') . "\n- عينات_حسب_تصنيف_الصعوبة_الاداري:\n  - خفيف: " . ($easy ? implode(' | ', array_slice($easy, 0, 4)) : 'لا يوجد') . "\n  - متوازن: " . ($balanced ? implode(' | ', array_slice($balanced, 0, 4)) : 'لا يوجد') . "\n  - مكثف: " . ($heavy ? implode(' | ', array_slice($heavy, 0, 4)) : 'لا يوجد');
    }

    private function buildSystemPrompt($user, array $academicData, array $cartData, array $availableCourses, string $ragContext = ''): string
    {
        $totalPassedHours = (int) ($academicData['total_passed_hours'] ?? 0);
        $studentYear = max(1, min(5, (int) ceil($totalPassedHours / 33)));
        $studentYearLabels = [1 => 'أولى', 2 => 'ثانية', 3 => 'ثالثة', 4 => 'رابعة', 5 => 'خامسة'];

        $gpa = $academicData['gpa_data']['percentage'] ?? 0;
        $gpa4 = $academicData['gpa_data']['gpa4'] ?? 0;
        $probationStatus = $academicData['is_probation']
            ? "🚨 نعم — إنذار أكاديمي! (الحد الأقصى {$academicData['max_allowed_hours']} ساعة فقط)"
            : "لا (الحد الأقصى {$academicData['max_allowed_hours']} ساعة)";

        $progressText = '';
        if (!empty($academicData['total_plan_hours'])) {
            $percent = round(($academicData['total_passed_hours'] / max((int) $academicData['total_plan_hours'], 1)) * 100);
            $progressText = "\n- التقدم نحو التخرج: {$academicData['total_passed_hours']}/{$academicData['total_plan_hours']} ساعة ({$percent}%)";
        }

        $cartWarning = '';
        if (($cartData['hours'] ?? 0) > ($academicData['max_allowed_hours'] ?? self::MAX_HOURS_NORMAL)) {
            $excess = $cartData['hours'] - $academicData['max_allowed_hours'];
            $cartWarning = "\n⚠️ تنبيه: التسجيل التجريبي يحتوي {$cartData['hours']} ساعة ويتجاوز الحد المسموح بـ {$excess} ساعة!";
        }

        $studentYearLabel = $studentYearLabels[$studentYear] ?? 'أولى';

        return "أنت مرشد أكاديمي ذكي لتطبيق 'سنفور' الخاص بطلاب جامعة الزرقاء. دورك: إجابة أسئلة الطلاب عن الإرشاد الأكاديمي والجامعة وتخطيط الجداول باحتراف وذكاء.\nالقواعد:\n" .
            "- كن مختصراً ومباشراً (Direct)، ولا تكرر سؤال الطالب.\n" .
            "- ركز على توزيع الحمل الدراسي والتأكد من توافق الجدول مع التقسيمة الصحيحة لساعات الخطة.\n" .
            "- استخدم ايموجيات خفيفة وميّز الكلمات المهمة بالخط العريض (**bold**).\n\n" .
            "هيكلة متطلبات الخطة الدراسية للتخرج (132 ساعة كحد أدنى):\n" .
            "- متطلبات الجامعة الإجبارية (متوفرة أونلاين): 30 ساعة.\n" .
            "- متطلبات التخصص الإجبارية: 87 ساعة.\n" .
            "- متطلبات التخصص الاختيارية: 9 ساعات.\n" .
            "- المواد المساندة: 6 ساعات.\n" .
            "عليك استخدام هذه التقسيمة لتخطيط الجدول للطالب وتوجيهه للمواد التي تنقصه بذكاء، مع تجنب اقتراح مواد تتجاوز الساعات المطلوبة في كل فئة.\n\n" .
            "معلومات ثابتة عن الجامعة (مباني وكليات):\n" .
            "- أ.ب: الفاروق (شريعة، آداب، IT، تربوية).\n" .
            "- ت: علوم طبية مساندة، الزرقاء التقنية.\n" .
            "- د.هـ: الدوازي (التمريض، الصيدلة، العلوم).\n" .
            "- ل: هندسة، فنون.\n" .
            "- ص: صحافة، حقوق.\n" .
            "- ق: الشهيد معاذ (اقتصاد، دراسات عليا).\n" .
            "- ط: طب الأسنان.\n" .
            "- الطوابق: 100=الأول، 200=الثاني، 300=الثالث.\n\n" .
            "سياق RAG:\n" . ($ragContext ?: 'لا يوجد سياق إضافي حالياً.') . "\n\n" .
            "بيانات الطالب المختصرة: {$user->name} | {$academicData['major_name']} | سنة {$studentYearLabel} | معدل {$gpa}%\n" .
            "التقدم حسب أقسام الخطة:\n" .
            "- متطلبات الجامعة: أنجز {$academicData['passed_university_req']} / 30 ساعة\n" .
            "- تخصص إجباري: أنجز {$academicData['passed_compulsory']} / 87 ساعة\n" .
            "- تخصص اختياري: أنجز {$academicData['passed_elective']} / 9 ساعات\n" .
            "- مساندة: أنجز {$academicData['passed_supporting']} / 6 ساعات\n" .
            "التسجيل التجريبي الحالي: " . ($cartData['list'] ?: 'فارغ') . " ({$cartData['hours']}س)" . ($cartWarning ? " | تنبيه: تجاوز الحد المسموح {$academicData['max_allowed_hours']}س" : '') . "\n\n" .
            "المواد المتاحة للتسجيل للطالب:\n{$availableCourses['text']}\n\n" .
            "⚠️ شكل الرد الإجباري (JSON صالح فقط):\n" .
            "{\"reply\":\"...\",\"suggested_courses\":[],\"courses_to_remove\":[],\"follow_up_suggestions\":[\"...\"],\"interactive_widget\":null}";
    }

    private function buildConversationContext($chat, string $systemPrompt): array
    {
        $messages = $chat->messages()->orderBy('created_at')->get();
        $messagesToSend = $messages;
        $summaryPrefix = '';

        if ($messages->count() > self::MAX_CONTEXT_MESSAGES) {
            $firstTwo = $messages->take(2);
            $lastN = $messages->slice(-1 * (self::MAX_CONTEXT_MESSAGES - 2));
            $summaryPrefix = "\n[ملاحظة: تم اختصار " . ($messages->count() - self::MAX_CONTEXT_MESSAGES) . " رسالة سابقة]\n";
            $messagesToSend = $firstTwo->merge($lastN);
        }

        $contents = [];
        foreach ($messagesToSend as $index => $message) {
            $text = (string) $message->content;

            if ($message->role === 'ai') {
                $decoded = json_decode($text, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($decoded['reply'])) {
                    $text = (string) $decoded['reply'];
                }
            }

            if ($index === 0 && $message->role === 'user') {
                $text = "تعليمات النظام (لا تظهر للطالب):\n{$systemPrompt}{$summaryPrefix}\n\nسؤال الطالب:\n{$text}";
            }

            $contents[] = [
                'role' => $message->role === 'ai' ? 'model' : 'user',
                'parts' => [['text' => $text]],
            ];
        }

        return $contents;
    }

    private function getGeminiApiKeys(): array
    {
        $keys = [];
        $csv = (string) config('services.gemini.keys', '');

        foreach (explode(',', $csv) as $key) {
            $value = trim($key);
            if ($value !== '') {
                $keys[] = $value;
            }
        }

        $single = trim((string) config('services.gemini.key', ''));
        if ($single !== '') {
            $keys[] = $single;
        }

        return array_values(array_unique($keys));
    }

    private function callGeminiAPI(array $contents, array $apiKeys): string
    {
        if (empty($apiKeys)) {
            throw new \Exception('No Gemini API keys configured');
        }

        // Prioritize working models: gemini-2.5-flash first (known to work), fallback to others
        $models = array_values(array_filter([
            'gemini-2.5-flash',
            'gemini-2.0-flash-lite',
            config('services.gemini.model'),
        ]));

        $lastError = 'Unknown Gemini error';

        foreach ($apiKeys as $keyIndex => $apiKey) {
            $keyQuotaExhausted = false;
            foreach ($models as $modelIndex => $model) {
                if ($keyQuotaExhausted) {
                    break;
                }

                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

                try {
                    $requestContents = $contents;
                    $fullText = '';
                    $backoffMs = 100;

                    for ($pass = 0; $pass <= 2; $pass++) {
                        for ($retryCount = 0; $retryCount < 3; $retryCount++) {
                            try {
                                $response = Http::withoutVerifying()
                                    ->connectTimeout(8)
                                    ->timeout(45)
                                    ->withHeaders(['Content-Type' => 'application/json'])
                                    ->post($url, [
                                        'contents' => $requestContents,
                                        'generationConfig' => [
                                            'responseMimeType' => 'application/json',
                                            'temperature' => 0.35,
                                        ],
                                    ]);

                                // Handle rate limiting (429) and invalid/blocked keys (400, 401, 403)
                                if (in_array($response->status(), [400, 401, 403, 429])) {
                                    $lastError = "key#" . ($keyIndex + 1) . " {$model}: HTTP " . $response->status() . " (key exhausted/invalid)";
                                    $keyQuotaExhausted = true;
                                    break 3; // Move to next API key
                                } elseif ($response->status() === 503) {
                                    if ($retryCount < 2) {
                                        usleep($backoffMs * 1000);
                                        $backoffMs *= 2;
                                        continue; // Retry with backoff
                                    }
                                    $lastError = "key#" . ($keyIndex + 1) . " {$model}: HTTP 503 (high demand)";
                                    continue 3; // Try next model
                                }

                                if (!$response->successful()) {
                                    $lastError = "key#" . ($keyIndex + 1) . " {$model}: HTTP {$response->status()}";
                                    continue 3; // Try next model
                                }

                                break; // Success, exit retry loop
                            } catch (\Exception $e) {
                                if ($retryCount < 2) {
                                    usleep($backoffMs * 1000);
                                    $backoffMs *= 2;
                                    continue;
                                }
                                throw $e;
                            }
                        }

                        $candidate = $response->json('candidates.0');
                        $chunk = $candidate['content']['parts'][0]['text'] ?? null;

                        if (!is_string($chunk) || trim($chunk) === '') {
                            $lastError = "key#" . ($keyIndex + 1) . " {$model}: empty candidate text";
                            continue 3;
                        }

                        $fullText .= $chunk;

                        $finishReason = strtoupper((string) ($candidate['finishReason'] ?? ''));
                        $stopped = in_array($finishReason, ['MAX_TOKENS', 'LENGTH', 'FINISH_REASON_MAX_TOKENS'], true);
                        if (!$stopped || $pass >= 2) {
                            $this->workingApiKey = $apiKey;
                            return $fullText;
                        }

                        $requestContents[] = ['role' => 'model', 'parts' => [['text' => $chunk]]];
                        $requestContents[] = ['role' => 'user', 'parts' => [['text' => 'اكمل الرد من آخر نقطة فقط بدون إعادة أي جزء سابق.']]];
                    }

                    if ($fullText !== '') {
                        $this->workingApiKey = $apiKey;
                        return $fullText;
                    }
                } catch (\Throwable $e) {
                    $lastError = "key#" . ($keyIndex + 1) . " {$model}: {$e->getMessage()}";
                }
            }
        }

        throw new \Exception("Gemini API failed across all models and keys. Last error: {$lastError}");
    }

    private function parseAIResponse(string $rawText): array
    {
        $clean = trim((string) preg_replace('/```(?:json)?(.*?)```/is', '$1', $rawText));

        $decoded = json_decode($clean, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && isset($decoded['reply'])) {
            return [
                'reply' => (string) $decoded['reply'],
                'follow_up_suggestions' => $decoded['follow_up_suggestions'] ?? [],
                'interactive_widget' => $decoded['interactive_widget'] ?? null,
            ];
        }

        $jsonFragment = $this->extractJsonObject($clean);
        if ($jsonFragment !== null) {
            $decodedFragment = json_decode($jsonFragment, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedFragment) && isset($decodedFragment['reply'])) {
                return [
                    'reply' => (string) $decodedFragment['reply'],
                    'follow_up_suggestions' => $decodedFragment['follow_up_suggestions'] ?? [],
                    'interactive_widget' => $decodedFragment['interactive_widget'] ?? null,
                ];
            }
        }

        if (preg_match('/"reply"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s', $clean, $matches)) {
            return [
                'reply' => str_replace(['\\n', '\\"'], ["\n", '"'], $matches[1]),
                'follow_up_suggestions' => [],
                'interactive_widget' => null,
            ];
        }

        return [
            'reply' => $this->stripReplyEnvelope($clean) ?: 'ما وصلني رد واضح هذه المرة. حاول إعادة السؤال بصيغة أقصر.',
            'follow_up_suggestions' => [],
            'interactive_widget' => null,
        ];
    }

    private function extractJsonObject(string $text): ?string
    {
        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        return substr($text, $start, ($end - $start + 1));
    }

    private function stripReplyEnvelope(string $text): string
    {
        $value = trim($text);

        $decoded = json_decode($value, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && isset($decoded['reply'])) {
            return trim((string) $decoded['reply']);
        }

        $value = preg_replace('/,\s*["\']?(suggested_courses|courses_to_remove|follow_up_suggestions|interactive_widget)["\']?\s*:.*/isu', '', $value);
        if (preg_match('/^\s*["\']?reply["\']?\s*:\s*(.+)$/isu', $value, $matches)) {
            $value = $matches[1];
        }

        $value = preg_replace('/^\s*\{+\s*/u', '', $value);
        $value = preg_replace('/\s*\}+\s*$/u', '', $value);

        return trim($value, " \t\n\r\0\x0B\"'");
    }

    private function normalizeReplyText(string $text): string
    {
        $clean = str_replace(['\\n', '\n'], "\n", $text);
        $clean = preg_replace('/```(?:json|html|markdown)?(.*?)```/is', '$1', $clean);
        $clean = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $clean);
        $clean = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $clean);
        $clean = strip_tags($clean);
        $clean = html_entity_decode($clean, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $clean = preg_replace('/\n{3,}/', "\n\n", $clean);
        $clean = preg_replace('/[ \t]{2,}/', ' ', $clean);

        return trim($this->stripReplyEnvelope($clean)) ?: 'ما وصلني رد واضح هذه المرة. اكتب سؤالك بصيغة أقصر وأنا أجاوبك فوراً.';
    }

    private function sanitizeFollowUpSuggestions($suggestions): array
    {
        if (!is_array($suggestions)) {
            return [];
        }

        $clean = [];
        foreach ($suggestions as $item) {
            if (!is_string($item)) {
                continue;
            }

            $value = trim(strip_tags($item));
            if ($value !== '') {
                $clean[] = mb_substr($value, 0, 120, 'UTF-8');
            }
        }

        return array_slice(array_values(array_unique($clean)), 0, self::MAX_FOLLOW_UP_SUGGESTIONS);
    }

    private function sanitizeInteractiveWidget($widget): ?array
    {
        if (!is_array($widget) || !isset($widget['type']) || !is_string($widget['type'])) {
            return null;
        }

        return match (trim($widget['type'])) {
            'comparison' => [
                'type' => 'comparison',
                'title' => mb_substr(trim((string) ($widget['title'] ?? 'مقارنة المواد المقترحة')), 0, 120, 'UTF-8'),
                'items' => array_map(
                    fn ($item) => [
                        'id' => $item['id'] ?? null,
                        'name' => mb_substr(trim((string) ($item['name'] ?? '')), 0, 120, 'UTF-8'),
                        'code' => mb_substr(trim((string) ($item['code'] ?? '')), 0, 40, 'UTF-8'),
                        'credit_hours' => (int) ($item['credit_hours'] ?? 0),
                        'difficulty' => (int) ($item['difficulty'] ?? 0),
                        'unlocks' => (int) ($item['unlocks'] ?? 0),
                        'gpa_impact' => mb_substr(trim((string) ($item['gpa_impact'] ?? '')), 0, 40, 'UTF-8'),
                        'recommendation' => mb_substr(trim((string) ($item['recommendation'] ?? '')), 0, 120, 'UTF-8'),
                    ],
                    array_slice(is_array($widget['items'] ?? null) ? $widget['items'] : [], 0, self::MAX_WIDGET_ITEMS)
                ),
            ],
            'poll' => [
                'type' => 'poll',
                'question' => mb_substr(trim((string) ($widget['question'] ?? 'شو أولويتك هالفصل؟')), 0, 120, 'UTF-8'),
                'options' => array_map(
                    fn ($option) => [
                        'label' => mb_substr(trim((string) ($option['label'] ?? '')), 0, 80, 'UTF-8'),
                        'value' => mb_substr(trim((string) ($option['value'] ?? '')), 0, 40, 'UTF-8'),
                    ],
                    array_slice(is_array($widget['options'] ?? null) ? $widget['options'] : [], 0, 4)
                ),
            ],
            'hours_slider' => [
                'type' => 'hours_slider',
                'question' => mb_substr(trim((string) ($widget['question'] ?? 'كم ساعة حابب تسجل هالفصل؟')), 0, 120, 'UTF-8'),
                'min' => max(1, (int) ($widget['min'] ?? 9)),
                'max' => max(9, (int) ($widget['max'] ?? self::MAX_HOURS_NORMAL)),
                'default' => min(max((int) ($widget['default'] ?? 15), 1), max(9, (int) ($widget['max'] ?? self::MAX_HOURS_NORMAL))),
                'current_cart_hours' => max(0, (int) ($widget['current_cart_hours'] ?? 0)),
            ],
            'cart_review' => [
                'type' => 'cart_review',
                'title' => mb_substr(trim((string) ($widget['title'] ?? 'مراجعة التسجيل التجريبي الحالي')), 0, 120, 'UTF-8'),
                'courses' => array_map(
                    fn ($course) => [
                        'id' => $course['id'] ?? null,
                        'name' => mb_substr(trim((string) ($course['name'] ?? '')), 0, 120, 'UTF-8'),
                        'code' => mb_substr(trim((string) ($course['code'] ?? '')), 0, 40, 'UTF-8'),
                        'credit_hours' => (int) ($course['credit_hours'] ?? 0),
                        'difficulty' => (int) ($course['difficulty'] ?? 0),
                        'verdict' => mb_substr(trim((string) ($course['verdict'] ?? 'keep')), 0, 20, 'UTF-8'),
                        'reason' => mb_substr(trim((string) ($course['reason'] ?? '')), 0, 200, 'UTF-8'),
                    ],
                    array_slice(is_array($widget['courses'] ?? null) ? $widget['courses'] : [], 0, self::MAX_WIDGET_ITEMS)
                ),
                'summary' => [
                    'total_hours' => max(0, (int) (($widget['summary']['total_hours'] ?? 0))),
                    'max_hours' => max(0, (int) (($widget['summary']['max_hours'] ?? self::MAX_HOURS_NORMAL))),
                    'overall_difficulty' => mb_substr(trim((string) ($widget['summary']['overall_difficulty'] ?? 'متوسط')), 0, 40, 'UTF-8'),
                    'recommendation' => mb_substr(trim((string) ($widget['summary']['recommendation'] ?? '')), 0, 200, 'UTF-8'),
                ],
            ],
            default => null,
        };
    }

    private function enrichWidgetWithCourseIds(?array $widget, array $availableCoursesMap, array $cartCoursesMap): ?array
    {
        if (!$widget || !isset($widget['type'])) {
            return $widget;
        }

        $allCoursesMap = $availableCoursesMap + $cartCoursesMap;
        $findCourseId = function (?string $name) use ($allCoursesMap) {
            if (!$name) {
                return null;
            }

            $normalized = $this->normalizeArabic($name);
            foreach ($allCoursesMap as $id => $courseName) {
                if ($this->normalizeArabic($courseName) === $normalized) {
                    return $id;
                }
            }

            foreach ($allCoursesMap as $id => $courseName) {
                $normalizedCourse = $this->normalizeArabic($courseName);
                if (mb_strpos($normalizedCourse, $normalized) !== false || mb_strpos($normalized, $normalizedCourse) !== false) {
                    return $id;
                }
            }

            return null;
        };

        if ($widget['type'] === 'comparison' && isset($widget['items']) && is_array($widget['items'])) {
            foreach ($widget['items'] as &$item) {
                if (empty($item['id']) && !empty($item['name'])) {
                    $item['id'] = $findCourseId($item['name']);
                }
            }
            unset($item);
        }

        if ($widget['type'] === 'cart_review' && isset($widget['courses']) && is_array($widget['courses'])) {
            foreach ($widget['courses'] as &$course) {
                if (empty($course['id']) && !empty($course['name'])) {
                    $course['id'] = $findCourseId($course['name']);
                }
            }
            unset($course);
        }

        return $widget;
    }

    private function matchCoursesInReply(string $replyText, array $availableCoursesMap, array $cartCoursesMap): array
    {
        $normalizedReply = $this->normalizeArabic($replyText);
        $suggestedIds = [];
        $removeIds = [];

        foreach ($availableCoursesMap as $id => $name) {
            $normalizedName = $this->normalizeArabic($name);
            if (mb_strlen($normalizedName) >= 3 && mb_strpos($normalizedReply, $normalizedName) !== false) {
                $suggestedIds[] = $id;
            }
        }

        $removeKeywords = '(حذف|ازاله|إزالة|تخفيف|امسح|شيل|أزيل|ألغ|الغ|ارفع|اشيل)';
        foreach ($cartCoursesMap as $id => $name) {
            $normalizedName = $this->normalizeArabic($name);
            if (mb_strlen($normalizedName) < 3) {
                continue;
            }

            if (mb_strpos($normalizedReply, $normalizedName) !== false && (
                preg_match('/' . $removeKeywords . '.*?' . preg_quote($normalizedName, '/') . '/iu', $normalizedReply) ||
                preg_match('/' . preg_quote($normalizedName, '/') . '.*?' . $removeKeywords . '/iu', $normalizedReply)
            )) {
                $removeIds[] = $id;
            }
        }

        return [
            'suggested' => array_values(array_unique(array_filter(array_map('intval', $suggestedIds)))),
            'remove' => array_values(array_unique(array_filter(array_map('intval', $removeIds)))),
        ];
    }

    private function normalizeArabic($text): string
    {
        if (!$text) {
            return '';
        }

        $text = preg_replace('/[أإآا]/u', 'ا', (string) $text);
        $text = preg_replace('/[ةه]/u', 'ه', $text);
        $text = preg_replace('/ى/u', 'ي', $text);
        $text = preg_replace('/\s+/u', ' ', $text);

        return mb_strtolower(trim($text), 'UTF-8');
    }

    private function generateSmartTitle(string $userMessage, string $aiReply, string $apiKey): string
    {
        try {
            $prompt = "بناءً على هذا السؤال: \"{$userMessage}\"\nوهذا الجواب المختصر: \"" . mb_substr($aiReply, 0, 200) . "\"\n\nاكتب عنوان قصير جداً (3-6 كلمات عربية) يلخص الموضوع. أرجع النص فقط.";

            $response = Http::withoutVerifying()
                ->timeout(15)
                ->withHeaders(['Content-Type' => 'application/json'])
                ->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key={$apiKey}", [
                    'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                ]);

            if ($response->successful()) {
                $title = trim((string) $response->json('candidates.0.content.parts.0.text'));
                $title = trim(str_replace(['"', "'", '`', "\n"], '', $title));
                if (mb_strlen($title) > 2 && mb_strlen($title) < 60) {
                    return $title;
                }
            }
        } catch (\Throwable $e) {
            Log::debug('Smart title generation failed: ' . $e->getMessage());
        }

        return $this->makeFallbackTitle($userMessage);
    }

    private function getLocalFallbackResponse(string $message, $user, array $academicData, array $cartData, array $availableCourses): array
    {
        $normalized = $this->normalizeArabic($message);
        $reply = '';
        $suggestedIds = [];
        $followUps = [];
        $widget = null;

        $availableDetails = array_values($availableCourses['details'] ?? []);
        usort($availableDetails, fn($a, $b) => ($b['unlocks'] <=> $a['unlocks']));

        if (preg_match('/(معدل|gpa|انذار|إنذار|رفع|تراكمي)/u', $normalized)) {
            $reply = "أهلاً بك **{$user->name}**. لرفع معدلك التراكمي المتبقي لك، أنصحك بالتركيز على المواد ذات الطبيعة السهلة أو المعتدلة أولاً لتخفيف العبء الأكاديمي، وتجنب تسجيل ساعات مفرطة في فصل واحد. \n\nإليك بعض المواد المتاحة لك حالياً والتي يُنصح بها لرفع المعدل:";
            
            $easyCourses = array_filter($availableDetails, fn($c) => $c['difficulty_level'] <= 2);
            $easyCourses = array_slice($easyCourses, 0, 3);
            if (empty($easyCourses)) {
                $easyCourses = array_slice($availableDetails, 0, 2);
            }

            foreach ($easyCourses as $c) {
                $id = array_search($c['name'], $availableCourses['map']);
                if ($id) {
                    $suggestedIds[] = $id;
                    $reply .= "\n- **{$c['name']}** ({$c['credit_hours']} ساعات) - تصنيف الصعوبة خفيف.";
                }
            }
            $followUps = ['كيف أحسب معدلي المتوقع؟', 'ما هي شروط رفع الإنذار الأكاديمي؟'];
        } elseif (preg_match('/(تخرج|خطة|مسار|فتح|متطلبات|استراتيج|سنه)/u', $normalized)) {
            $reply = "أهلاً بك **{$user->name}**. لتسريع تخرجك وفتح المزيد من المواد في الفصول القادمة، يجب عليك إعطاء الأولوية **للمواد الاستراتيجية** (المواد التي تفتح مواد أخرى كمتطلب سابق).\n\nإليك أهم المواد الاستراتيجية المتاحة لك حالياً لتسجيلها:";
            
            $strategicCourses = array_slice($availableDetails, 0, 3);
            foreach ($strategicCourses as $c) {
                $id = array_search($c['name'], $availableCourses['map']);
                if ($id) {
                    $suggestedIds[] = $id;
                    $reply .= "\n- **{$c['name']}** (تفتح عدد {$c['unlocks']} مواد لاحقة!).";
                }
            }
            $followUps = ['هل يوجد مواد حرة بالخطة؟', 'ما هي المواد التي تفتح أكبر عدد من التخصص؟'];
        } elseif (preg_match('/(مبنى|كلية|قاعة|وين|اين|مكان|فاروق|دوازي)/u', $normalized)) {
            $reply = "دليل مباني جامعة الزرقاء السريع 🏛️:\n" .
                "- **مبنى الفاروق (أ.ب)**: يضم كليات الشريعة، الآداب، تكنولوجيا المعلومات، والعلوم التربوية.\n" .
                "- **مبنى (ت)**: يضم كلية العلوم الطبية المساندة والكلية التقنية.\n" .
                "- **مبنى الدوازي (د.هـ)**: يضم التمريض، الصيدلة، والعلوم.\n" .
                "- **مبنى (ل)**: يضم الهندسة التكنولوجية، الفنون والتصميم.\n" .
                "- **مبنى الشهيد معاذ الكساسبة (ق)**: يضم كلية الاقتصاد والعلوم الإدارية والدراسات العليا.\n\n" .
                "💡 **ملاحظة ترميز القاعات**: الرقم الأول يعبر عن الطابق (مثال: قاعة 102 في الطابق الأول، وقاعة 205 في الطابق الثاني).";
            $followUps = ['أين تقع المكتبة العامة؟', 'كيف أصل إلى القبول والتسجيل؟'];
        } else {
            $reply = "أهلاً بك يا **{$user->name}** في تطبيق سنفور 🤖. أنا مستشارك الأكاديمي الذكي المساعد لك.\n\nيمكنك سؤالي عن خطتك الدراسية، أو كيفية ترتيب جدولك الدراسي، أو أماكن الكليات ومباني الجامعة. \n\nلقد قمت بتحليل خطتك الأكاديمية، وإليك أهم المادتين المقترحتين لك لتسجيلهما في جدولك التجريبي الحالي:";
            
            $defaultSuggestions = array_slice($availableDetails, 0, 2);
            foreach ($defaultSuggestions as $c) {
                $id = array_search($c['name'], $availableCourses['map']);
                if ($id) {
                    $suggestedIds[] = $id;
                    $reply .= "\n- **{$c['name']}** ({$c['credit_hours']} ساعات) - مادة مهمة لمسارك الأكاديمي.";
                }
            }
            $followUps = ['اقترح علي جدول متوازن', 'أين تقع كلية الآي تي؟'];
        }

        $suggestedDetails = [];
        if (!empty($suggestedIds)) {
            $suggestedDetails = Course::whereIn('id', $suggestedIds)->select('id', 'name', 'code', 'credit_hours', 'description')->get()->toArray();
        }

        if (!empty($suggestedDetails)) {
            $widgetCourses = [];
            foreach ($suggestedDetails as $sc) {
                if (!in_array($sc['id'], $cartData['ids'])) {
                    $widgetCourses[] = [
                        'id' => $sc['id'],
                        'name' => $sc['name'],
                        'code' => $sc['code'],
                        'credit_hours' => $sc['credit_hours'],
                        'action' => 'add',
                    ];
                }
            }
            if (!empty($widgetCourses)) {
                $widget = [
                    'type' => 'cart_review',
                    'title' => 'أضف المقترحات للجدول التجريبي',
                    'courses' => array_map(fn($c) => [
                        'id' => $c['id'],
                        'name' => $c['name'],
                        'code' => $c['code'],
                        'credit_hours' => $c['credit_hours'],
                        'difficulty' => 2,
                        'verdict' => 'add',
                        'reason' => 'مادة مقترحة ومتاحة للتسجيل مباشرة'
                    ], $widgetCourses),
                    'summary' => [
                        'total_hours' => $cartData['hours'] + collect($widgetCourses)->sum('credit_hours'),
                        'max_hours' => $academicData['max_allowed_hours'],
                        'overall_difficulty' => 'متوازن',
                        'recommendation' => 'ننصح بإضافة المواد لبناء جدول دراسي متكامل'
                    ]
                ];
            }
        }

        return [
            'reply' => $reply,
            'suggested_courses' => $suggestedDetails,
            'courses_to_remove' => [],
            'follow_up_suggestions' => $followUps,
            'interactive_widget' => $widget,
        ];
    }
}