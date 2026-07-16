<?php

namespace App\Console\Commands;

use App\Models\Message;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Surfaces negative (thumbs-down) AI feedback together with the question that
 * triggered it, so the advisor prompt (config/ai.php) can be improved from real
 * failures instead of guesswork. This is the missing feedback loop: ai_feedbacks
 * was collected but never analysed.
 */
class AiFeedbackReviewCommand extends Command
{
    protected $signature = 'ai:feedback-review
                            {--days=30 : Only include feedback from the last N days}
                            {--limit=25 : Max cases to display}
                            {--all : Include positive feedback too (default: negative only)}';

    protected $description = 'Review AI feedback (negative by default) with the question + reply that produced it';

    public function handle(): int
    {
        if (!DB::getSchemaBuilder()->hasTable('ai_feedbacks')) {
            $this->error('Table ai_feedbacks does not exist. Run migrations first.');
            return self::FAILURE;
        }

        $days = max(1, (int) $this->option('days'));
        $limit = max(1, (int) $this->option('limit'));
        $includeAll = (bool) $this->option('all');

        $query = DB::table('ai_feedbacks')
            ->where('created_at', '>=', now()->subDays($days));

        if (!$includeAll) {
            $query->where('rating', 'down');
        }

        $feedbacks = $query->orderByDesc('created_at')->limit($limit)->get();

        // Summary
        $stats = DB::table('ai_feedbacks')
            ->where('created_at', '>=', now()->subDays($days))
            ->selectRaw("count(case when rating = 'up' then 1 end) as up")
            ->selectRaw("count(case when rating = 'down' then 1 end) as down")
            ->selectRaw('count(*) as total')
            ->first();

        $total = (int) ($stats->total ?? 0);
        $down = (int) ($stats->down ?? 0);
        $satisfaction = $total > 0 ? round((($stats->up ?? 0) / $total) * 100, 1) : 0.0;

        $this->newLine();
        $this->info("📊 AI Feedback — آخر {$days} يوم");
        $this->line("   إجمالي: {$total} | 👍 {$stats->up} | 👎 {$down} | رضا: {$satisfaction}%");
        $this->line('   نسخة الـ prompt الحالية: ' . config('ai.prompt_version', 'غير محددة'));
        $this->newLine();

        if ($feedbacks->isEmpty()) {
            $this->info('لا توجد تقييمات سلبية في هذه الفترة. 🎉');
            return self::SUCCESS;
        }

        $shown = 0;
        foreach ($feedbacks as $fb) {
            $aiMessage = Message::find($fb->message_id);
            if (!$aiMessage) {
                continue;
            }

            $question = Message::where('chat_id', $aiMessage->chat_id)
                ->where('role', 'user')
                ->where('created_at', '<=', $aiMessage->created_at)
                ->orderByDesc('created_at')
                ->value('content');

            $reply = $this->extractReply($aiMessage->content);
            $icon = $fb->rating === 'down' ? '👎' : '👍';
            $shown++;

            $this->line("───────────────────────────────");
            $this->line("<comment>#{$shown} {$icon}  {$fb->created_at}</comment>");
            $this->line('<info>سؤال:</info> ' . $this->truncate((string) $question, 220));
            $this->line('<info>رد سنفور:</info> ' . $this->truncate($reply, 320));
            if (!empty($fb->comment)) {
                $this->line('<info>ملاحظة الطالب:</info> ' . $this->truncate((string) $fb->comment, 220));
            }
        }

        $this->newLine();
        $this->info("عُرض {$shown} حالة. استخدم هذه الأمثلة لتحسين النصوص في config/ai.php ثم ارفع prompt_version.");

        return self::SUCCESS;
    }

    private function extractReply(?string $content): string
    {
        if (!$content) {
            return '(فارغ)';
        }
        $decoded = json_decode($content, true);
        if (is_array($decoded) && isset($decoded['reply'])) {
            return (string) $decoded['reply'];
        }
        return $content;
    }

    private function truncate(string $text, int $len): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text));
        return mb_strlen($text) > $len ? mb_substr($text, 0, $len) . '…' : $text;
    }
}
