<?php

namespace App\Http\Controllers;

use App\Models\AcademicPeriod;
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
use App\Support\CourseEligibility;
use Inertia\Inertia;

class AiAdvisorController extends Controller
{
    private const MAX_CONTEXT_MESSAGES = 4;
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
        $dailyLimit = $this->getDailyMessageLimitForUser($user);

        $usageKey = "ai_daily_usage_" . $user->id . "_" . date('Y-m-d');
        $usage = (int) Cache::get($usageKey, 0);
        $remaining = $dailyLimit === null ? null : max(0, $dailyLimit - $usage);

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
            'hasDailyLimit' => $dailyLimit !== null,
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
            'filters' => ['nullable', 'array'],
            'filters.*' => ['string'],
            'difficulty' => ['nullable', 'string', 'in:easy,balanced,hard'],
            'critical_path' => ['nullable', 'boolean'],
        ]);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 403);
        }

        // Check daily message limits only for non-admin users.
        $usageKey = "ai_daily_usage_" . $user->id . "_" . date('Y-m-d');
        $usage = (int) Cache::get($usageKey, 0);
        $dailyLimit = $this->getDailyMessageLimitForUser($user);
        if ($dailyLimit !== null && $usage >= $dailyLimit) {
            return response()->json([
                'status' => 'error',
                'message' => 'لقد استهلكت جميع محاولاتك اليومية المتاحة للمستشار الأكاديمي. حاول غداً ⏳',
                'daily_messages_remaining' => 0,
                'has_daily_limit' => true,
            ], 429);
        }

        // Clear academic data cache to ensure fresh analysis
        $this->clearStudentCache($user->id);

        $currentPeriod = AcademicPeriod::current();

        if (!$this->checkRateLimit($user->id)) {
            return response()->json([
                'status' => 'success',
                'reply' => '⏳ وصلت للحد الأقصى من الرسائل لهذا الوقت. حاول لاحقاً.',
                'suggested_courses' => [],
                'courses_to_remove' => [],
                'follow_up_suggestions' => [],
                'interactive_widget' => null,
                'chat_id' => $data['chat_id'] ?? null,
                'daily_messages_remaining' => $dailyLimit === null ? null : max(0, $dailyLimit - $usage),
                'has_daily_limit' => $dailyLimit !== null,
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
        $registrationLimits = $this->getRegistrationLimits($currentPeriod, (bool) ($academicData['is_probation'] ?? false));
        $academicData = array_merge($academicData, [
            'current_period_label' => $currentPeriod?->displayLabel() ?? 'الفصل الحالي غير محدد',
            'current_period_term' => $currentPeriod?->academic_term,
            'current_period_year' => $currentPeriod?->academic_year,
            'current_period_is_summer' => $registrationLimits['is_summer'],
            'current_term_limit' => $registrationLimits['term_limit'],
            'academic_limit' => $registrationLimits['academic_limit'],
            'effective_registration_limit' => $registrationLimits['effective_limit'],
        ]);

        $apiKeys = $this->getGeminiApiKeys();
        $responseCacheKey = $this->buildAiResponseCacheKey($user->id, $data['message'], $academicData, $cartData, $availableCourses, $data['filters'] ?? [], $data['difficulty'] ?? null, $data['critical_path'] ?? null);
        $cachedAiResponse = Cache::get($responseCacheKey);
        if (is_array($cachedAiResponse) && isset($cachedAiResponse['reply'])) {
            $replyText = (string) $cachedAiResponse['reply'];
            $followUpSuggestions = $cachedAiResponse['follow_up_suggestions'] ?? [];
            $interactiveWidget = $cachedAiResponse['interactive_widget'] ?? null;
            $suggestedDetails = $cachedAiResponse['suggested_courses'] ?? [];
            $removeDetails = $cachedAiResponse['courses_to_remove'] ?? [];

            $chat->messages()->create([
                'role' => 'ai',
                'content' => json_encode($cachedAiResponse, JSON_UNESCAPED_UNICODE),
            ]);

            $newRemaining = null;
            if ($dailyLimit !== null) {
                $newRemaining = max(0, $dailyLimit - $usage);
            }

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
                'has_daily_limit' => $dailyLimit !== null,
                'is_fallback' => false,
                'is_cached' => true,
                'fallback_reason' => null,
            ]);
        }
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
                $ragContext = $this->buildStudentAdvisingRagContext($academicData, $cartData, $availableCourses, $data['message']);
                $systemPrompt = $this->buildSystemPrompt($user, $academicData, $cartData, $availableCourses, $ragContext, $data['filters'] ?? [], $data['difficulty'] ?? null, $data['critical_path'] ?? null, $data['wants_code'] ?? false);
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

            // Increment daily message usage only for users with a daily cap.
            $newRemaining = null;
            if ($dailyLimit !== null) {
                Cache::put($usageKey, $usage + 1, now()->endOfDay());
                $newRemaining = max(0, $dailyLimit - ($usage + 1));
            }

            $responsePayload = [
                'status' => 'success',
                'reply' => $replyText,
                'suggested_courses' => $suggestedDetails,
                'courses_to_remove' => $removeDetails,
                'follow_up_suggestions' => $followUpSuggestions,
                'interactive_widget' => $interactiveWidget,
                'chat_id' => $chatId,
                'chat_title' => $isNewChat ? $chat->title : null,
                'daily_messages_remaining' => $newRemaining,
                'has_daily_limit' => $dailyLimit !== null,
                'is_fallback' => $useFallback,
                'is_cached' => false,
                'fallback_reason' => $useFallback ? 'local_fallback' : null,
            ];

            if (!$useFallback) {
                Cache::put($responseCacheKey, [
                    'reply' => $replyText,
                    'suggested_courses' => $suggestedDetails,
                    'courses_to_remove' => $removeDetails,
                    'follow_up_suggestions' => $followUpSuggestions,
                    'interactive_widget' => $interactiveWidget,
                ], now()->addHours(2));
            }

            return response()->json($responsePayload);
        } catch (\Throwable $e) {
            Log::error('Gemini AI Error: ' . $e->getMessage(), [
                'exception' => get_class($e),
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

                // Increment daily message usage only for users with a daily cap.
                $newRemaining = null;
                if ($dailyLimit !== null) {
                    Cache::put($usageKey, $usage + 1, now()->endOfDay());
                    $newRemaining = max(0, $dailyLimit - ($usage + 1));
                }

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
                    'has_daily_limit' => $dailyLimit !== null,
                    'is_fallback' => true,
                    'is_cached' => false,
                    'fallback_reason' => 'gemini_unavailable',
                ]);
            } catch (\Throwable $fallbackEx) {
                Log::error('Local fallback failed: ' . $fallbackEx->getMessage(), [
                    'exception' => get_class($fallbackEx),
                    'line' => $fallbackEx->getLine(),
                    'file' => $fallbackEx->getFile(),
                ]);

                return response()->json([
                    'status' => 'success',
                    'reply' => "⚠️ تعذر الوصول للمساعد الذكي الآن.\n\nلكن أقدر أساعدك محلياً: اكتب سؤالك عن الساعات، الفصل الحالي، أو المواد المتاحة، وسأعطيك أقصر جواب دقيق فوراً.",
                    'suggested_courses' => [],
                    'courses_to_remove' => [],
                    'follow_up_suggestions' => [],
                    'interactive_widget' => null,
                    'chat_id' => $chatId,
                    'daily_messages_remaining' => $dailyLimit === null ? null : max(0, $dailyLimit - $usage),
                    'has_daily_limit' => $dailyLimit !== null,
                    'is_fallback' => true,
                    'is_cached' => false,
                    'fallback_reason' => 'local_fallback_error',
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
            'filters' => $request->input('filters', []),
            'difficulty' => $request->input('difficulty'),
            'critical_path' => $request->input('critical_path'),
            'wants_code' => $request->input('wants_code'),
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

        $feedbackStats = DB::table('ai_feedbacks')
                ->selectRaw("count(case when rating = 'up' then 1 end) as positive")
                ->selectRaw("count(case when rating = 'down' then 1 end) as negative")
                ->selectRaw('count(*) as total')
                ->first();

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

    private function getDailyMessageLimitForUser($user): ?int
    {
        if ($user && method_exists($user, 'isAdminOrOwner') && $user->isAdminOrOwner()) {
            return null;
        }

        return self::DAILY_LIMIT;
    }

    private function getRegistrationLimits(?AcademicPeriod $currentPeriod, bool $isProbation): array
    {
        $isSummer = $currentPeriod ? (int) $currentPeriod->academic_term === 3 : false;
        $termLimit = $isSummer ? 9 : 18;
        $academicLimit = $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL;

        return [
            'is_summer' => $isSummer,
            'term_limit' => $termLimit,
            'academic_limit' => $academicLimit,
            'effective_limit' => min($termLimit, $academicLimit),
        ];
    }

    private function getStudentAcademicData($user): array
    {
        $cacheKey = "student_academic_data_{$user->id}";
        return Cache::remember($cacheKey, 600, function() use ($user) {
            $user->loadMissing(['major', 'passedCourses', 'cartCourses']);
            
            $actuallyPassedCourses = $user->passedCourses->filter(function($course) {
                $grade = $course->pivot->grade;
                return $grade === null || (float) $grade >= 50;
            });

            $gpaData = $user->calculateGPA();
            $hasAcademicRecords = (int) ($gpaData['completed_hours'] ?? 0) > 0;
            $isProbation = $hasAcademicRecords && isset($gpaData['percentage']) && (float) $gpaData['percentage'] < 60;

            return [
                'major_name' => $user->major?->name ?? 'تخصص عام',
                'college_id' => $user->major?->college_id,
                'gpa_data' => $gpaData,
                'is_probation' => $isProbation,
                'has_academic_records' => $hasAcademicRecords,
                'passed_course_ids' => $actuallyPassedCourses->pluck('id')->toArray(),
                'passed_courses_names' => $actuallyPassedCourses->pluck('name')->implode('، '),
                'total_passed_hours' => $actuallyPassedCourses->sum('credit_hours'),
                'total_plan_hours' => $user->major && method_exists($user->major, 'getTotalHours') ? $user->major->getTotalHours() : 132,
                'max_allowed_hours' => $isProbation ? self::MAX_HOURS_PROBATION : self::MAX_HOURS_NORMAL,
                'passed_university_req' => $actuallyPassedCourses->where('type', 'university_req')->sum('credit_hours'),
                'passed_compulsory' => $actuallyPassedCourses->where('type', 'compulsory')->sum('credit_hours'),
                'passed_elective' => $actuallyPassedCourses->where('type', 'elective')->sum('credit_hours'),
                'passed_supporting' => $actuallyPassedCourses->where('type', 'supporting')->sum('credit_hours'),
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
        $currentPeriod = \App\Models\AcademicPeriod::current();

        // لا نستخدم كاش هنا لضمان بيانات دقيقة ومحدثة دائماً
        {
            $planVersion = (int) ($user->study_plan_version ?? 12);

            $courses = Course::with(['prerequisites', 'children'])
                ->where(function ($query) use ($user, $planVersion) {
                    if ($user->major_id) {
                        $collegeId = $user->major ? $user->major->college_id : null;
                        
                        $query->where(function ($majorScope) use ($user, $planVersion) {
                            $majorScope->where('major_id', $user->major_id)
                                ->where('study_plan_version', $planVersion);
                        })->orWhere(function ($collegeScope) use ($collegeId, $planVersion) {
                            if ($collegeId) {
                                $collegeScope->whereNull('major_id')
                                    ->where('college_id', $collegeId)
                                    ->where('study_plan_version', $planVersion);
                            } else {
                                $collegeScope->whereRaw('1 = 0'); // false condition if no college
                            }
                        })->orWhere(function ($universityScope) use ($planVersion) {
                            $universityScope->whereNull('major_id')
                                ->whereNull('college_id')
                                ->where('study_plan_version', $planVersion);
                        });
                    } else {
                        $query->whereNull('major_id')
                            ->whereNull('college_id')
                            ->where('study_plan_version', $planVersion);
                    }
                })
                ->whereNotIn('id', $passedCourseIds)
                ->get();

            // Prioritize major courses > college courses > university courses
            $collegeId = $user->major ? $user->major->college_id : null;
            $courses = $courses->sortBy(function ($c) use ($user, $collegeId) {
                if ($c->major_id === $user->major_id && $user->major_id !== null) return 1;
                if ($c->college_id === $collegeId && $collegeId !== null) return 2;
                return 3;
            })->values();

            // Deduplicate by normalized name to prevent overlap
            $uniqueCourses = collect();
            $seenNames = [];

            // Pre-fill seenNames with the names of all ACTUALLY PASSED courses to prevent suggesting them if they have a new ID
            $user->passedCourses->each(function($course) use (&$seenNames) {
                $grade = $course->pivot->grade;
                if ($grade === null || (float) $grade >= 50) {
                    $normName = $this->normalizeArabic($course->name);
                    $strictName = str_replace('ال', '', $normName);
                    $seenNames[$strictName] = true;
                }
            });

            foreach ($courses as $c) {
                $normName = $this->normalizeArabic($c->name);
                // Also remove 'ال' for stricter deduplication
                $strictName = str_replace('ال', '', $normName);
                if (!isset($seenNames[$strictName])) {
                    $seenNames[$strictName] = true;
                    $uniqueCourses->push($c);
                }
            }
            $courses = $uniqueCourses;

            $map = [];
            $text = [];
            $details = [];
            $allEligible = [];
            $totalPassedHours = $user->passedCourses->sum('credit_hours');

            $isSummer2026 = $currentPeriod && strpos((string)$currentPeriod->academic_year, '2026') !== false && $currentPeriod->academic_term == 3;
            $summerScheduleFile = storage_path('app/summer_2026_schedule.json');
            $summerScheduleData = [];
            if ($isSummer2026 && file_exists($summerScheduleFile)) {
                $summerScheduleData = json_decode(file_get_contents($summerScheduleFile), true) ?? [];
            }
            $summer2026OfferedKeys = array_keys($summerScheduleData);

            foreach ($courses as $course) {
                $scheduleString = "";
                $isOfferedInSummer = false;
                if ($isSummer2026) {
                    $normalizedCourseName = $this->normalizeArabic($course->name);
                    $matchedKey = null;
                    
                    // 1. Exact match
                    foreach ($summer2026OfferedKeys as $offered) {
                        if ($this->normalizeArabic($offered) === $normalizedCourseName) {
                            $isOfferedInSummer = true;
                            $matchedKey = $offered;
                            break;
                        }
                    }
                    
                    // 2. Fuzzy match
                    if (!$matchedKey) {
                        $courseWords = array_filter(explode(' ', str_replace('ال', '', $normalizedCourseName)), fn($w) => mb_strlen($w) > 1 || is_numeric($w));
                        
                        foreach ($summer2026OfferedKeys as $offered) {
                            $normOffered = $this->normalizeArabic($offered);
                            
                            // Partial inclusion
                            if (mb_strlen($normalizedCourseName) > 5 && (mb_strpos($normOffered, $normalizedCourseName) !== false || mb_strpos($normalizedCourseName, $normOffered) !== false)) {
                                $isOfferedInSummer = true;
                                $matchedKey = $offered;
                                break;
                            }
                            
                            // Word intersection
                            $offeredWords = array_filter(explode(' ', str_replace('ال', '', $normOffered)), fn($w) => mb_strlen($w) > 1 || is_numeric($w));
                            $intersect = array_intersect($courseWords, $offeredWords);
                            $maxWords = max(count($courseWords), count($offeredWords));
                            
                            if ($maxWords > 0 && (count($intersect) / $maxWords) >= 0.70) {
                                $isOfferedInSummer = true;
                                $matchedKey = $offered;
                                break;
                            }
                        }
                    }
                    
                    if ($matchedKey && !empty($summerScheduleData[$matchedKey])) {
                        $sections = [];
                        foreach ($summerScheduleData[$matchedKey] as $sec) {
                            $sections[] = "[{$sec['instructor']}|{$sec['days']}|{$sec['time']}|{$sec['hall']}]";
                        }
                        $scheduleString = implode(",", $sections);
                    }
                }

                $missingPrereqs = [];
                foreach ($course->prerequisites as $prereq) {
                    if (!in_array($prereq->id, $passedCourseIds, true)) {
                        $missingPrereqs[] = $prereq->name;
                    }
                }

                $minHrs = \App\Support\CourseEligibility::minimumPassedHoursForCourse($course) ?? 0;
                $isLockedByHrs = $minHrs > 0 && $totalPassedHours < $minHrs;

                $status = 'Available';
                if (!empty($missingPrereqs)) {
                    $status = 'Locked_Prereqs(' . implode('+', $missingPrereqs) . ')';
                } elseif ($isLockedByHrs) {
                    $status = 'Locked_Hrs(' . $minHrs . ')';
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
                
                $desc = '';
                if (!empty($course->description)) {
                    $desc = mb_substr(str_replace(["\r", "\n", ","], " ", $course->description), 0, 100);
                }

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
                    'schedule_info' => $scheduleString ?? '',
                    'status' => $status,
                    'min_hrs' => $minHrs,
                    'desc' => $desc,
                ];

                if ($status === 'Available' || $inCart) {
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
            }

            $actuallyPassedCourses = $user->passedCourses->filter(function($course) {
                $grade = $course->pivot->grade;
                return $grade === null || (float) $grade >= 50;
            });
            $totalPassedHours = $actuallyPassedCourses->sum('credit_hours');
            $studentYear = max(1, min(5, (int) ceil($totalPassedHours / 33)));

            usort($allEligible, function ($a, $b) use ($studentYear) {
                $aAvail = $a['status'] === 'Available' ? 1 : 0;
                $bAvail = $b['status'] === 'Available' ? 1 : 0;
                if ($aAvail !== $bAvail) {
                    return $bAvail <=> $aAvail;
                }
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

            $topEligible = array_slice($allEligible, 0, 30);

            $availableText = ["Code,Name,Hrs,Yr,Type,Unlocks,Diff,Cart,Sched"];
            $lockedText = ["Name,Status,Reason"];
            
            foreach ($topEligible as $course) {
                $cCart = $course['in_cart'] ? 1 : 0;
                $sched = empty($course['schedule_info']) ? '' : str_replace(',', '،', $course['schedule_info']);
                
                if ($course['status'] === 'Available' || $course['in_cart']) {
                    $availableText[] = "{$course['code']},{$course['name']},{$course['credit_hours']},{$course['course_year']},{$course['type']},{$course['unlocks']},{$course['difficulty_level']},{$cCart},{$sched}";
                } else {
                    $lockedText[] = "{$course['name']},{$course['status']},مغلقة بسبب المتطلبات أو الساعات";
                }
            }

            return [
                'map' => $map,
                'text' => count($availableText) > 1 ? implode("\n", $availableText) : 'لا يوجد مواد متاحة للتسجيل حالياً!',
                'available_text' => count($availableText) > 1 ? implode("\n", $availableText) : 'لا يوجد مواد متاحة للتسجيل حالياً!',
                'locked_text' => count($lockedText) > 1 ? implode("\n", $lockedText) : 'لا يوجد مواد مغلقة حالياً.',
                'details' => $details,
            ];
        }
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

        $effectiveLimit = (int) ($academicData['effective_registration_limit'] ?? $academicData['max_allowed_hours'] ?? self::MAX_HOURS_NORMAL);
        $hoursState = ($cartData['hours'] ?? 0) > $effectiveLimit ? 'متجاوز_الحد' : 'ضمن_الحد';

        return "\n🎯 [RAG الإرشاد الطلابي]:\n- نية_السؤال: {$intent}\n- ساعات_الطالب_المنجزة: " . ($academicData['total_passed_hours'] ?? 0) . "\n- ساعات_التسجيل_التجريبي_الحالية: " . ($cartData['hours'] ?? 0) . "\n- حالة_الساعات: {$hoursState}\n- عدد_مواد_التسجيل_التجريبي: " . count($cartData['ids'] ?? []) . "\n- مواد_استراتيجية_مرشحة:\n" . ($strategic ? implode("\n", $strategic) : '- لا توجد مواد مرشحة حالياً') . "\n- عينات_حسب_تصنيف_الصعوبة_الاداري:\n  - خفيف: " . ($easy ? implode(' | ', array_slice($easy, 0, 4)) : 'لا يوجد') . "\n  - متوازن: " . ($balanced ? implode(' | ', array_slice($balanced, 0, 4)) : 'لا يوجد') . "\n  - مكثف: " . ($heavy ? implode(' | ', array_slice($heavy, 0, 4)) : 'لا يوجد');
    }

    private function buildSystemPrompt($user, array $academicData, array $cartData, array $availableCourses, string $ragContext = '', array $filters = [], $difficulty = null, $criticalPath = null, $wantsCode = false): string
    {
        $filterInstructions = "";
        
        if ($wantsCode) {
            $filterInstructions .= "- 💻 **وضع الأكواد البرمجية مُفعل**: الطالب يطلب منك كتابة كود برمجي كجزء من إجابتك. **يجب** أن توفر الكود المطلوب كاملاً داخل صندوق أكواد Markdown مع تحديد لغة البرمجة بدقة (مثال: ```java). لا تكتب الكود كنص عادي أبداً، ولا تختصره.\n";
        }
        if (!empty($filters)) {
            $filterLabels = [
                'compulsory' => 'إجباري',
                'elective' => 'اختياري',
                'supporting' => 'مساندة',
                'university_req' => 'متطلب جامعة (أونلاين)',
            ];
            $selectedLabels = array_map(fn($f) => $filterLabels[$f] ?? $f, $filters);
            $filterText = implode(' و ', $selectedLabels);
            $filterInstructions .= "- 🚨 نوع المواد: الطالب حدد تفضيلات خاصة بالمواد التي يبحث عنها وهي: ({$filterText}). التزم بها عند اقتراح المواد واذكر ذلك في إجابتك.\n";
        }

        if ($criticalPath) {
            $filterInstructions .= "- 🔑 المسار الحرج: الطالب يطلب التركيز على المواد المفصلية التي تفتح مواد أخرى. أعطِ الأولوية القصوى للمواد التي تفتح مجالات في الخطة واذكر له في مقدمة الرد أنك ركزت على مواد المسار الحرج التي تفتح مجالات.\n";
        }

        if ($difficulty === 'easy') {
            $filterInstructions .= "- 🌟 صعوبة الجدول: الطالب يطلب مواد (سهلة جداً) ومضمونة لرفع معدله. ابحث عن المواد ذات مستوى الصعوبة المنخفض (1 أو 2) واذكر له بوضوح أنك اخترت أسهل المواد المتاحة لرفع معدله.\n";
        } elseif ($difficulty === 'balanced') {
            $filterInstructions .= "- ⚖️ صعوبة الجدول: الطالب يطلب جدول (متوازن). اقترح مزيجاً يريح الطالب واذكر له أن الجدول متوازن ومريح.\n";
        } elseif ($difficulty === 'hard') {
            $filterInstructions .= "- 🔥 صعوبة الجدول: الطالب يطلب مواد (دسمة / صعبة). لا تتردد في اقتراح مواد ذات مستوى صعوبة عالي واذكر له أنك اخترت مواد مكثفة بناءً على طلبه.\n";
        }

        $totalPassedHours = (int) ($academicData['total_passed_hours'] ?? 0);
        $studentYear = max(1, min(5, (int) ceil($totalPassedHours / 33)));
        $studentYearLabels = [1 => 'أولى', 2 => 'ثانية', 3 => 'ثالثة', 4 => 'رابعة', 5 => 'خامسة'];

        $gpa = $academicData['gpa_data']['percentage'] ?? 0;
        $gpa4 = $academicData['gpa_data']['gpa4'] ?? 0;
        $currentPeriodLabel = (string) ($academicData['current_period_label'] ?? 'الفصل الحالي غير محدد');
        $currentTermLimit = (int) ($academicData['current_term_limit'] ?? ($academicData['max_allowed_hours'] ?? self::MAX_HOURS_NORMAL));
        $academicLimit = (int) ($academicData['academic_limit'] ?? ($academicData['max_allowed_hours'] ?? self::MAX_HOURS_NORMAL));
        $effectiveLimit = (int) ($academicData['effective_registration_limit'] ?? min($currentTermLimit, $academicLimit));
        $probationStatus = $academicData['is_probation']
            ? "🚨 نعم — إنذار أكاديمي! (الحد الأقصى {$academicData['max_allowed_hours']} ساعة فقط)"
            : "لا (الحد الأقصى {$academicData['max_allowed_hours']} ساعة)";

        $progressText = '';
        if (!empty($academicData['total_plan_hours'])) {
            $percent = round(($academicData['total_passed_hours'] / max((int) $academicData['total_plan_hours'], 1)) * 100);
            $progressText = "\n- التقدم نحو التخرج: {$academicData['total_passed_hours']}/{$academicData['total_plan_hours']} ساعة ({$percent}%)";
        }

        $isSummer = !empty($academicData['current_period_is_summer']);

        $itFreshmanRule = '';
        if (($academicData['college_id'] ?? null) == 1 && $totalPassedHours == 0 && !$isSummer) {
            $itFreshmanRule = "- 🚨 **قاعدة التوجيه لطلاب كلية الـ IT الجدد**: بما أن هذا الطالب في كلية تكنولوجيا المعلومات وهذا فصله الأول (أنجز 0 ساعة)، **يجب عليك وبشكل إلزامي** أن تقترح عليه تسجيل 12 ساعة فقط (4 مواد) تتكون مما يلي بالتحديد: 1- مادة 'أساسيات تكنولوجيا المعلومات'، 2- مادة 'تصميم المنطق الرقمي'، 3- مادة من متطلبات الجامعة الإجبارية (مثال: التربية الوطنية أو غيرها)، 4- مادة من متطلبات الجامعة الاختيارية. أخبر الطالب صراحة أن هذا هو الجدول المثالي والمتبع لطلاب الـ IT في فصلهم الأول.\n";
        }

        $cartWarning = '';
        if (($cartData['hours'] ?? 0) > $effectiveLimit) {
            $excess = $cartData['hours'] - $effectiveLimit;
            $cartWarning = "\n⚠️ تنبيه: التسجيل التجريبي يحتوي {$cartData['hours']} ساعة ويتجاوز الحد الفعلي المسموح بـ {$excess} ساعة!";
        }

        $studentYearLabel = $studentYearLabels[$studentYear] ?? 'أولى';

        $calendarText = '';
        if (strpos((string) ($academicData['current_period_year'] ?? ''), '2026') !== false && ($academicData['current_period_term'] ?? 0) == 3) {
            $calendarText = "التقويم الأكاديمي للجامعة للفصل الحالي:\n" .
                "- اخر فترة لتسجيل الطلبة المتاخرين: من 28/6/2026 إلى 2/7/2026\n" .
                "- فترة السحب والاضافة: من 5/7/2026 إلى 8/7/2026\n" .
                "- بدء التدريس: 12/7/2026\n" .
                "- فترة إجراء الامتحان الأول: من 26/7/2026 إلى 29/7/2026\n" .
                "- موعد تسليم المواد المطروحة للفصل الأول: 26/7/2026\n" .
                "- أخر موعد لإجراء امتحانات غير مكتمل: 29/7/2026\n" .
                "- فترة إجراء الامتحان النصفي: من 2/8/2026 إلى 5/8/2026\n" .
                "- آخر موعد لمناقشة الرسائل الجامعية: 6/8/2026\n" .
                "- التسجيل لمواد الفصل الأول: من 9/8/2026 إلى 12/8/2026\n" .
                "- فترة إجراء الامتحان الثاني: من 16/8/2026 إلى 19/8/2026\n" .
                "- آخر موعد للانسحاب من دراسة مادة أو أكثر: 16/8/2026\n" .
                "- الامتحانات النهائية: من 30/8/2026 إلى 3/9/2026\n\n";
        }

        return "أنت مرشد أكاديمي ذكي لتطبيق 'سنفور' الخاص بطلاب جامعة الزرقاء. دورك: إجابة أسئلة الطلاب عن الإرشاد الأكاديمي والجامعة وكل ما يحتاجه الطالب في مسيرته الدراسية باحتراف وذكاء.\nالقواعد:\n" .
            "- هويتك: أنت صُنعت وبُرمجت بواسطة المهندس عاصم الخباص (Asem Alkhabbas). إياك أن تذكر جوجل (Google) أو أي شركة أخرى. إذا سألك الطالب من صنعك أو من أنت، أجب باختصار: 'أنا مرشدك الأكاديمي الذكي من تطوير المهندس عاصم الخباص'.\n" .
            "- الإجابة: سياق الإرشاد الأكاديمي، أجب باختصار شديد جداً وبشكل مباشر ومقتضب جداً لتوفير الكلمات (Tokens). تجنب المقدمات الطويلة والشروحات الزائدة التي لم يطلبها الطالب، وكن عملياً إلى أبعد حد.\n" .
            "- لا تقل 'لا أعرف'، قدم نصيحة عامة أو وجه للقسم المختص بثقة.\n" .
            "- للتسجيل واقتراح المواد: **اقرأ خطة الطالب بدقة واستعرض مواده المنجزة والمواد في التسجيل التجريبي**. عند الاقتراح، اختر من قائمة (المواد المتاحة للتسجيل) بشكل منطقي: أعطِ الأولوية لمواد التخصص الإجبارية (compulsory) والمواد التي تفتح مواد أخرى (Unlocks)، مع مراعاة الساعات المسموحة وتوازن الصعوبة.\n" .
            "- إذا سأل الطالب عن مادة وحالتها (Status) تبدأ بـ Locked، اشرح له السبب بذكاء (إما لنقص الساعات MinHrs أو بسبب متطلب سابق Locked_Prereqs). استفد من وصف المادة (Desc) وصعوبتها (Diff من 1 لـ 5) في إعطاء نصائح حقيقية.\n" .
            "- عامود (Sched) يحتوي على أوقات وأيام وقاعات الشُعب المطروحة واسم **المحاضر/المدرس**، اقرأه جيداً واستخدم هذه المعلومات إذا سألك الطالب عن المدرسين أو تفاصيل المحاضرات.\n" .
            "- اذكر الفصل، الحد الفعلي، ثم قيّم الحالة. الفصل الحالي: {$currentPeriodLabel}. حد الترم: {$currentTermLimit}س. الحد الأكاديمي: {$academicLimit}س. الحد المطبق: {$effectiveLimit}س.\n" .
            "- 🚨 قيود الساعات الذكية (هام جداً): الحد الطبيعي للفصل العادي 18 وللصيفي 9. الاستثناءات: (1) الخريج بالفصل العادي (باقي 21 ساعة أو أقل) مسموح له 21 ساعة. (2) الخريج بالصيفي (باقي 12 ساعة أو أقل) مسموح له 12 ساعة. (3) الصيفي في حال احتوى على مادة مختبر (ساعة واحدة) مسموح له 10 ساعات.\n" .
            ($isSummer ? "- (الفصل صيفي). ركز على المواد المطروحة في الصيفي إن وجدت.\n" : "- (ليس صيفياً).\n") .
            "- لا تخمّن الساعات. تجنب كلمات 'خريف/ربيع' واستخدم 'الفصل الأول/الثاني/الصيفي'.\n" .
            $filterInstructions .
            $itFreshmanRule .
            "- الحساب الدقيق (صارم): لأسئلة حساب المعدل، **اكتب العملية الحسابية الدقيقة** خطوة بخطوة بشكل عمودي (باستخدام الرمز \\n لإنشاء أسطر جديدة داخل الـ JSON)، ولا تدمج الحسابات بفقرة واحدة. ولا تستخدم علامات التنصيص المزدوجة داخل نص الـ reply. القانون: (المعدل الحالي×الساعات المقطوعة + العلامة المتوقعة×الساعات المتوقعة)/إجمالي الساعات.\n" .
            "- الأكواد البرمجية: إذا طلب الطالب كوداً برمجياً أو قمت بشرح أي مفهوم برمجي، **يجب** أن تضع الكود بداخل كتلة أكواد Markdown (Triple backticks) مع تحديد لغة البرمجة (مثال: ```java). إياك كتابة الكود كنص عادي.\n" .
            "- كن جدياً وعملياً، استخدم ايموجيات خفيفة وميّز الكلمات بـ **bold**.\n" .
            "- خطة التخرج (132س): متطلبات جامعة 30س، تخصص إجباري 87س، اختياري 9س، مساندة 6س. التزم بهذه الساعات.\n" .
            "- مباني: أ.ب(الفاروق - تكنولوجيا المعلومات، الآداب، الشريعة)، ت(طبية/تقنية)، د.هـ(الخوارزمي - التمريض، الصيدلة، العلوم)، ل(هندسة/فنون)، ص(صحافة/حقوق)، ق(الشهيد معاذ الكساسبة - اقتصاد)، ط(أسنان). الطوابق: 100=أول، 200=ثاني.\n" .
            "🚨 أدوات ذكية (WIDGETS): يجب تفعيلها في JSON عند الحاجة:\n" .
            "1. إذا سأل 'كم ساعة أسجل؟' -> أرسل: `{\"type\":\"hours_slider\",\"current_cart_hours\":{$cartData['hours']}}`\n" .
            "2. إذا سأل 'راجع/قيّم جدولي' -> أرسل: `{\"type\":\"cart_review\",\"courses\":[{\"id\":123,\"name\":\"اسم\",\"code\":\"101\",\"credit_hours\":3,\"verdict\":\"keep|remove|warning\",\"reason\":\"...\"}],\"summary\":{\"recommendation\":\"...\",\"max_hours\":18,\"overall_difficulty\":\"متوسط\"}}`\n\n" .
            "سياق RAG:\n" . ($ragContext ?: 'لا يوجد سياق إضافي حالياً.') . "\n\n" .
            $calendarText .
            "بيانات الطالب المختصرة: {$user->name} | {$academicData['major_name']} | سنة {$studentYearLabel} | معدل {$gpa}%\n" .
            "التقدم حسب أقسام الخطة:\n" .
            "- متطلبات الجامعة: أنجز {$academicData['passed_university_req']} / 30 ساعة\n" .
            "- تخصص إجباري: أنجز {$academicData['passed_compulsory']} / 87 ساعة\n" .
            "- تخصص اختياري: أنجز {$academicData['passed_elective']} / 9 ساعات\n" .
            "- مساندة: أنجز {$academicData['passed_supporting']} / 6 ساعات\n" .
            "المواد التي أتمها الطالب (ناجح فيها): " . ($academicData['passed_courses_names'] ?: 'لم ينجز أي مواد بعد') . "\n" .
            "التسجيل التجريبي الحالي: " . ($cartData['list'] ?: 'فارغ') . " ({$cartData['hours']}س)" . ($cartWarning ? " | تنبيه: تجاوز الحد الفعلي {$effectiveLimit}س" : '') . "\n\n" .
            "✅ المواد المتاحة للتسجيل للطالب (استخدم هذه القائمة فقط للاقتراح وإضافة المواد):\n{$availableCourses['available_text']}\n\n" .
            "❌ المواد المغلقة حالياً (لا تقترحها أبداً للتسجيل، فقط اشرح سبب إغلاقها إذا سألك الطالب):\n{$availableCourses['locked_text']}\n\n" .
            "⚠️ شكل الرد الإجباري (JSON صالح فقط):\n" .
            "{\"reply\":\"...\",\"suggested_courses\":[],\"courses_to_remove\":[],\"follow_up_suggestions\":[\"...\"],\"interactive_widget\":null}\n" .
            "هام جداً: يجب أن يكون نص الـ reply سطراً واحداً برمجياً، استخدم الحرفين \\n للنزول سطر جديد ولا تضغط Enter (Literal newlines) داخل النص لتجنب كسر الـ JSON.\n" .
            "🚨 تحذير شديد: إياك أن تقترح أو تدخل أي مادة في الـ JSON (سواء في suggested_courses أو interactive_widget) غير موجودة حرفياً في قائمة (المواد المتاحة للتسجيل للطالب). اختراع أسماء مواد، أو تأليف عدد ساعات للمواد من عندك سيسبب خطأ فادح بالنظام.";
    }

    private function buildConversationContext($chat, string $systemPrompt): array
    {
        $messages = $chat->messages()->orderBy('created_at', 'desc')->get(); // Reverse chronological
        
        $maxKeep = self::MAX_CONTEXT_MESSAGES;
        if ($maxKeep % 2 === 0) {
            $maxKeep--; 
        }

        $validMessages = [];
        $expectedRole = 'user';

        foreach ($messages as $message) {
            $role = $message->role === 'ai' ? 'model' : 'user';

            if ($role === $expectedRole) {
                array_unshift($validMessages, $message); // Add to beginning to restore chronological order
                $expectedRole = ($expectedRole === 'user') ? 'model' : 'user';
                
                if (count($validMessages) >= $maxKeep) {
                    break;
                }
            }
        }

        $summaryPrefix = '';
        if ($chat->messages()->count() > count($validMessages)) {
            $summaryPrefix = "\n[ملاحظة: تم اختصار المحادثة السابقة]\n";
        }

        $contents = [];
        $isFirst = true;

        foreach ($validMessages as $message) {
            $text = (string) $message->content;

            if ($message->role === 'ai') {
                $decoded = json_decode($text, true);
                if (json_last_error() === JSON_ERROR_NONE && isset($decoded['reply'])) {
                    $text = (string) $decoded['reply'];
                }
            }

            $role = $message->role === 'ai' ? 'model' : 'user';

            if ($isFirst && $role === 'user') {
                $text = "تعليمات النظام (لا تظهر للطالب):\n{$systemPrompt}{$summaryPrefix}\n\nسؤال الطالب:\n{$text}";
                $isFirst = false;
            }

            $contents[] = [
                'role' => $role,
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

    /**
     * Get RPM (requests per minute) usage for a given API key.
     */
    private function getKeyRpm(string $apiKey): int
    {
        $minute = date('Y-m-d_H-i');
        return (int) Cache::get('gemini_rpm_' . md5($apiKey) . '_' . $minute, 0);
    }

    /**
     * Increment RPM counter for a given API key.
     */
    private function incrementKeyRpm(string $apiKey): void
    {
        $minute = date('Y-m-d_H-i');
        $cacheKey = 'gemini_rpm_' . md5($apiKey) . '_' . $minute;
        $current = (int) Cache::get($cacheKey, 0);
        Cache::put($cacheKey, $current + 1, now()->addSeconds(90));
    }

    /**
     * Check if a key is in cooldown. Returns remaining seconds or 0.
     */
    private function getKeyCooldownRemaining(string $apiKey): int
    {
        $until = Cache::get('gemini_cooldown_' . md5($apiKey));
        if (!$until) return 0;
        $remaining = $until - time();
        return max(0, $remaining);
    }

    /**
     * Put a key into cooldown for N seconds.
     */
    private function setCooldown(string $apiKey, int $seconds, string $reason = ''): void
    {
        $until = time() + $seconds;
        Cache::put('gemini_cooldown_' . md5($apiKey), $until, now()->addSeconds($seconds + 5));
        Cache::put('gemini_cooldown_reason_' . md5($apiKey), $reason, now()->addSeconds($seconds + 5));
        Log::debug("Gemini key cooldown set: " . substr($apiKey, 0, 8) . "... for {$seconds}s reason: {$reason}");
    }

    private const RPM_LIMIT = 14; // Safe limit (actual is 15, keep 1 buffer)

    /**
     * Select the best available API key: not in cooldown, lowest RPM usage.
     * Returns sorted array of keys (best first).
     */
    private function sortKeysByAvailability(array $apiKeys): array
    {
        $scored = [];
        foreach ($apiKeys as $key) {
            $cooldown = $this->getKeyCooldownRemaining($key);
            $rpm = $this->getKeyRpm($key);
            $scored[] = [
                'key' => $key,
                'cooldown' => $cooldown,
                'rpm' => $rpm,
                'available' => $cooldown === 0 && $rpm < self::RPM_LIMIT,
            ];
        }

        // Sort: available first, then by lowest RPM
        usort($scored, function ($a, $b) {
            if ($a['available'] !== $b['available']) {
                return $b['available'] <=> $a['available'];
            }
            if ($a['cooldown'] !== $b['cooldown']) {
                return $a['cooldown'] <=> $b['cooldown'];
            }
            return $a['rpm'] <=> $b['rpm'];
        });

        return array_column($scored, 'key');
    }

    private function callGeminiAPI(array $contents, array $apiKeys): string
    {
        if (empty($apiKeys)) {
            throw new \Exception('No Gemini API keys configured');
        }

        $model = 'gemini-2.5-flash';
        $sortedKeys = $this->sortKeysByAvailability($apiKeys);
        $lastError = 'Unknown Gemini error';

        foreach ($sortedKeys as $apiKey) {
            $keyIndex = array_search($apiKey, $apiKeys, true);

            // Skip keys in cooldown
            $cooldown = $this->getKeyCooldownRemaining($apiKey);
            if ($cooldown > 0) {
                $lastError = "key#" . ($keyIndex + 1) . ": in cooldown ({$cooldown}s remaining)";
                continue;
            }

            // Skip keys at RPM limit
            $rpm = $this->getKeyRpm($apiKey);
            if ($rpm >= self::RPM_LIMIT) {
                $lastError = "key#" . ($keyIndex + 1) . ": RPM limit reached ({$rpm}/" . self::RPM_LIMIT . ")";
                continue;
            }

            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

            try {
                $requestContents = $contents;
                $fullText = '';
                $backoffMs = 150;

                for ($pass = 0; $pass <= 2; $pass++) {
                    for ($retryCount = 0; $retryCount < 2; $retryCount++) {
                        try {
                            $response = Http::withoutVerifying()
                                ->connectTimeout(8)
                                ->timeout(50)
                                ->withHeaders(['Content-Type' => 'application/json'])
                                ->post($url, [
                                    'contents' => $requestContents,
                                    'generationConfig' => [
                                        'responseMimeType' => 'application/json',
                                        'temperature' => 0.3,
                                    ],
                                ]);

                            $status = $response->status();

                            if ($status === 429) {
                                $this->setCooldown($apiKey, 60, 'rate_limited_429');
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP 429 (rate limited, cooldown 60s)";
                                continue 3; // Next key
                            }

                            if (in_array($status, [401, 403])) {
                                $this->setCooldown($apiKey, 600, 'invalid_key_' . $status);
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP {$status} (invalid/blocked, cooldown 10min)";
                                continue 3; // Next key
                            }

                            if ($status === 400) {
                                $this->setCooldown($apiKey, 120, 'bad_request_400');
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP 400 (bad request, cooldown 2min)";
                                continue 3; // Next key
                            }

                            if ($status === 503) {
                                if ($retryCount < 1) {
                                    usleep($backoffMs * 1000);
                                    $backoffMs *= 2;
                                    continue; // Retry
                                }
                                $this->setCooldown($apiKey, 30, 'server_overloaded_503');
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP 503 (overloaded, cooldown 30s)";
                                continue 3; // Next key
                            }

                            if (!$response->successful()) {
                                $lastError = "key#" . ($keyIndex + 1) . ": HTTP {$status}";
                                continue 3;
                            }

                            break; // Success
                        } catch (\Exception $e) {
                            if ($retryCount < 1) {
                                usleep($backoffMs * 1000);
                                $backoffMs *= 2;
                                continue;
                            }
                            throw $e;
                        }
                    }

                    // Track RPM + daily usage on success
                    $this->incrementKeyRpm($apiKey);

                    $candidate = $response->json('candidates.0');
                    $chunk = $candidate['content']['parts'][0]['text'] ?? null;

                    if (!is_string($chunk) || trim($chunk) === '') {
                        $lastError = "key#" . ($keyIndex + 1) . ": empty candidate text";
                        continue 2; // Next key
                    }

                    $fullText .= $chunk;

                    $finishReason = strtoupper((string) ($candidate['finishReason'] ?? ''));
                    $stopped = in_array($finishReason, ['MAX_TOKENS', 'LENGTH', 'FINISH_REASON_MAX_TOKENS'], true);
                    if (!$stopped || $pass >= 2) {
                        $this->workingApiKey = $apiKey;
                        $dailyKey = 'gemini_key_usage_' . md5($apiKey) . '_' . date('Y-m-d');
                        Cache::put($dailyKey, (int) Cache::get($dailyKey, 0) + 1, now()->endOfDay());
                        return $fullText;
                    }

                    $requestContents[] = ['role' => 'model', 'parts' => [['text' => $chunk]]];
                    $requestContents[] = ['role' => 'user', 'parts' => [['text' => 'أكمل من آخر نقطة بدون تكرار.']]];
                }

                if ($fullText !== '') {
                    $this->workingApiKey = $apiKey;
                    $dailyKey = 'gemini_key_usage_' . md5($apiKey) . '_' . date('Y-m-d');
                    Cache::put($dailyKey, (int) Cache::get($dailyKey, 0) + 1, now()->endOfDay());
                    return $fullText;
                }
            } catch (\Throwable $e) {
                $lastError = "key#" . ($keyIndex + 1) . ": {$e->getMessage()}";
            }
        }

        throw new \Exception("Gemini API failed across all keys. Last error: {$lastError}");
    }

    private function parseAIResponse(string $rawText): array
    {
        // Only strip the outer markdown formatting if the entire response is wrapped in it.
        $clean = preg_replace('/^```(?:json)?\s*(.*?)\s*```$/is', '$1', trim($rawText));

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
        
        // Remove style and script tags for safety
        $clean = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $clean);
        $clean = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $clean);
        
        // DO NOT use strip_tags as it ruins code containing < or > (like List<String>)
        // DO NOT strip triple backticks as it ruins markdown code blocks
        // DO NOT strip multiple spaces as it ruins code indentation
        
        $clean = html_entity_decode($clean, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $clean = preg_replace('/\n{3,}/', "\n\n", $clean);

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
            $validItems = [];
            $seenIds = [];
            foreach ($widget['items'] as $item) {
                if (!empty($item['name'])) {
                    $foundId = $findCourseId($item['name']);
                    if ($foundId && !isset($seenIds[$foundId])) {
                        $item['id'] = $foundId;
                        $validItems[] = $item;
                        $seenIds[$foundId] = true;
                    }
                }
            }
            $widget['items'] = $validItems;
        }

        if ($widget['type'] === 'cart_review' && isset($widget['courses']) && is_array($widget['courses'])) {
            $validCourses = [];
            $seenIds = [];
            foreach ($widget['courses'] as $course) {
                if (!empty($course['name'])) {
                    $foundId = $findCourseId($course['name']);
                    if ($foundId && !isset($seenIds[$foundId])) {
                        $course['id'] = $foundId;
                        $validCourses[] = $course;
                        $seenIds[$foundId] = true;
                    }
                }
            }
            $widget['courses'] = $validCourses;
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
        
        // إزالة التشكيل
        $text = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $text);
        
        // استبدال الأقواس والرموز بمسافة لتسهيل المطابقة (مثل: برمجة الحاسوب 1 مقابل برمجة الحاسوب (1))
        $text = preg_replace('/[()\[\]{}\-_\/\\\\.,،؛]/u', ' ', $text);
        
        $text = preg_replace('/\s+/u', ' ', $text);

        return mb_strtolower(trim($text), 'UTF-8');
    }

    private function buildAiResponseCacheKey(int $userId, string $message, array $academicData, array $cartData, array $availableCourses, array $filters = [], $difficulty = null, $criticalPath = null): string
    {
        $payload = [
            'message' => $this->normalizeArabic(mb_strtolower(trim($message))),
            'filters' => $filters,
            'difficulty' => $difficulty,
            'critical_path' => $criticalPath,
            'period' => $academicData['current_period_label'] ?? null,
            'term' => $academicData['current_period_term'] ?? null,
            'year' => $academicData['current_period_year'] ?? null,
            'effective_limit' => $academicData['effective_registration_limit'] ?? null,
            'academic_limit' => $academicData['academic_limit'] ?? null,
            'term_limit' => $academicData['current_term_limit'] ?? null,
            'passed' => array_values($academicData['passed_course_ids'] ?? []),
            'cart' => array_values($cartData['ids'] ?? []),
            'cart_hours' => (int) ($cartData['hours'] ?? 0),
            'available' => array_keys($availableCourses['map'] ?? []),
        ];

        return 'ai_response_' . $userId . '_' . md5(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
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
        $currentPeriodLabel = (string) ($academicData['current_period_label'] ?? 'الفصل الحالي');
        $effectiveLimit = (int) ($academicData['effective_registration_limit'] ?? self::MAX_HOURS_NORMAL);
        $cartHours = (int) ($cartData['hours'] ?? 0);
        $remainingHours = max(0, $effectiveLimit - $cartHours);
        $isSummer = !empty($academicData['current_period_is_summer']);

        $availableDetails = array_values($availableCourses['details'] ?? []);
        usort($availableDetails, fn(array $a, array $b) => ((int) ($a['credit_hours'] ?? 0)) <=> ((int) ($b['credit_hours'] ?? 0)));

        $suggestedIds = [];
        $followUps = ['كم ساعة مسموح لي؟', 'ما المواد المناسبة لي؟'];

        $reply = "أنت الآن في **{$currentPeriodLabel}**. الحد الفعلي للتسجيل: **{$effectiveLimit} ساعة**";
        if ($isSummer) {
            $reply .= "، وفي الفصل الصيفي الحد الأساسي هو **9 ساعات**.";
        }
        $reply .= "\nساعاتك الحالية: **{$cartHours}** | المتبقي: **{$remainingHours}**.";

        if (preg_match('/(ساع|ساعات|تسجيل|الجدول|فصل|الصيف|summer|limit|كم مسموح)/u', $normalized)) {
            $reply .= "\n\nأفضل اختيار الآن هو الالتزام بالحد أعلاه وعدم تجاوزه.";
        } elseif (preg_match('/(معدل|gpa|انذار|إنذار|رفع|تراكمي|probation)/u', $normalized)) {
            $reply .= "\n\nلرفع المعدل، اختر مواد أخف عبئاً ومناسبة للحد الحالي.";
            $followUps = ['ما تأثير هذه المواد على معدلي؟', 'كيف أخفف عبء الجدول؟'];
        } elseif (preg_match('/(تخرج|خطة|مسار|فتح|متطلبات|استراتي|graduat|plan)/u', $normalized)) {
            $reply .= "\n\nركّز على المواد التي تفتح مواد أخرى أو تكمل متطلبات الخطة.";
            $followUps = ['ما أفضل ترتيب للفصل القادم؟', 'أي المواد تعطل التخرج لو تأخرت؟'];
        } else {
            $reply .= "\n\nأقدر ألخص لك الخطة أو أرشح مواد مناسبة إذا سألتني بصيغة أقصر.";
        }

        foreach (array_slice($availableDetails, 0, 3) as $course) {
            $suggestedIds[] = (int) $course['id'];
        }

        $suggestedDetails = !empty($suggestedIds)
            ? Course::whereIn('id', $suggestedIds)->select('id', 'name', 'code', 'credit_hours', 'description')->get()->toArray()
            : [];

        return [
            'reply' => $reply,
            'suggested_courses' => $suggestedDetails,
            'courses_to_remove' => [],
            'follow_up_suggestions' => $followUps,
            'interactive_widget' => null,
        ];
    }


    /**
     * Admin endpoint: returns health status and usage stats for all configured Gemini API keys.
     * Now includes RPM data, cooldown status, and doesn't waste API requests on health checks.
     */
    public function getApiKeyStatus()
    {
        $user = Auth::user();
        if (!$user || !method_exists($user, 'isAdminOrOwner') || !$user->isAdminOrOwner()) {
            abort(403);
        }

        $apiKeys = $this->getGeminiApiKeys();
        $results = [];
        $today = date('Y-m-d');

        foreach ($apiKeys as $index => $key) {
            $maskedKey = substr($key, 0, 10) . '...' . substr($key, -4);
            $cacheKey = 'gemini_key_usage_' . md5($key) . '_' . $today;
            $todayUsage = (int) Cache::get($cacheKey, 0);

            // RPM data
            $currentRpm = $this->getKeyRpm($key);
            $cooldownRemaining = $this->getKeyCooldownRemaining($key);
            $cooldownReason = (string) Cache::get('gemini_cooldown_reason_' . md5($key), '');

            // Weekly usage
            $weeklyUsage = 0;
            for ($d = 0; $d < 7; $d++) {
                $dateKey = 'gemini_key_usage_' . md5($key) . '_' . date('Y-m-d', strtotime("-{$d} days"));
                $weeklyUsage += (int) Cache::get($dateKey, 0);
            }

            // Determine status from cooldown & RPM (no API call needed!)
            if ($cooldownRemaining > 0) {
                if (str_contains($cooldownReason, 'invalid_key') || str_contains($cooldownReason, '401') || str_contains($cooldownReason, '403')) {
                    $status = 'invalid';
                    $statusMessage = '❌ المفتاح غير صالح أو محذوف';
                } elseif (str_contains($cooldownReason, 'rate_limited') || str_contains($cooldownReason, '429')) {
                    $status = 'cooldown';
                    $statusMessage = "⏳ يستريح — ضغط على المفتاح (يعود خلال {$cooldownRemaining} ثانية)";
                } elseif (str_contains($cooldownReason, '503') || str_contains($cooldownReason, 'overloaded')) {
                    $status = 'cooldown';
                    $statusMessage = "🔄 ضغط على سيرفرات جوجل (يعود خلال {$cooldownRemaining} ثانية)";
                } else {
                    $status = 'cooldown';
                    $statusMessage = "⏳ في استراحة ({$cooldownRemaining} ثانية متبقية)";
                }
            } elseif ($currentRpm >= self::RPM_LIMIT) {
                $status = 'rpm_full';
                $statusMessage = "⚡ وصل حد الدقيقة ({$currentRpm}/" . self::RPM_LIMIT . ") — يتجدد تلقائياً";
            } else {
                $status = 'active';
                $statusMessage = '✅ يعمل بشكل طبيعي';
            }

            $results[] = [
                'index' => $index + 1,
                'masked_key' => $maskedKey,
                'status' => $status,
                'status_message' => $statusMessage,
                'today_usage' => $todayUsage,
                'weekly_usage' => $weeklyUsage,
                'current_rpm' => $currentRpm,
                'rpm_limit' => self::RPM_LIMIT,
                'cooldown_remaining' => $cooldownRemaining,
                'cooldown_reason' => $cooldownReason,
                'estimated_daily_limit' => 1500,
                'estimated_remaining' => max(0, 1500 - $todayUsage),
            ];
        }

        // Summary
        $totalTodayUsage = collect($results)->sum('today_usage');
        $totalWeeklyUsage = collect($results)->sum('weekly_usage');
        $activeKeys = collect($results)->where('status', 'active')->count();
        $cooldownKeys = collect($results)->whereIn('status', ['cooldown', 'rpm_full'])->count();
        $invalidKeys = collect($results)->where('status', 'invalid')->count();

        $totalChats = DB::table('chats')->count();
        $todayMessages = DB::table('messages')
            ->whereIn('role', ['ai', 'assistant'])
            ->whereDate('created_at', $today)
            ->count();

        // System health level
        $totalKeys = count($results);
        $healthLevel = 'excellent';
        if ($totalKeys === 0) {
            $healthLevel = 'offline';
        } elseif ($activeKeys === 0) {
            $healthLevel = 'critical';
        } elseif ($activeKeys < ceil($totalKeys / 2)) {
            $healthLevel = 'degraded';
        }

        return response()->json([
            'keys' => $results,
            'summary' => [
                'total_keys' => $totalKeys,
                'active_keys' => $activeKeys,
                'cooldown_keys' => $cooldownKeys,
                'invalid_keys' => $invalidKeys,
                'today_total_usage' => $totalTodayUsage,
                'weekly_total_usage' => $totalWeeklyUsage,
                'total_chats' => $totalChats,
                'today_ai_messages' => $todayMessages,
                'health_level' => $healthLevel,
                'rpm_limit' => self::RPM_LIMIT,
            ],
        ]);
    }
}