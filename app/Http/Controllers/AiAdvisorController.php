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
    // Verbatim history size now lives in ConversationMemoryEngine::VERBATIM_MESSAGES,
    // which also decides what gets folded into the rolling summary instead.
    private const RATE_LIMIT_PER_HOUR = 40;
    private const MAX_FOLLOW_UP_SUGGESTIONS = 3;
    private const MAX_WIDGET_ITEMS = 8;
    private const MAX_AVAILABLE_CONTEXT_COURSES = 28;
    private const MAX_LOCKED_CONTEXT_COURSES = 12;
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

        $geminiService = app(\App\Services\GeminiService::class);
        $apiKeys = $geminiService->getApiKeys();
        $dailyLimit = $this->getDailyMessageLimitForUser($user);

        $usageKey = "ai_daily_usage_" . $user->id . "_" . date('Y-m-d');
        $usage = (int) Cache::get($usageKey, 0);
        $remaining = $dailyLimit === null ? null : max(0, $dailyLimit - $usage);

        // Proactive briefing shown the moment the page loads (deterministic, no API cost).
        $proactiveInsights = null;
        try {
            $proactiveInsights = app(\App\Engines\ProactiveInsightsEngine::class)->generate($user);
        } catch (\Throwable $e) {
            Log::warning('Proactive insights generation failed: ' . $e->getMessage());
        }

        return Inertia::render('Ai/Advisor', [
            'proactiveInsights' => $proactiveInsights,
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
            // Set when retrying after a failed stream(): that request already stored
            // the student's message, so storing it again would duplicate the turn.
            'user_message_stored' => ['nullable', 'boolean'],
        ]);

        $user = Auth::user();
        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 403);
        }

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

        if (empty($data['user_message_stored'])) {
            $chat->messages()->create([
                'role' => 'user',
                'content' => $data['message'],
            ]);
        }

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

        $geminiService = app(\App\Services\GeminiService::class);
        $apiKeys = $geminiService->getApiKeys();
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
                $pipeline = $this->runAdvisorPipeline($user, $chat, $data, $academicData, $cartData, $availableCourses, $geminiService);

                $replyText = $pipeline['reply'];
                $followUpSuggestions = $pipeline['follow_up_suggestions'];
                $interactiveWidget = $pipeline['interactive_widget'];
                $suggestedDetails = $pipeline['suggested_courses'];
                $removeDetails = $pipeline['courses_to_remove'];
                $refreshCartFlag = $pipeline['refresh_cart'];
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
                    ? $this->generateSmartTitle($data['message'], $replyText)
                    : $this->makeFallbackTitle($data['message']);

                $chat->update(['title' => $title]);
            }

            if (!$useFallback) {
                $this->queueContextSummary($chat);
            }

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
                'refresh_cart' => $refreshCartFlag ?? false,
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

    /**
     * The advisor generation pipeline: gather context, call Gemini, validate the
     * answer and resolve it into the payload the frontend renders.
     *
     * Shared by the blocking endpoint (chat) and the streaming one (stream). When
     * $onDelta is given the model is called in streaming mode and every newly
     * arrived slice of the reply text is handed to that callback.
     *
     * @return array{reply: string, suggested_courses: array, courses_to_remove: array, follow_up_suggestions: array, interactive_widget: ?array, refresh_cart: bool}
     */
    private function runAdvisorPipeline($user, Chat $chat, array $data, array $academicData, array $cartData, array $availableCourses, $geminiService, ?callable $onDelta = null): array
    {
        $message = (string) $data['message'];

        // --- ENTERPRISE AI PIPELINE ENGINES ---

        // 1. Structured RAG & Academic Rules
        $ragEngine = app(\App\Engines\StructuredRagEngine::class);
        $rulesEngine = app(\App\Engines\AcademicRulesEngine::class);

        $ragData = $ragEngine->gather($user);
        $rules = $rulesEngine->evaluate($user, ['total_passed_hours' => $ragData['profile']['total_passed_hours']], $ragData['cart']['hours']);

        // 2. Course Ranking Engine
        $rankingEngine = app(\App\Engines\CourseRankingEngine::class);
        $rankedCourses = $rankingEngine->rank($ragData['available_courses'], $rules, $message);

        // 3. Document RAG Engine
        $docEngine = app(\App\Engines\DocumentRagEngine::class);
        $docContext = $docEngine->search($message, 10);

        // 3.5 Risk Prediction Engine (needs cart course details, not just ids)
        $riskEngine = app(\App\Engines\RiskPredictionEngine::class);
        $cartCourseDetails = Course::whereIn('id', $ragData['cart']['ids'] ?? [])->get()->toArray();
        $riskWarnings = $riskEngine->evaluate($user, $cartCourseDetails, $rules);

        // 4. Ai Context Assembler (+ rolling memory of older turns)
        $memory = app(\App\Engines\ConversationMemoryEngine::class);
        $assembler = app(\App\Engines\AiContextAssembler::class);
        $systemInstruction = $assembler->build($rules, $rankedCourses, $ragData, $docContext, $riskWarnings, $memory->summaryBlock($chat));

        // 5. Build Conversation Context
        $contents = $this->buildConversationContext($chat);

        $options = [
            'systemInstruction' => $systemInstruction,
            'generationConfig' => [
                'maxOutputTokens' => (int) config('ai.generation.max_output_tokens', 2000),
                'temperature' => (float) config('ai.generation.temperature', 0.25),
                'responseMimeType' => 'application/json',
                'responseSchema' => $this->advisorResponseSchema(),
            ],
            'timeout' => $onDelta ? 40 : 22,
        ];

        if ($onDelta) {
            // The model emits one JSON object, so the reply text has to be lifted out
            // of the partially received envelope to be shown while it is still being
            // written. Only the characters not emitted yet are pushed downstream.
            $jsonBuffer = '';
            $emitted = 0;

            $rawText = $geminiService->streamGeminiAPI($contents, $options, function (string $fragment) use (&$jsonBuffer, &$emitted, $onDelta) {
                $jsonBuffer .= $fragment;
                $reply = $this->partialReplyText($jsonBuffer);
                $length = mb_strlen($reply, 'UTF-8');

                if ($length > $emitted) {
                    $onDelta(mb_substr($reply, $emitted, $length - $emitted, 'UTF-8'));
                    $emitted = $length;
                }
            });
        } else {
            $rawText = $geminiService->callGeminiAPI($contents, $options);
        }

        $parsed = $this->parseAIResponse($rawText);

        // The model often answers "تمت إضافتها بنجاح" while leaving courses_to_add
        // empty, so the student is told a course was added that never was. When they
        // asked for a named course explicitly, resolve it ourselves — ValidationEngine
        // below still decides whether it may actually enter the cart.
        $widgets = app(\App\Engines\DeterministicWidgetEngine::class);
        $eligibleNames = [];
        foreach (($availableCourses['details'] ?? []) as $cid => $cdata) {
            $eligibleNames[$cid] = $cdata['name'];
        }
        $claimsAdded = $widgets->claimsAdded((string) ($parsed['reply'] ?? ''));
        $explicitAdds = $claimsAdded ? $widgets->explicitAddRequest($message, $eligibleNames) : [];
        if (!empty($explicitAdds)) {
            $parsed['courses_to_add'] = array_values(array_unique(array_merge($parsed['courses_to_add'] ?? [], $explicitAdds)));
        }

        // 6. Validate AI Response (Hallucination & Overflow Check)
        $validator = app(\App\Engines\ValidationEngine::class);
        $parsed = $validator->validate($parsed, $ragData, $rules);

        // 7. Only now touch the cart. Writing before validation meant a
        // hallucinated course id inserted a real UserCart row for a course
        // the student is not even eligible to register.
        $refreshCartFlag = $this->addCoursesToCart($user, (array) ($parsed['courses_to_add'] ?? []), $academicData);

        $hadWarning = isset($parsed['warning']);
        if ($hadWarning) {
            $parsed['reply'] = $parsed['warning'] . "\n\n" . $parsed['reply'];
        }

        // The reply announced an addition that the cart never received (course already
        // there, or not eligible). Saying nothing would leave the student believing
        // their schedule changed. The hour-limit case already carries the validator's
        // own warning above, so it isn't repeated here.
        if ($claimsAdded && !$refreshCartFlag && !$hadWarning) {
            $parsed['reply'] = rtrim((string) $parsed['reply']) . "\n\n" . $this->addFailureNote($message, $eligibleNames, $cartData['map']);
        }

        $replyText = $this->normalizeReplyText((string) ($parsed['reply'] ?? ''));
        $followUpSuggestions = $this->sanitizeFollowUpSuggestions($parsed['follow_up_suggestions'] ?? []);
        $interactiveWidget = $this->sanitizeInteractiveWidget($parsed['interactive_widget'] ?? null);

        $availableDetailsMap = $eligibleNames;

        $interactiveWidget = $this->enrichWidgetWithCourseIds($interactiveWidget, $availableDetailsMap, $cartData['map']);

        // The model treats charts as optional decoration and routinely describes one
        // in prose without emitting it ("الرسم البياني أدناه..." with nothing below).
        // When the question is clearly asking for one, build it from the student's own
        // record instead — accurate arithmetic beats a model guess the sanitiser can
        // only clamp. An explicit widget from the model always wins.
        if ($interactiveWidget === null) {

            // A course was just added on the student's behalf: show them the resulting
            // schedule instead of only claiming it was added.
            if ($refreshCartFlag) {
                $freshCartIds = array_merge(array_map('intval', array_keys($cartData['map'])), $parsed['courses_to_add'] ?? []);
                $interactiveWidget = $this->sanitizeInteractiveWidget($widgets->cartReview(
                    Course::whereIn('id', array_unique($freshCartIds))->get(['id', 'name', 'code', 'credit_hours', 'difficulty_level']),
                    $rules
                ));
            }

            $interactiveWidget ??= match ($widgets->chooseFor($message)) {
                'gpa_forecast' => $this->sanitizeInteractiveWidget($widgets->gpaForecast(
                    $rules,
                    (int) ($cartData['hours'] ?? 0) ?: (int) ($rules['effective_limit'] ?? 15),
                    $this->targetGpaInMessage($message)
                )),
                'radar' => $this->enrichWidgetWithCourseIds(
                    $this->sanitizeInteractiveWidget($widgets->radarFromCourses(
                        (array) ($availableCourses['details'] ?? []),
                        $widgets->courseNamesInMessage($message, $availableDetailsMap)
                    )),
                    $availableDetailsMap,
                    $cartData['map']
                ),
                default => null,
            };
        }

        $eligibleIds = array_map('intval', array_keys($availableDetailsMap));
        $cartIds = array_map('intval', array_keys($cartData['map']));

        $suggestedIds = array_values(array_intersect($parsed['suggested_course_ids'] ?? [], $eligibleIds));
        $removeIds = array_values(array_intersect($parsed['remove_course_ids'] ?? [], $cartIds));

        if (empty($suggestedIds) && empty($removeIds)) {
            $matched = $this->matchCoursesInReply($replyText, $availableDetailsMap, $cartData['map']);
            $suggestedIds = $matched['suggested'];
            $removeIds = $matched['remove'];
        }

        // Safety net: if any older stored prompt still emits the placeholder,
        // strip it so the raw token never reaches the student.
        if (str_contains($replyText, '%%SKILL_TREE%%')) {
            $replyText = trim(str_replace('%%SKILL_TREE%%', '', $replyText));
        }

        return [
            'reply' => $replyText,
            'suggested_courses' => !empty($suggestedIds)
                ? Course::whereIn('id', $suggestedIds)->select('id', 'name', 'code', 'credit_hours', 'description')->get()->toArray()
                : [],
            'courses_to_remove' => !empty($removeIds)
                ? Course::whereIn('id', $removeIds)->select('id', 'name', 'code', 'credit_hours', 'description')->get()->toArray()
                : [],
            'follow_up_suggestions' => $followUpSuggestions,
            'interactive_widget' => $interactiveWidget,
            'refresh_cart' => $refreshCartFlag,
        ];
    }

    /**
     * Plain-language reason a claimed addition did not reach the cart, so the student
     * is corrected instead of misled.
     */
    private function addFailureNote(string $message, array $eligibleNames, array $cartNames): string
    {
        $widgets = app(\App\Engines\DeterministicWidgetEngine::class);

        // Already in the cart is the friendliest and most common case.
        $inCart = $widgets->courseNamesInMessage($message, $cartNames);
        if (!empty($inCart)) {
            return '📌 للتوضيح: **' . $inCart[0] . '** موجودة مسبقاً في تسجيلك التجريبي، فما تغيّر شيء في جدولك.';
        }

        if (empty($widgets->courseNamesInMessage($message, $eligibleNames))) {
            return '⚠️ للتوضيح: لم تُضف المادة فعلياً لأنها غير متاحة لك حالياً (قد تكون غير مطروحة أو متطلّبها السابق ناقص). راجع قائمة المواد المتاحة في صفحة الخطة الدراسية.';
        }

        return '⚠️ للتوضيح: لم تُضف المادة فعلياً — تجاوزت الحد المسموح لساعاتك هذا الفصل. أزل مادة أخرى أولاً ثم أعد المحاولة.';
    }

    /**
     * A GPA target the student named ("أوصل ٧٥", "أبي معدلي ٨٠") so the forecast can
     * draw their goal line. Arabic-Indic digits are accepted too.
     */
    private function targetGpaInMessage(string $message): ?float
    {
        $latin = strtr($message, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9']);

        if (!preg_match_all('/\d{2,3}(?:[.,]\d{1,2})?/', $latin, $matches)) {
            return null;
        }

        foreach ($matches[0] as $candidate) {
            $value = (float) str_replace(',', '.', $candidate);
            // Hour counts and dates are not GPA targets; the passing band starts at 60.
            if ($value >= 60 && $value <= 100) {
                return $value;
            }
        }

        return null;
    }

    /**
     * The reply text of a response envelope that is still being written.
     * Shares GeminiService's partial-JSON reader (same problem, one implementation).
     */
    private function partialReplyText(string $jsonBuffer): string
    {
        return app(\App\Services\GeminiService::class)->partialJsonStringValue($jsonBuffer, 'reply');
    }

    /**
     * Streaming counterpart of chat(): same pipeline, but the reply is pushed to the
     * browser as Gemini writes it (SSE) instead of after the whole call completes.
     *
     * Anything that would make streaming pointless or unsafe (no API keys, quota
     * exhausted, a cached answer) returns a normal JSON response instead, which the
     * frontend treats as "fall back to the blocking endpoint".
     */
    public function stream(Request $request)
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

        $geminiService = app(\App\Services\GeminiService::class);
        if (empty($geminiService->getApiKeys())) {
            // No cloud advisor: the local fallback lives in chat().
            return response()->json(['status' => 'error', 'reason' => 'stream_unavailable'], 503);
        }

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

        if (!$this->checkRateLimit($user->id)) {
            return response()->json([
                'status' => 'error',
                'message' => '⏳ وصلت للحد الأقصى من الرسائل لهذا الوقت. حاول لاحقاً.',
                'daily_messages_remaining' => $dailyLimit === null ? null : max(0, $dailyLimit - $usage),
                'has_daily_limit' => $dailyLimit !== null,
            ], 429);
        }

        $currentPeriod = AcademicPeriod::current();

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

        $responseCacheKey = $this->buildAiResponseCacheKey($user->id, $data['message'], $academicData, $cartData, $availableCourses, $data['filters'] ?? [], $data['difficulty'] ?? null, $data['critical_path'] ?? null);

        // An identical question was already answered: there is nothing to stream, and
        // chat() serves it from cache without spending a Gemini call. Bail out before
        // creating the chat/message so the fallback request doesn't duplicate them.
        if (Cache::has($responseCacheKey)) {
            return response()->json(['status' => 'error', 'reason' => 'cached'], 409);
        }

        // Only now is a real generation certain, so the turn may be persisted.
        $chat = $this->resolveChat($user, $data['chat_id'] ?? null, $data['message']);
        $isNewChat = $chat->wasRecentlyCreated;

        $chat->messages()->create([
            'role' => 'user',
            'content' => $data['message'],
        ]);

        // The response is held open for the whole generation, so release the session
        // lock first — otherwise other requests from this tab (cart reload, history)
        // would queue behind the stream.
        if ($request->hasSession()) {
            $request->session()->save();
        }

        return response()->stream(function () use ($user, $chat, $data, $academicData, $cartData, $availableCourses, $geminiService, $isNewChat, $dailyLimit, $usage, $usageKey, $responseCacheKey) {
            // Anything that buffers or compresses output would hold the whole reply
            // back to the end and defeat the point of streaming.
            @ini_set('zlib.output_compression', '0');
            @ini_set('output_buffering', '0');
            @ini_set('implicit_flush', '1');
            while (ob_get_level() > 0) {
                @ob_end_flush();
            }

            $send = function (string $event, array $payload) {
                echo "event: {$event}\n";
                echo 'data: ' . json_encode($payload, JSON_UNESCAPED_UNICODE) . "\n\n";
                @flush();
            };

            $send('open', ['chat_id' => $chat->id]);

            try {
                $payload = $this->runAdvisorPipeline(
                    $user,
                    $chat,
                    $data,
                    $academicData,
                    $cartData,
                    $availableCourses,
                    $geminiService,
                    fn (string $delta) => $send('delta', ['text' => $delta])
                );

                $stored = [
                    'reply' => $payload['reply'],
                    'suggested_courses' => $payload['suggested_courses'],
                    'courses_to_remove' => $payload['courses_to_remove'],
                    'follow_up_suggestions' => $payload['follow_up_suggestions'],
                    'interactive_widget' => $payload['interactive_widget'],
                ];

                $chat->messages()->create([
                    'role' => 'ai',
                    'content' => json_encode($stored, JSON_UNESCAPED_UNICODE),
                ]);

                if ($isNewChat) {
                    $chat->update(['title' => $this->makeFallbackTitle($data['message'])]);
                }

                $this->queueContextSummary($chat);

                $newRemaining = null;
                if ($dailyLimit !== null) {
                    Cache::put($usageKey, $usage + 1, now()->endOfDay());
                    $newRemaining = max(0, $dailyLimit - ($usage + 1));
                }

                Cache::put($responseCacheKey, $stored, now()->addHours(2));

                $send('done', array_merge($stored, [
                    'status' => 'success',
                    'refresh_cart' => $payload['refresh_cart'],
                    'chat_id' => $chat->id,
                    'chat_title' => $isNewChat ? $chat->title : null,
                    'daily_messages_remaining' => $newRemaining,
                    'has_daily_limit' => $dailyLimit !== null,
                    'is_fallback' => false,
                    'is_cached' => false,
                    'fallback_reason' => null,
                ]));
            } catch (\Throwable $e) {
                Log::error('Gemini stream error: ' . $e->getMessage(), [
                    'exception' => get_class($e),
                    'line' => $e->getLine(),
                ]);

                // The user message is already stored; the frontend retries against
                // the blocking endpoint, which owns the local-fallback path.
                $send('error', ['chat_id' => $chat->id, 'reason' => 'stream_failed']);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
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
        return Cache::remember('admin_ai_reports', 600, function () {
            return $this->buildAdminReports();
        });
    }

    private function buildAdminReports()
    {
        try {
            $currentPeriod = \App\Models\AcademicPeriod::current();
            $hasPeriodColumns = true; // Columns confirmed in migrations

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

        $passedHash = md5(implode(',', $passedCourseIds) . '|' . implode(',', $cartCourseIds));
        $cacheKey = "ai_available_courses:{$user->id}:{$user->major_id}:{$user->study_plan_version}:{$passedHash}";

        return Cache::remember($cacheKey, 300, function () use ($passedCourseIds, $cartCourseIds, $user, $currentPeriod) {
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

            $availableText = ["ID,Code,Name,Hrs,Yr,Type,Unlocks,Diff,Cart,Sched"];
            $lockedText = ["ID,Code,Name,Hrs,Status,Reason,Desc"];
            $availableCount = 0;
            $lockedCount = 0;

            foreach ($allEligible as $course) {
                $desc = empty($course['desc']) ? 'لا يوجد وصف' : $course['desc'];

                if ($course['status'] === 'Available' || $course['in_cart']) {
                    if ($availableCount >= self::MAX_AVAILABLE_CONTEXT_COURSES) {
                        continue;
                    }
                    $availableCount++;
                    $cCart = $course['in_cart'] ? 1 : 0;
                    $sched = empty($course['schedule_info']) ? '' : str_replace(',', '،', $course['schedule_info']);
                    $availableText[] = "{$course['id']},{$course['code']},{$course['name']},{$course['credit_hours']},{$course['course_year']},{$course['type']},{$course['unlocks']},{$course['difficulty_level']},{$cCart},{$sched}";
                } else {
                    if ($lockedCount >= self::MAX_LOCKED_CONTEXT_COURSES) {
                        continue;
                    }
                    $lockedCount++;
                    $reason = $this->describeLockReason($course['status']);
                    $lockedText[] = "{$course['id']},{$course['code']},{$course['name']},{$course['credit_hours']},{$course['status']},{$reason},{$desc}";
                }
            }

            return [
                'map' => $map,
                'text' => count($availableText) > 1 ? implode("\n", $availableText) : 'لا يوجد مواد متاحة للتسجيل حالياً!',    
                'available_text' => count($availableText) > 1 ? implode("\n", $availableText) : 'لا يوجد مواد متاحة للتسجيل حالياً!',
                'locked_text' => count($lockedText) > 1 ? implode("\n", $lockedText) : 'لا يوجد مواد مغلقة حالياً.',
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

        $firstSemesterRule = '';
        if ($this->isFirstSemesterStudent($academicData) && !$isSummer) {
            $firstSemesterRule = "- 🚨 **قاعدة إلزامية للفصل الأول**: بما أن الطالب لم ينجز أي ساعة بعد، اقترح عليه كبداية 12 ساعة فقط (4 مواد) بهذا الترتيب فقط: 1- أساسيات تكنولوجيا معلومات، 2- تصميم منطق رقمي، 3- مادة متطلب جامعة إجباري من مواد الأونلاين (type=university_req)، 4- مادة متطلب جامعة اختياري من مواد الأونلاين (type=university_req). متطلب الجامعة عندنا يعني مواد الأونلاين فقط، وقد يكون إجباري أو اختياري. لا تقترح مواد تخصص أو مواد عامة أخرى مكان متطلبات الجامعة، وخصوصاً لا تستخدم أساسيات الأمن السيبراني كمتطلب جامعة.\n";
        }

        $cartWarning = '';
        if (($cartData['hours'] ?? 0) > $effectiveLimit) {
            $excess = $cartData['hours'] - $effectiveLimit;
            $cartWarning = "\n⚠️ تنبيه: التسجيل التجريبي يحتوي {$cartData['hours']} ساعة ويتجاوز الحد الفعلي المسموح بـ {$excess} ساعة!";
        }

        $cartListWithIds = '';
        if (!empty($cartData['map'])) {
            $cartPairs = [];
            foreach ($cartData['map'] as $cid => $cname) {
                $cartPairs[] = "(ID:{$cid}) {$cname}";
            }
            $cartListWithIds = implode(' | ', $cartPairs);
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
            "- الإجابة المباشرة (توفير التوكنز): تجنب المقدمات الطويلة والخاتمات غير الضرورية. أعطِ الزبدة فوراً واجعل إجابتك مختصرة، **إلا إذا كان السؤال يتطلب شرحاً مفصلاً، خطة دراسية، أو توضيحاً لقوانين معقدة**، ففي هذه الحالة خذ المساحة الكافية للإجابة باحترافية وتفصيل كامل.\n" .
            "- ⚡ تسريع الرد وتلخيص الوصف: إذا طلب الطالب وصفاً أو استفسر عن مجموعة من المواد دفعة واحدة، اكتفِ بذكر كلمات قليلة جداً عن كل مادة لتسريع الإجابة وتجنب توليد نص طويل يأخذ وقتاً. لا تسهب في تفاصيل وصف المادة إلا إذا سأل عن مادة واحدة بالتحديد.\n" .
            "- الإجابة: سياق الإرشاد الأكاديمي، أجب ببساطة وود، وكن منظماً ومباشراً. استخدم النقاط لترتيب الأفكار.\n" .
            "- لا تقل 'لا أعرف'، قدم نصيحة عامة أو وجه للقسم المختص بثقة.\n" .
            "- للتسجيل واقتراح المواد: **اقرأ خطة الطالب بدقة واستعرض مواده المنجزة والمواد في التسجيل التجريبي**. عند الاقتراح، اختر من قائمة (المواد المتاحة للتسجيل) بشكل منطقي: أعطِ الأولوية لمواد التخصص الإجبارية (compulsory) والمواد التي تفتح مواد أخرى (Unlocks)، مع مراعاة الساعات المسموحة وتوازن الصعوبة.\n" .
            "- 🔎 الاستفسار عن مادة معينة: قبل أن تجيب، **ابحث عن اسم المادة في القائمتين معاً: (المواد المتاحة) و(المواد المغلقة)**. وحدة القائمتين تمثّلان خطة الطالب كاملة (المتاحة + المغلقة).\n" .
            "- 🚫 قاعدة صارمة: **إياك أن تقول إن مادة 'غير موجودة' أو 'غير متاحة' أو 'ليست ضمن المواد' إذا كانت مذكورة في أي من القائمتين** — فهي موجودة في خطة الطالب فعلاً، إما متاحة الآن أو مغلقة مؤقتاً. لا تقل إنها ليست ضمن خطته إلا إذا لم تظهر إطلاقاً في القائمتين، وعندها وجّهه للقسم/المرشد للتأكد بلطف.\n" .
            "- إذا وجدت المادة **مغلقة** (Status تبدأ بـ Locked): أخبره أولاً بأنها موجودة في خطته لكنها مقفلة حالياً، ثم اذكر السبب الدقيق من عمود (Reason)، ومتى يقدر يأخذها (بعد إتمام المتطلب السابق أو بلوغ عدد الساعات المطلوب)، وأعطه نبذة قصيرة من (Desc) وصعوبتها (Diff من 1 لـ 5).\n" .
            "- 📝 تنسيق الرد عن مادة محددة (اجعله واضحاً واحترافياً ومختصراً): سطر باسم المادة ورمزها وساعاتها، ثم سطر بحالتها (✅ متاحة / 🔒 مقفلة + السبب)، ثم نصيحة قصيرة أو نبذة. تجنّب الردود المبهمة أو الطويلة بلا فائدة.\n" .
            "- عامود (Sched) يحتوي على أوقات وأيام وقاعات الشُعب المطروحة واسم **المحاضر/المدرس**، اقرأه جيداً واستخدم هذه المعلومات إذا سألك الطالب عن المدرسين أو تفاصيل المحاضرات.\n" .
            "- اذكر الفصل، الحد الفعلي، ثم قيّم الحالة. الفصل الحالي: {$currentPeriodLabel}. حد الترم: {$currentTermLimit}س. الحد الأكاديمي: {$academicLimit}س. الحد المطبق: {$effectiveLimit}س.\n" .
            "- 🚨 قيود الساعات الذكية (هام جداً): الحد الطبيعي للفصل العادي 18 وللصيفي 9. الاستثناءات: (1) الخريج بالفصل العادي (باقي 21 ساعة أو أقل) مسموح له 21 ساعة. (2) الخريج بالصيفي (باقي 12 ساعة أو أقل) مسموح له 12 ساعة. (3) الصيفي في حال احتوى على مادة مختبر (ساعة واحدة) مسموح له 10 ساعات.\n" .
            ($isSummer ? "- (الفصل صيفي). ركز على المواد المطروحة في الصيفي إن وجدت.\n" : "- (ليس صيفياً).\n") .
            "- لا تخمّن الساعات. تجنب كلمات 'خريف/ربيع' واستخدم 'الفصل الأول/الثاني/الصيفي'.\n" .
            $filterInstructions .
            $firstSemesterRule .
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
            "المواد التي أتمها الطالب (ناجح فيها): " . ($academicData['passed_courses_names'] ?: 'لم ينجز أي مواد بعد') . " (⛔ هذه مواد ماضية، إياك أن تدرج أي منها ضمن جدول الفصل الحالي أو تحسب ساعاتها ضمن تسجيله الجديد)\n" .
            "التسجيل التجريبي الحالي: " . ($cartListWithIds ?: 'فارغ') . " ({$cartData['hours']}س)" . ($cartWarning ? " | تنبيه: تجاوز الحد الفعلي {$effectiveLimit}س" : '') . "\n\n" .
            "✅ المواد المتاحة للتسجيل للطالب (استخدم هذه القائمة فقط للاقتراح وإضافة المواد). العمود الأول (ID) هو الرقم التعريفي للمادة:\n{$availableCourses['available_text']}\n\n" .
            "🔒 المواد المغلقة حالياً — **هذه مواد موجودة في خطة الطالب لكنها مقفلة مؤقتاً** (لا تقترحها للتسجيل، لكن إذا سأل عنها الطالب فأكّد أنها موجودة واشرح سبب إغلاقها من عمود Reason ومتى يقدر يأخذها). الأعمدة: ID,Code,Name,Hrs,Status,Reason,Desc:\n{$availableCourses['locked_text']}\n\n" .
            "⚠️ شكل الرد الإجباري (JSON صالح فقط):\n" .
            "{\"reply\":\"...\",\"suggested_course_ids\":[],\"remove_course_ids\":[],\"follow_up_suggestions\":[\"...\"],\"interactive_widget\":null}\n" .
            "🚨 قاعدة المواد الحاسمة (لضمان تطابق الكروت مع كلامك):\n" .
            "- ⚠️ هام جداً: في مصفوفة (follow_up_suggestions)، يجب أن تكون الأسئلة المقترحة مكتوبة بلسان الطالب (بصيغة المتكلم)، لأن الطالب سيضغط عليها لإرسالها لك. (مثال خاطئ: 'هل تريد معرفة المزيد عن كذا؟') (مثال صحيح: 'كيف أقوم بتسجيل مادة كذا؟' أو 'ما هي شروط التخرج؟').\n" .
            "- إذا اقترحت للطالب مواد **للتسجيل**، ضع أرقامها (ID) فقط في المصفوفة suggested_course_ids — وحصراً أرقاماً موجودة في عمود ID بقائمة (المواد المتاحة للتسجيل).\n" .
            "- إذا نصحت الطالب **بحذف/تخفيف** مواد من تسجيله التجريبي، ضع أرقامها (ID) في remove_course_ids — وحصراً من أرقام مواد (التسجيل التجريبي الحالي).\n" .
            "- ⛔ لا تضع رقم مادة في suggested_course_ids إلا إذا كنت فعلاً تنصح بتسجيلها. إذا ذكرت مادة لتقول 'لا تسجّلها بعد' أو 'مغلقة'، **لا تضع رقمها** إطلاقاً.\n" .
            "- إذا كان ردك مجرد شرح أو حساب معدل ولا يتضمن اقتراح مواد، اترك المصفوفتين فارغتين [].\n" .
            "- 🚫🔢 **ممنوع منعاً باتاً كتابة رقم الـ ID داخل نص reply** (لا تكتب 'ID: 83' ولا '(ID:100)' ولا أي رقم تعريفي). الـ ID رقم داخلي للنظام يوضع فقط في مصفوفة suggested_course_ids/remove_course_ids ولا يعني شيئاً للطالب.\n" .
            "- 💡 بدل رقم الـ ID، اذكر للطالب **معلومات مفيدة فعلاً** عن كل مادة تقترحها: اسم المادة، عدد ساعاتها، مستوى صعوبتها (Diff من 1=سهلة إلى 5=صعبة بصياغة ودّية مثل 'صعوبتها متوسطة')، كم مادة تفتح (Unlocks)، ونبذة قصيرة من وصفها (Desc). اجعل الوصف عملياً يساعده على القرار، لا مجرد أرقام.\n" .
            "هام جداً: يجب أن يكون نص الـ reply سطراً واحداً برمجياً، استخدم الحرفين \\n للنزول سطر جديد ولا تضغط Enter (Literal newlines) داخل النص لتجنب كسر الـ JSON.\n" .
            "🚨 تحذير شديد: إياك أن تخترع أسماء مواد أو أرقام مواد أو عدد ساعات غير موجودة في القوائم أعلاه، سواء في النص أو في interactive_widget أو في مصفوفات الأرقام. أي رقم أو مادة من خارج القوائم سيسبب خطأ فادح بالنظام.";
    }

    /**
     * Recent turns sent verbatim. Older turns are not replayed at all — they reach
     * the model as the rolling summary that ConversationMemoryEngine::summaryBlock()
     * puts in the system instruction.
     */
    private function buildConversationContext($chat): array
    {
        return app(\App\Engines\ConversationMemoryEngine::class)->buildContents($chat);
    }

    /**
     * Queue a refresh of the chat's rolling summary once enough turns piled up past
     * the stored one. Never inline: the student's reply must not wait for it.
     */
    private function queueContextSummary($chat): void
    {
        try {
            if (app(\App\Engines\ConversationMemoryEngine::class)->needsSummary($chat)) {
                \App\Jobs\SummarizeChatContext::dispatch($chat->id);
            }
        } catch (\Throwable $e) {
            Log::warning('Could not queue chat summary: ' . $e->getMessage(), ['chat_id' => $chat->id]);
        }
    }


    /**
     * Insert validated course ids into the student's cart for the current period.
     * Callers must pass ids that already went through ValidationEngine.
     */
    private function addCoursesToCart($user, array $courseIds, array $academicData): bool
    {
        if (empty($courseIds)) {
            return false;
        }

        // Written with the query builder, exactly like TreeController::toggleSingleCart.
        // UserCart::$fillable is ['user_id'] only, so the Eloquent route silently
        // stripped course_id and academic_year/term — every AI-side add either threw a
        // NOT NULL violation or inserted an empty row, while the reply still told the
        // student "تمت إضافتها بنجاح".
        $rows = [];
        foreach (Course::whereIn('id', $courseIds)->pluck('id') as $courseId) {
            $rows[] = [
                'user_id' => $user->id,
                'course_id' => $courseId,
                'academic_year' => $academicData['current_period_year'] ?? null,
                'academic_term' => $academicData['current_period_term'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (empty($rows)) {
            return false;
        }

        $existing = DB::table('user_carts')
            ->where('user_id', $user->id)
            ->whereIn('course_id', array_column($rows, 'course_id'))
            ->pluck('course_id')
            ->all();

        $rows = array_values(array_filter($rows, fn ($row) => !in_array($row['course_id'], $existing)));
        if (empty($rows)) {
            return false;
        }

        DB::table('user_carts')->insertOrIgnore($rows);
        $added = true;

        foreach ($rows as $row) {
            \App\Models\StudentActivityLog::create([
                'user_id' => $user->id,
                'course_id' => $row['course_id'],
                'action' => 'course_cart_added',
            ]);
        }

        if ($added) {
            $this->clearStudentCache($user->id);
        }

        return $added;
    }

    /**
     * Response schema for the main advisor call.
     *
     * Gemini enforces this server-side, so the reply comes back as a well-formed
     * object instead of "hopefully JSON" text — which is what the regex repair
     * layers in normalizeReplyText()/stripReplyEnvelope() used to clean up.
     *
     * interactive_widget is a single superset object rather than a union: the
     * OpenAPI subset Gemini accepts has no reliable oneOf, and every field is
     * optional here, so sanitizeInteractiveWidget() keeps only what the chosen
     * type actually uses.
     */
    private function advisorResponseSchema(): array
    {
        // maxItems is not cosmetic: without an upper bound the model was observed
        // filling suggested_course_ids with a runaway sequence (…335, 336, 337…),
        // which consumed the entire output budget and truncated the whole envelope.
        $courseIdList = fn (int $max) => ['type' => 'ARRAY', 'items' => ['type' => 'INTEGER'], 'maxItems' => $max];

        return [
            'type' => 'OBJECT',
            // Generation order matters: the prose comes first (so streaming has
            // something to show immediately) and the small arrays last.
            'propertyOrdering' => ['reply', 'interactive_widget', 'suggested_course_ids', 'courses_to_add', 'remove_course_ids', 'follow_up_suggestions'],
            'properties' => [
                'reply' => ['type' => 'STRING'],
                'suggested_course_ids' => $courseIdList(6),
                'courses_to_add' => $courseIdList(5),
                'remove_course_ids' => $courseIdList(5),
                'follow_up_suggestions' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING'], 'maxItems' => self::MAX_FOLLOW_UP_SUGGESTIONS],
                'interactive_widget' => [
                    'type' => 'OBJECT',
                    'nullable' => true,
                    'properties' => [
                        'type' => ['type' => 'STRING'],
                        'title' => ['type' => 'STRING'],
                        'question' => ['type' => 'STRING'],
                        // hours_slider
                        'min' => ['type' => 'INTEGER'],
                        'max' => ['type' => 'INTEGER'],
                        'default' => ['type' => 'INTEGER'],
                        'current_cart_hours' => ['type' => 'INTEGER'],
                        // poll
                        'options' => [
                            'type' => 'ARRAY',
                            'maxItems' => 4,
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'label' => ['type' => 'STRING'],
                                    'value' => ['type' => 'STRING'],
                                ],
                            ],
                        ],
                        // comparison
                        'items' => [
                            'type' => 'ARRAY',
                            'maxItems' => self::MAX_WIDGET_ITEMS,
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'name' => ['type' => 'STRING'],
                                    'code' => ['type' => 'STRING'],
                                    'credit_hours' => ['type' => 'INTEGER'],
                                    'difficulty' => ['type' => 'INTEGER'],
                                    'unlocks' => ['type' => 'INTEGER'],
                                    'gpa_impact' => ['type' => 'STRING'],
                                    'recommendation' => ['type' => 'STRING'],
                                ],
                            ],
                        ],
                        // cart_review
                        'courses' => [
                            'type' => 'ARRAY',
                            'maxItems' => self::MAX_WIDGET_ITEMS,
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'name' => ['type' => 'STRING'],
                                    'code' => ['type' => 'STRING'],
                                    'credit_hours' => ['type' => 'INTEGER'],
                                    'difficulty' => ['type' => 'INTEGER'],
                                    'verdict' => ['type' => 'STRING'],
                                    'reason' => ['type' => 'STRING'],
                                ],
                            ],
                        ],
                        'summary' => [
                            'type' => 'OBJECT',
                            'properties' => [
                                'total_hours' => ['type' => 'INTEGER'],
                                'max_hours' => ['type' => 'INTEGER'],
                                'overall_difficulty' => ['type' => 'STRING'],
                                'recommendation' => ['type' => 'STRING'],
                            ],
                        ],
                        // gpa_forecast (generative chart)
                        'current_gpa' => ['type' => 'NUMBER'],
                        'target_gpa' => ['type' => 'NUMBER'],
                        'note' => ['type' => 'STRING'],
                        'points' => [
                            'type' => 'ARRAY',
                            'maxItems' => 6,
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'label' => ['type' => 'STRING'],
                                    'optimistic' => ['type' => 'NUMBER'],
                                    'expected' => ['type' => 'NUMBER'],
                                    'pessimistic' => ['type' => 'NUMBER'],
                                ],
                            ],
                        ],
                        // radar (generative chart)
                        'axes' => ['type' => 'ARRAY', 'items' => ['type' => 'STRING'], 'maxItems' => 6],
                        'series' => [
                            'type' => 'ARRAY',
                            'maxItems' => 4,
                            'items' => [
                                'type' => 'OBJECT',
                                'properties' => [
                                    'name' => ['type' => 'STRING'],
                                    'values' => ['type' => 'ARRAY', 'items' => ['type' => 'NUMBER'], 'maxItems' => 6],
                                ],
                            ],
                        ],
                    ],
                    'required' => ['type'],
                ],
            ],
            'required' => ['reply'],
        ];
    }

    private function parseAIResponse(string $rawText): array
    {
        $geminiService = app(\App\Services\GeminiService::class);
        $decoded = $geminiService->parseJsonResponse($rawText);

        if (isset($decoded['error_parsing']) && $decoded['error_parsing']) {
             return [
                 // A salvaged truncated reply is already clean text; only a genuinely
                 // malformed response pays for the aggressive repair regexes.
                 'reply' => $this->normalizeReplyText($decoded['reply'] ?: 'ما وصلني رد واضح هذه المرة. حاول إعادة السؤال بصيغة أقصر.', empty($decoded['truncated'])),
                 'follow_up_suggestions' => [],
                 'interactive_widget' => null,
                 'suggested_course_ids' => [],
                 'remove_course_ids' => [],
                 'courses_to_add' => [],
             ];
        }

        // responseSchema guarantees the shape here, so the reply only needs cosmetic
        // normalisation — no envelope stripping that could eat legitimate text.
        return [
            'reply' => $this->normalizeReplyText((string) ($decoded['reply'] ?? '')),
            'follow_up_suggestions' => $decoded['follow_up_suggestions'] ?? [],
            'interactive_widget' => $decoded['interactive_widget'] ?? null,
            'suggested_course_ids' => $this->extractCourseIds($decoded['suggested_course_ids'] ?? null),
            'remove_course_ids' => $this->extractCourseIds($decoded['remove_course_ids'] ?? null),
            'courses_to_add' => $this->extractCourseIds($decoded['courses_to_add'] ?? null),
        ];
    }

    private function extractCourseIds($raw): array
    {
        if (!is_array($raw)) {
            return [];
        }

        $ids = [];
        foreach ($raw as $item) {
            if (is_array($item)) {
                $item = $item['id'] ?? null;
            }
            if (is_numeric($item)) {
                $id = (int) $item;
                if ($id > 0) {
                    $ids[] = $id;
                }
            }
        }

        return array_values(array_unique($ids));
    }



    /**
     * Cosmetic cleanup of a reply.
     *
     * $repairEnvelope runs the destructive layer that tears a leaked JSON envelope
     * out of the text. It also mangles legitimate content (a `key: {` inside a code
     * block, a "ID: 3" the student typed), so it is reserved for the parse-failure
     * path; a schema-validated reply never needs it.
     */
    private function normalizeReplyText(string $text, bool $repairEnvelope = false): string
    {
        $clean = str_replace(['\\n', '\n'], "\n", $text);

        $clean = preg_replace('/<style\b[^>]*>.*?<\/style>/is', '', $clean);
        $clean = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $clean);

        $clean = html_entity_decode($clean, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        // Internal course ids are meaningless to the student, so they never stay in
        // the prose regardless of which path produced it.
        $clean = preg_replace('/\x{00A0}?\s*[\(\[]\s*ID\s*[:：]?\s*\d+\s*[\)\]]/iu', '', $clean);
        $clean = preg_replace('/\bID\s*[:#]?\s*\d+\b/iu', '', $clean);

        if ($repairEnvelope) {
            $geminiService = app(\App\Services\GeminiService::class);
            $clean = trim($geminiService->stripReplyEnvelope($clean));

            // Catch-all for any JSON property formatting left in the string.
            // Example: "some_key": [...]
            $clean = preg_replace('/["\']?[a-zA-Z_]+["\']?\s*:\s*[\[\{].*?[\]\}]/isu', '', $clean);

            // Remove markdown JSON wrappers if still present.
            $clean = preg_replace('/```(?:json)?\s*(.*?)```/is', '$1', $clean);
        }

        // Repair bold spans the model padded with inner spaces ("** نص **"), which
        // Markdown renders as literal asterisks instead of bold. Collapse the padding
        // so "**نص**" renders correctly. Content excludes '*'/newline so multiple
        // bold spans on one line don't cross-match.
        $clean = preg_replace('/\*\*[ \t]*([^*\n]+?)[ \t]*\*\*/u', '**$1**', $clean);
        
        $clean = preg_replace('/(?:[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]\x{FE0F}?\s*){3,}/u', '', $clean);
        $clean = preg_replace('/(?<!`)[ \t]{2,}/', ' ', $clean);
        
        $clean = preg_replace('/\n{3,}/', "\n\n", $clean);

        return trim($clean) ?: 'ما وصلني رد واضح هذه المرة. اكتب سؤالك بصيغة أقصر وأنا أجاوبك فوراً.';
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
            // Generative charts: the model supplies the data points, the frontend
            // owns the rendering. Values are clamped so a hallucinated 900% GPA or a
            // 30-point series can never break the chart layout.
            'gpa_forecast' => $this->sanitizeGpaForecastWidget($widget),
            'radar' => $this->sanitizeRadarWidget($widget),
            default => null,
        };
    }

    private function sanitizeGpaForecastWidget(array $widget): ?array
    {
        $clampGpa = fn ($value) => round(min(100, max(0, (float) $value)), 2);

        $points = [];
        foreach (array_slice(is_array($widget['points'] ?? null) ? $widget['points'] : [], 0, 6) as $point) {
            if (!is_array($point)) {
                continue;
            }

            $label = mb_substr(trim((string) ($point['label'] ?? '')), 0, 30, 'UTF-8');
            if ($label === '') {
                continue;
            }

            $expected = $clampGpa($point['expected'] ?? 0);
            $row = ['label' => $label, 'expected' => $expected];

            // Optimistic/pessimistic bands are optional; drop them unless both make
            // sense relative to the expected line.
            if (isset($point['optimistic'])) {
                $row['optimistic'] = max($expected, $clampGpa($point['optimistic']));
            }
            if (isset($point['pessimistic'])) {
                $row['pessimistic'] = min($expected, $clampGpa($point['pessimistic']));
            }

            $points[] = $row;
        }

        if (count($points) < 2) {
            return null; // a single dot is not a forecast
        }

        return [
            'type' => 'gpa_forecast',
            'title' => mb_substr(trim((string) ($widget['title'] ?? 'توقّع معدلك التراكمي')), 0, 120, 'UTF-8'),
            'current_gpa' => isset($widget['current_gpa']) ? $clampGpa($widget['current_gpa']) : null,
            'target_gpa' => isset($widget['target_gpa']) ? $clampGpa($widget['target_gpa']) : null,
            'note' => mb_substr(trim((string) ($widget['note'] ?? '')), 0, 200, 'UTF-8'),
            'points' => $points,
        ];
    }

    private function sanitizeRadarWidget(array $widget): ?array
    {
        $axes = [];
        foreach (array_slice(is_array($widget['axes'] ?? null) ? $widget['axes'] : [], 0, 6) as $axis) {
            $label = mb_substr(trim((string) $axis), 0, 30, 'UTF-8');
            if ($label !== '') {
                $axes[] = $label;
            }
        }

        if (count($axes) < 3) {
            return null; // a radar needs at least a triangle
        }

        $series = [];
        foreach (array_slice(is_array($widget['series'] ?? null) ? $widget['series'] : [], 0, 4) as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $name = mb_substr(trim((string) ($entry['name'] ?? '')), 0, 60, 'UTF-8');
            $rawValues = is_array($entry['values'] ?? null) ? $entry['values'] : [];
            if ($name === '' || count($rawValues) < count($axes)) {
                continue; // an axis without a value would render as a collapsed shape
            }

            $values = [];
            foreach (array_slice($rawValues, 0, count($axes)) as $value) {
                $values[] = round(min(5, max(0, (float) $value)), 1);
            }

            $series[] = ['name' => $name, 'values' => $values];
        }

        if (empty($series)) {
            return null;
        }

        return [
            'type' => 'radar',
            'title' => mb_substr(trim((string) ($widget['title'] ?? 'مقارنة متعددة الأبعاد')), 0, 120, 'UTF-8'),
            'note' => mb_substr(trim((string) ($widget['note'] ?? '')), 0, 200, 'UTF-8'),
            'axes' => $axes,
            'series' => $series,
        ];
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

    private function describeLockReason(string $status): string
    {
        if (preg_match('/^Locked_Prereqs\((.+)\)$/u', $status, $m)) {
            return 'مقفلة - يلزم إتمام المتطلب السابق: ' . str_replace('+', ' و ', $m[1]);
        }

        if (preg_match('/^Locked_Hrs\((\d+)\)$/u', $status, $m)) {
            return "مقفلة - يلزم إتمام {$m[1]} ساعة معتمدة على الأقل قبل أخذها";
        }

        return 'مقفلة حالياً';
    }

    private function isFirstSemesterStudent(array $academicData): bool
    {
        return (int) ($academicData['total_passed_hours'] ?? 0) === 0;
    }

    private function getFirstSemesterStarterCourseIds(array $availableCourses, int $maxHours = 12): array
    {
        $details = [];
        foreach (($availableCourses['details'] ?? []) as $id => $course) {
            if (!is_array($course)) {
                continue;
            }
            $course['id'] = (int) $id;
            $details[] = $course;
        }

        $selected = [];
        $selectedLookup = [];
        $selectedHours = 0;

        $addFirst = function (callable $predicate) use (&$details, &$selected, &$selectedLookup, &$selectedHours, $maxHours): void {
            foreach ($details as $course) {
                $id = (int) ($course['id'] ?? 0);
                $hours = (int) ($course['credit_hours'] ?? 0);
                if ($id <= 0 || isset($selectedLookup[$id]) || !$predicate($course) || $selectedHours + $hours > $maxHours) {
                    continue;
                }

                $selected[] = $id;
                $selectedLookup[$id] = true;
                $selectedHours += $hours;
                return;
            }
        };

        $addFirst(fn(array $course) => $this->isInfoTechBasicsCourse($course));
        $addFirst(fn(array $course) => $this->isDigitalLogicCourse($course));
        $addFirst(fn(array $course) => $this->isUniversityCompulsoryCourse($course));
        $addFirst(fn(array $course) => $this->isUniversityElectiveCourse($course));

        return $selected;
    }

    private function isInfoTechBasicsCourse(array $course): bool
    {
        return $this->courseNameHasAll($course, ['اساسيات', 'تكنولوجيا', 'معلومات']);
    }

    private function isDigitalLogicCourse(array $course): bool
    {
        return $this->courseNameHasAll($course, ['تصميم', 'منطق', 'رقمي']);
    }

    private function isUniversityRequirementCourse(array $course): bool
    {
        return (string) ($course['type'] ?? '') === 'university_req';
    }

    private function isUniversityElectiveCourse(array $course): bool
    {
        return $this->isUniversityRequirementCourse($course)
            && $this->courseNameHasAny($course, ['اختياري', 'اختيارية']);
    }

    private function isUniversityCompulsoryCourse(array $course): bool
    {
        return $this->isUniversityRequirementCourse($course)
            && !$this->isUniversityElectiveCourse($course);
    }

    private function courseNameHasAll(array $course, array $parts): bool
    {
        $name = $this->normalizeArabic((string) ($course['name'] ?? ''));

        foreach ($parts as $part) {
            if (!str_contains($name, $this->normalizeArabic($part))) {
                return false;
            }
        }

        return true;
    }

    private function courseNameHasAny(array $course, array $parts): bool
    {
        $name = $this->normalizeArabic((string) ($course['name'] ?? ''));

        foreach ($parts as $part) {
            if (str_contains($name, $this->normalizeArabic($part))) {
                return true;
            }
        }

        return false;
    }

    private function replyMentionsFirstSemesterStarter(string $replyText): bool
    {
        $normalized = $this->normalizeArabic($replyText);

        return str_contains($normalized, $this->normalizeArabic('اساسيات تكنولوجيا'))
            && str_contains($normalized, $this->normalizeArabic('تصميم منطق'))
            && str_contains($normalized, $this->normalizeArabic('متطلب جامعة'));
    }

    private function normalizeArabic($text): string
    {
        if (!$text) {
            return '';
        }

        $text = preg_replace('/[أإآا]/u', 'ا', (string) $text);
        $text = preg_replace('/[ةه]/u', 'ه', $text);
        $text = preg_replace('/ى/u', 'ي', $text);
        
        $text = preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $text);
        
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
            'advisor_rule_version' => 'first_semester_online_req_v4',
        ];

        return 'ai_response_' . $userId . '_' . md5(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function generateSmartTitle(string $userMessage, string $aiReply): string
    {
        try {
            $prompt = "بناءً على هذا السؤال: \"{$userMessage}\"\nوهذا الجواب المختصر: \"" . mb_substr($aiReply, 0, 200) . "\"\n\nاكتب عنوان قصير جداً (3-6 كلمات عربية) يلخص الموضوع. أرجع النص فقط.";
            
            $geminiService = app(\App\Services\GeminiService::class);
            $rawText = $geminiService->callGeminiAPI([['role' => 'user', 'parts' => [['text' => $prompt]]]]);
            
            if ($rawText) {
                $title = trim(str_replace(['"', "'", '`', "\n"], '', $rawText));
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

        $availableDetails = [];
        foreach (($availableCourses['details'] ?? []) as $id => $course) {
            if (is_array($course)) {
                $course['id'] = (int) $id;
                $availableDetails[] = $course;
            }
        }
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

        if ($this->isFirstSemesterStudent($academicData)) {
            $starterIds = $this->getFirstSemesterStarterCourseIds($availableCourses);
            if (!empty($starterIds)) {
                $suggestedIds = $starterIds;
                $reply .= "\n\nبما أنك في أول فصل، الأفضل تثبيت البداية على: **أساسيات تكنولوجيا معلومات**، **تصميم منطق رقمي**، **متطلب جامعة إجباري من مواد الأونلاين**، و**متطلب جامعة اختياري من مواد الأونلاين**.";
            }
        }

        if (empty($suggestedIds)) {
            foreach (array_slice($availableDetails, 0, 3) as $course) {
                $suggestedIds[] = (int) $course['id'];
            }
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

    public function getApiKeyStatus()
    {
        $user = Auth::user();
        if (!$user || !method_exists($user, 'isAdminOrOwner') || !$user->isAdminOrOwner()) {
            abort(403);
        }

        $geminiService = app(\App\Services\GeminiService::class);
        $apiKeys = $geminiService->getApiKeys();
        $results = [];
        $today = date('Y-m-d');

        foreach ($apiKeys as $index => $key) {
            $maskedKey = substr($key, 0, 10) . '...' . substr($key, -4);
            $cacheKey = 'gemini_key_usage_' . md5($key) . '_' . $today;
            $todayUsage = (int) Cache::get($cacheKey, 0);

            $currentRpm = $geminiService->getKeyRpm($key);
            $cooldownRemaining = $geminiService->getKeyCooldownRemaining($key);
            $cooldownReason = (string) Cache::get('gemini_cooldown_reason_' . md5($key), '');

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
            } elseif ($currentRpm >= 14) {
                $status = 'rpm_full';
                $statusMessage = "⚡ وصل حد الدقيقة ({$currentRpm}/" . 14 . ") — يتجدد تلقائياً";
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
                'rpm_limit' => 14,
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
                'rpm_limit' => 14,
            ],
        ]);
    }

    public function generateSmartSchedule(\Illuminate\Http\Request $request)
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        if (!$user) return response()->json(['error' => 'Unauthorized'], 401);

        $targetHours = (int) $request->input('targetHours', 15);
        $schedulePace = $request->input('schedulePace', 'balanced');
        $smartFocus = $request->input('smartFocus', 'major');
        $smartProtectGpa = (bool) $request->input('smartProtectGpa', false);

        $academicData = $this->getStudentAcademicData($user);
        $availableCourses = $this->getAvailableCourses($academicData['passed_course_ids'], [], $user);
        
        $systemPrompt = "أنت 'الخوارزمية الذكية' لجامعة الزرقاء. مهمتك بناء جدول دراسي مثالي للطالب لفصل واحد فقط بناءً على خياراته.\n";
        $systemPrompt .= "الساعات المطلوبة: {$targetHours} ساعة.\n";
        $systemPrompt .= "نمط الصعوبة: {$schedulePace} (light=سهل, balanced=متوازن, heavy=صعب).\n";
        $systemPrompt .= "الأولوية: {$smartFocus} (major=مواد تخصص, graduation=تسريع تخرج, gpa=حماية معدل).\n";
        $systemPrompt .= "حماية المعدل: " . ($smartProtectGpa ? "مفعل (تجنب مواد عالية الرسوب)" : "غير مفعل") . ".\n\n";
        
        $systemPrompt .= "المواد المتاحة للتسجيل (مفتوحة المتطلبات):\n";
        foreach ($availableCourses['details'] as $id => $course) {
            $systemPrompt .= "- ID: {$id} | {$course['name']} | ساعات: {$course['credit_hours']} | صعوبة: {$course['difficulty_level']}/5 | تفتح: " . ($course['unlocks'] ?? 0) . " مواد\n";
        }
        $systemPrompt .= "\nالشرط الأهم والأكثر صرامة: إياك ثم إياك أن يتجاوز مجموع الساعات للمواد المختارة {$targetHours} ساعة كحد أقصى! احسب مجموع الساعات للمواد التي تختارها خطوة بخطوة، وإذا تجاوزت {$targetHours} فسيعتبر الجدول فاشلاً. يجب أن تكون منطقية ومتوافقة مع إعدادات الطالب. أرجع مصفوفة JSON تحتوي على ID المادة، سبب اختيارها القوي، ونسبة الثقة بالاختيار (0-100).\n";

        $responseSchema = [
            'type' => 'OBJECT',
            'properties' => [
                'schedule' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'course_id' => ['type' => 'INTEGER'],
                            'reason' => ['type' => 'STRING'],
                            'confidence' => ['type' => 'INTEGER']
                        ]
                    ]
                ]
            ]
        ];

        $geminiService = app(\App\Services\GeminiService::class);
        $rawText = $geminiService->callGeminiAPI([['role' => 'user', 'parts' => [['text' => 'اصنع الجدول الذكي الآن']]]], [
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'timeout' => 60,
            'generationConfig' => [
                'temperature' => 0.2,
                'responseMimeType' => 'application/json',
                'responseSchema' => $responseSchema
            ]
        ]);

        $decoded = $geminiService->parseJsonResponse($rawText);
        
        $newCart = [];
        $selectedMeta = [];
        $currentHours = 0;
        
        if (isset($decoded['schedule']) && is_array($decoded['schedule'])) {
            foreach ($decoded['schedule'] as $item) {
                if (isset($item['course_id']) && isset($availableCourses['details'][$item['course_id']])) {
                    $cHours = $availableCourses['details'][$item['course_id']]['credit_hours'];
                    if ($currentHours + $cHours <= $targetHours) {
                        $currentHours += $cHours;
                        $newCart[] = $item['course_id'];
                        $selectedMeta[$item['course_id']] = [
                            'confidence' => $item['confidence'] ?? 80,
                            'dataConfidence' => 90,
                            'reasons' => [$item['reason'] ?? 'مختارة بذكاء']
                        ];
                    }
                }
            }
        }

        return response()->json([
            'newCart' => $newCart,
            'selectedMeta' => $selectedMeta
        ]);
    }

    public function generateFullPlan(\Illuminate\Http\Request $request)
    {
        $user = \Illuminate\Support\Facades\Auth::user();
        if (!$user) return response()->json(['error' => 'Unauthorized'], 401);

        $academicData = $this->getStudentAcademicData($user);
        $passedIds = $academicData['passed_course_ids'];
        
        $allCourses = \App\Models\Course::where('major_id', $user->major_id)->get();
        $remainingCourses = [];
        foreach ($allCourses as $c) {
            if (!in_array($c->id, $passedIds)) {
                $prereqText = $c->prerequisites->pluck('id')->implode(',');
                $remainingCourses[] = [
                    'id' => $c->id,
                    'name' => $c->name,
                    'hours' => $c->credit_hours,
                    'diff' => $c->difficulty_level,
                    'prereqs' => $prereqText
                ];
            }
        }

        $systemPrompt = "أنت مخطط أكاديمي خبير. مهمتك توزيع المواد المتبقية للطالب على الفصول القادمة حتى التخرج.\n";
        $systemPrompt .= "يجب مراعاة:\n1. السلاسل المعتمدة (لا يمكن أخذ مادة قبل متطلبها السابق).\n";
        $systemPrompt .= "2. كل فصل عادي يجب أن يحتوي بين 12 إلى 18 ساعة.\n";
        $systemPrompt .= "3. موازنة الصعوبة في كل فصل.\n\n";
        $systemPrompt .= "المواد المتبقية:\n";
        foreach ($remainingCourses as $rc) {
            $systemPrompt .= "- ID: {$rc['id']} | {$rc['name']} | ساعات: {$rc['hours']} | متطلبات سابقة (IDs): [{$rc['prereqs']}]\n";
        }
        
        $responseSchema = [
            'type' => 'OBJECT',
            'properties' => [
                'semesters' => [
                    'type' => 'ARRAY',
                    'items' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'title' => ['type' => 'STRING', 'description' => 'مثال: الفصل الأول (السنة الثانية)'],
                            'courses' => [
                                'type' => 'ARRAY',
                                'items' => [
                                    'type' => 'OBJECT',
                                    'properties' => [
                                        'course_id' => ['type' => 'INTEGER']
                                    ]
                                ]
                            ]
                        ]
                    ]
                ]
            ]
        ];

        $geminiService = app(\App\Services\GeminiService::class);
        $rawText = $geminiService->callGeminiAPI([['role' => 'user', 'parts' => [['text' => 'اصنع خطة التخرج الكاملة الآن']]]], [
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'timeout' => 60,
            'generationConfig' => [
                'temperature' => 0.1,
                'responseMimeType' => 'application/json',
                'responseSchema' => $responseSchema
            ]
        ]);

        $decoded = $geminiService->parseJsonResponse($rawText);
        
        return response()->json([
            'plan' => $decoded['semesters'] ?? []
        ]);
    }

    public function analyzeCourseInTree(Request $request)
    {
        $request->validate(['course_id' => 'required|integer']);
        $user = Auth::user();
        $course = Course::with(['prerequisites', 'children'])->findOrFail($request->course_id);

        $passedIds = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('grade', '>=', 50)
            ->pluck('course_id')->toArray();

        $gpaData = $user->calculateGPA();

        $prereqs = $course->prerequisites->pluck('name')->implode('، ');
        $unlocks = $course->children->pluck('name')->implode('، ');
        $unlocksCount = $course->children->count();
        $isPassed = in_array($course->id, $passedIds);

        $systemPrompt = "أنت 'د. سنفور'، المستشار الأكاديمي الودود والذكي. الطالب يطلب نصيحة سريعة حول مادة '{$course->name}'.\n";
        $systemPrompt .= "معلومات الطالب:\n- معدله التراكمي: " . (isset($gpaData['percentage']) ? $gpaData['percentage'] : 'غير معروف') . "%\n- الساعات المنجزة: " . ($gpaData['completed_hours'] ?? 0) . "\n";
        $systemPrompt .= "- حالة المادة الحالية: " . ($isPassed ? "مجتازة بنجاح" : "لم ينجزها بعد") . "\n\n";
        
        $systemPrompt .= "معلومات المادة:\n- عدد الساعات: {$course->credit_hours}\n- الصعوبة: {$course->difficulty_level}/5\n";
        $systemPrompt .= "- المتطلبات السابقة: " . ($prereqs ?: 'لا يوجد') . "\n";
        $systemPrompt .= "- تفتح المواد التالية ({$unlocksCount} مادة): " . ($unlocks ?: 'لا تفتح شيء') . "\n\n";
        
        $systemPrompt .= "المطلوب: قدم نصيحة سريعة من 2-3 أسطر فقط. أخبر الطالب إذا كانت المادة هامة جداً (لأنها تفتح مواد أخرى) أو إذا كانت صعبة وبحاجة لوقت، أو شجعه إذا كان قد اجتازها. لا تذكر الأرقام (مثل 3 من 5) بل استخدم كلمات (متوسطة، صعبة، الخ). استخدم تنسيق Markdown (bold, lists) وتحدث بودية واستخدم الايموجي.";

        $geminiService = app(\App\Services\GeminiService::class);
        $rawText = $geminiService->callGeminiAPI([['role' => 'user', 'parts' => [['text' => 'أعطني نصيحتك حول هذه المادة']]]], [
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => [
                'temperature' => 0.4,
                'responseMimeType' => 'text/plain',
            ]
        ]);

        return response()->json([
            'advice' => $rawText
        ]);
    }

    public function analyzeTreeBottlenecks(Request $request)
    {
        $user = Auth::user();
        
        $passedIds = DB::table('course_user')
            ->where('user_id', $user->id)
            ->where('grade', '>=', 50)
            ->pluck('course_id')->toArray();

        // Get all mandatory courses (compulsory and supporting) that are not passed
        $mandatoryCourses = Course::whereIn('type', ['compulsory', 'supporting'])
            ->where('major_id', $user->major_id)
            ->withCount('children')
            ->get();

        $remainingCourses = $mandatoryCourses->reject(function($c) use ($passedIds) {
            return in_array($c->id, $passedIds);
        });

        // Filter unique courses by name to avoid duplicates and Sort by children_count descending
        $topBottlenecks = $remainingCourses->unique('name')->sortByDesc('children_count')->take(6);

        $gpaData = $user->calculateGPA();

        $systemPrompt = "أنت 'د. سنفور'، المستشار الأكاديمي الاستراتيجي. طلب الطالب تحليل خطته لاكتشاف 'المواد المفتاحية' (المواد التي تفتح مجالات أخرى في الشجرة وتأجيلها سيؤخر تخرجه).\n";
        $systemPrompt .= "معلومات الطالب:\n- معدله: " . ($gpaData['percentage'] ?? 'غير معروف') . "%\n- الساعات المنجزة: " . ($gpaData['completed_hours'] ?? 0) . "\n\n";
        
        $systemPrompt .= "المواد المتبقية التي تمثل مواد مفتاحية (مرتبة حسب الأهمية):\n";
        foreach ($topBottlenecks as $c) {
            $systemPrompt .= "- {$c->name} (تفتح {$c->children_count} مواد)\n";
        }
        
        $systemPrompt .= "\nالمطلوب: قدم تقريراً سريعاً وذكياً من فقرتين. اشرح له أهمية هذه المواد وأنصحه بتسجيلها في أقرب فرصة لتجنب تأخير التخرج. كن مشجعاً واستخدم Markdown لعرض المواد كنقاط بارزة مع الايموجي المناسب.";

        $geminiService = app(\App\Services\GeminiService::class);
        $rawText = $geminiService->callGeminiAPI([['role' => 'user', 'parts' => [['text' => 'حلل خطتي وأعطني الخلاصة']]]], [
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => [
                'temperature' => 0.5,
                'responseMimeType' => 'text/plain',
            ]
        ]);

        return response()->json([
            'analysis' => $rawText
        ]);
    }
}
