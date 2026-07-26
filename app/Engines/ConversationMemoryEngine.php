<?php

namespace App\Engines;

use App\Models\Chat;

/**
 * Rolling conversation memory.
 *
 * Replaying every turn to Gemini competes with the (already large) system prompt
 * for the context window, and Flash-tier models start ignoring instructions once
 * that window fills. So the recent turns are sent verbatim — they carry the exact
 * wording the student used — while everything older is compressed into one short
 * summary produced in the background by SummarizeChatContext.
 *
 * The summary is injected into the systemInstruction rather than the message list,
 * because `contents` must stay a clean alternating user/model transcript.
 */
class ConversationMemoryEngine
{
    /** Turns kept verbatim (must be odd so the transcript starts with a user turn). */
    public const VERBATIM_MESSAGES = 7;

    /** Unsummarised older turns tolerated before a new summary is queued. */
    public const SUMMARY_THRESHOLD = 6;

    /**
     * Build the Gemini `contents` transcript for a chat.
     *
     * Messages already covered by the stored summary are skipped; the rest are
     * emitted oldest-first with strict user/model alternation.
     */
    public function buildContents(Chat $chat): array
    {
        $query = $chat->messages()->orderBy('created_at', 'desc')->orderBy('id', 'desc');

        if ($chat->summary_upto_message_id) {
            $query->where('id', '>', $chat->summary_upto_message_id);
        }

        $messages = $query->limit(self::VERBATIM_MESSAGES * 3)->get();

        // Walk newest -> oldest keeping strict alternation, then flip to chronological.
        $ordered = [];
        $expectedRole = 'user';
        foreach ($messages as $message) {
            $role = $message->role === 'ai' ? 'model' : 'user';
            if ($role !== $expectedRole) {
                continue;
            }

            array_unshift($ordered, $message);
            $expectedRole = $expectedRole === 'user' ? 'model' : 'user';

            if (count($ordered) >= self::VERBATIM_MESSAGES) {
                break;
            }
        }

        // Gemini rejects a transcript that opens on a model turn, which happens
        // whenever the kept window starts right after an answer.
        while (!empty($ordered) && $ordered[0]->role === 'ai') {
            array_shift($ordered);
        }

        $contents = [];
        foreach ($ordered as $message) {
            $contents[] = [
                'role' => $message->role === 'ai' ? 'model' : 'user',
                'parts' => [['text' => mb_substr($this->plainText($message), 0, 1800, 'UTF-8')]],
            ];
        }

        return $contents;
    }

    /**
     * Summary block appended to the system instruction, or '' when there is none.
     */
    public function summaryBlock(Chat $chat): string
    {
        $summary = trim((string) $chat->context_summary);
        if ($summary === '') {
            return '';
        }

        return "=== 🧠 ملخص ما سبق في هذه المحادثة ===\n"
            . "هذا ملخص للرسائل الأقدم في نفس المحادثة (الرسائل الأخيرة معروضة لك كاملة أدناه). "
            . "اعتبره ذاكرتك عن الطالب وابنِ عليه، ولا تسأله عن شيء أخبرك به سابقاً:\n"
            . $summary . "\n\n";
    }

    /**
     * True when enough turns accumulated past the stored summary to refresh it.
     */
    public function needsSummary(Chat $chat): bool
    {
        $query = $chat->messages();
        if ($chat->summary_upto_message_id) {
            $query->where('id', '>', $chat->summary_upto_message_id);
        }

        return $query->count() > self::VERBATIM_MESSAGES + self::SUMMARY_THRESHOLD;
    }

    /**
     * Messages that the next summary must absorb: everything past the current
     * summary except the turns still sent verbatim.
     *
     * @return array{0: array<int, array{role: string, text: string}>, 1: int|null}
     *         [transcript, id of the newest message covered]
     */
    public function messagesToSummarize(Chat $chat): array
    {
        $query = $chat->messages()->orderBy('created_at')->orderBy('id');
        if ($chat->summary_upto_message_id) {
            $query->where('id', '>', $chat->summary_upto_message_id);
        }

        $all = $query->get();
        $cutoff = $all->count() - self::VERBATIM_MESSAGES;
        if ($cutoff <= 0) {
            return [[], null];
        }

        $older = $all->slice(0, $cutoff);
        $transcript = [];
        foreach ($older as $message) {
            $text = trim($this->plainText($message));
            if ($text === '') {
                continue;
            }
            $transcript[] = [
                'role' => $message->role === 'ai' ? 'model' : 'user',
                'text' => mb_substr($text, 0, 900, 'UTF-8'),
            ];
        }

        return [$transcript, $older->last()?->id];
    }

    /**
     * AI rows are stored as the full JSON envelope; only the reply text is memory.
     */
    private function plainText($message): string
    {
        $text = (string) $message->content;

        if ($message->role !== 'ai') {
            return $text;
        }

        $decoded = json_decode($text, true);
        if (json_last_error() === JSON_ERROR_NONE && isset($decoded['reply'])) {
            $text = (string) $decoded['reply'];
        }

        return preg_replace('/```mermaid.*?```/is', '[مخطط الخطة]', $text);
    }
}
