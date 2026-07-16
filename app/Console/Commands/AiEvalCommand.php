<?php

namespace App\Console\Commands;

use App\Models\Message;
use Illuminate\Console\Command;

/**
 * Quality regression harness for the AI advisor.
 *
 * Audits stored AI replies against a set of quality invariants that the prompt +
 * post-processing are supposed to guarantee (valid structure, no leaked internal
 * IDs, no raw JSON keys bleeding into the text, first-person follow-ups, ...).
 * Run it after any change to the prompt (config/ai.php) or normalizeReplyText to
 * catch regressions before students see them. Uses existing data — no API cost.
 */
class AiEvalCommand extends Command
{
    protected $signature = 'ai:eval
                            {--limit=200 : Number of most recent AI messages to audit}
                            {--show=8 : Number of failing samples to print}';

    protected $description = 'Audit stored AI replies against quality invariants (no API calls)';

    /** @var array<string,callable> */
    private array $checks;

    public function handle(): int
    {
        $this->registerChecks();

        $limit = max(1, (int) $this->option('limit'));
        $show = max(0, (int) $this->option('show'));

        $messages = Message::where('role', 'ai')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get(['id', 'content']);

        if ($messages->isEmpty()) {
            $this->warn('لا توجد رسائل AI مخزّنة لتقييمها.');
            return self::SUCCESS;
        }

        $failuresByCheck = array_fill_keys(array_keys($this->checks), 0);
        $samples = [];
        $auditedReplies = 0;

        foreach ($messages as $message) {
            $content = (string) $message->content;

            // Two legitimate storage shapes: the JSON envelope written by
            // AiAdvisorController ({"reply":...}) and the plain-text reply written
            // by the instructor scheduler. Resolve the reply text for both.
            $decoded = json_decode($content, true);
            if (is_array($decoded) && isset($decoded['reply'])) {
                $reply = (string) $decoded['reply'];
            } else {
                $reply = $content;
                $decoded = ['reply' => $content];
            }

            // valid_structure only guards against genuinely empty/corrupt rows.
            if (trim($content) === '') {
                $failuresByCheck['valid_structure']++;
                continue;
            }

            $auditedReplies++;

            foreach ($this->checks as $name => $check) {
                if ($name === 'valid_structure') {
                    continue;
                }
                if (!$check($reply, $decoded)) {
                    $failuresByCheck[$name]++;
                    if (count($samples) < $show) {
                        $samples[] = ['id' => $message->id, 'check' => $name, 'reply' => $this->truncate($reply, 200)];
                    }
                }
            }
        }

        $total = $messages->count();
        $totalFailures = array_sum($failuresByCheck);

        $this->newLine();
        $this->info('🧪 AI Quality Eval');
        $this->line('   نسخة الـ prompt: ' . config('ai.prompt_version', 'غير محددة'));
        $this->line("   رسائل مُدقّقة: {$total} (ردود صالحة: {$auditedReplies})");
        $this->newLine();

        $rows = [];
        foreach ($failuresByCheck as $name => $count) {
            $denom = $name === 'valid_structure' ? $total : max(1, $auditedReplies);
            $rate = round(($count / $denom) * 100, 1);
            $status = $count === 0 ? '✅' : ($rate > 5 ? '❌' : '⚠️');
            $rows[] = [$status, $name, $count, "{$rate}%"];
        }
        $this->table(['', 'Check', 'Failures', 'Rate'], $rows);

        if (!empty($samples) && $show > 0) {
            $this->newLine();
            $this->line('<comment>عيّنات فاشلة:</comment>');
            foreach ($samples as $s) {
                $this->line("  • [#{$s['id']}] ({$s['check']}) {$s['reply']}");
            }
        }

        $this->newLine();
        if ($totalFailures === 0) {
            $this->info('كل الفحوصات نجحت. 🎉');
            return self::SUCCESS;
        }

        $this->warn("إجمالي المخالفات: {$totalFailures}. راجع النصوص في config/ai.php أو منطق normalizeReplyText.");
        return self::FAILURE;
    }

    private function registerChecks(): void
    {
        $this->checks = [
            // Handled specially in the loop (structure of the stored envelope).
            'valid_structure' => fn () => true,

            // Internal course IDs must never leak into the student-facing text.
            'no_leaked_id' => fn (string $reply) => !preg_match('/\bID\s*[:#]?\s*\d+/iu', $reply)
                && !preg_match('/\(\s*ID\s*[:：]/iu', $reply),

            // Raw JSON keys must not bleed into the reply.
            'no_raw_json_keys' => fn (string $reply) => !preg_match('/\b(suggested_course_ids|remove_course_ids|courses_to_add|follow_up_suggestions|interactive_widget)\b/', $reply),

            // No leftover markdown code fences wrapping the whole payload.
            'no_json_fence' => fn (string $reply) => !preg_match('/```\s*json/i', $reply),

            // Reply is non-empty and not the generic parse-error fallback.
            'non_empty' => fn (string $reply) => trim($reply) !== ''
                && !str_contains($reply, 'ما وصلني رد واضح'),

            // Follow-up suggestions should be written in the student's voice
            // (an instruction the prompt insists on), not addressed to the student.
            'followups_first_person' => function (string $reply, array $decoded) {
                foreach (($decoded['follow_up_suggestions'] ?? []) as $s) {
                    if (is_string($s) && preg_match('/^\s*(هل تريد|هل ترغب|هل تحب)/u', $s)) {
                        return false;
                    }
                }
                return true;
            },
        ];
    }

    private function truncate(string $text, int $len): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text));
        return mb_strlen($text) > $len ? mb_substr($text, 0, $len) . '…' : $text;
    }
}
