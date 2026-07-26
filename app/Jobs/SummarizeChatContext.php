<?php

namespace App\Jobs;

use App\Engines\ConversationMemoryEngine;
use App\Models\Chat;
use App\Services\GeminiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Compress the older turns of a chat into one rolling summary.
 *
 * Runs on the queue on purpose: the student's own reply must never wait on a
 * second Gemini round-trip, and each advisor key only has ~14 requests/minute to
 * spend. If the call fails the chat simply keeps its previous summary and the next
 * message re-queues the job.
 */
class SummarizeChatContext implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;
    public $tries = 2;

    public function __construct(public int $chatId)
    {
    }

    public function uniqueId(): string
    {
        return 'summarize-chat-' . $this->chatId;
    }

    /** Don't hold the lock past the job itself. */
    public function uniqueFor(): int
    {
        return 300;
    }

    public function handle(ConversationMemoryEngine $memory, GeminiService $gemini): void
    {
        $chat = Chat::find($this->chatId);
        if (!$chat) {
            return;
        }

        [$transcript, $uptoId] = $memory->messagesToSummarize($chat);
        if (empty($transcript) || !$uptoId) {
            return;
        }

        $previous = trim((string) $chat->context_summary);
        $lines = [];
        foreach ($transcript as $turn) {
            $lines[] = ($turn['role'] === 'model' ? 'المرشد: ' : 'الطالب: ') . $turn['text'];
        }

        $prompt = "أنت محرك ذاكرة لمرشد أكاديمي. لخّص المحادثة التالية بين طالب ومرشده الأكاديمي في نقاط قصيرة جداً (٥ نقاط كحد أقصى) تحفظ فقط ما يفيد استكمال الحديث لاحقاً:\n"
            . "- ما يريده الطالب وأهدافه (تخرج مبكر، رفع معدل، تخصص يهمه...).\n"
            . "- القرارات المتخذة (مواد أضافها أو حذفها، عدد ساعات اتفقتم عليه).\n"
            . "- قيود أو ظروف ذكرها (عمل، إنذار، مادة رسب فيها، أوقات لا تناسبه).\n"
            . "- أسئلة سألها وأُجيبت فعلاً (حتى لا تُعاد عليه).\n"
            . "تجاهل المجاملات والتفاصيل التي لم تعد مهمة، ولا تخترع أي معلومة، واكتب النقاط بالعربية بصيغة الغائب عن الطالب.\n\n";

        if ($previous !== '') {
            $prompt .= "=== الملخص السابق (ادمجه مع الجديد وأعد كتابة ملخص واحد موحّد) ===\n{$previous}\n\n";
        }

        $prompt .= "=== الرسائل الأقدم التي يجب تلخيصها ===\n" . implode("\n", $lines);

        try {
            $raw = $gemini->callGeminiAPI(
                [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                [
                    'generationConfig' => [
                        'temperature' => 0.2,
                        'maxOutputTokens' => 500,
                        'responseMimeType' => 'application/json',
                        'responseSchema' => [
                            'type' => 'OBJECT',
                            'properties' => ['summary' => ['type' => 'STRING']],
                            'required' => ['summary'],
                        ],
                    ],
                    'timeout' => 20,
                ]
            );

            $summary = trim((string) ($gemini->parseJsonResponse($raw)['summary'] ?? ''));
            if ($summary === '') {
                Log::warning('Chat summary came back empty', ['chat_id' => $this->chatId]);
                return;
            }

            $chat->update([
                'context_summary' => mb_substr($summary, 0, 2500, 'UTF-8'),
                'summary_upto_message_id' => $uptoId,
                'summary_updated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // The chat keeps its previous summary; the next message re-queues this.
            Log::warning('Chat summarization failed: ' . $e->getMessage(), ['chat_id' => $this->chatId]);
        }
    }
}
