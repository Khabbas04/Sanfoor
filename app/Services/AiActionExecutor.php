<?php

namespace App\Services;

use App\Engines\ValidationEngine;
use App\Models\Course;
use App\Models\StudentActivityLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Actions the advisor may propose and the student may then confirm.
 *
 * The advisor never executes anything by itself. An action is proposed in the
 * reply, the student presses a button, and only then does this run — against data
 * re-read at that moment, not against whatever was true when the answer was
 * generated. A student who leaves the tab open for an hour, registers elsewhere
 * and then presses "add" must not get a write validated against a stale cart.
 *
 * Order, for every write:
 *   1. authorise (the action runs for the authenticated student, full stop)
 *   2. re-read the student's current academic state
 *   3. ValidationEngine decides
 *   4. delegate to the code that already owns the write
 *   5. audit
 *   6. report back what actually happened
 */
class AiActionExecutor
{
    /**
     * Actions that change data, and therefore require confirmation in the UI.
     * Anything not listed here cannot be executed at all.
     */
    public const WRITE_ACTIONS = [
        'add_courses_to_cart',
        'remove_courses_from_cart',
        'apply_semester_plan',
    ];

    /**
     * Actions that only move the student around the app. They touch nothing, so
     * they need no confirmation — but they are still allow-listed, so a link can
     * only ever point inside Sanfoor.
     */
    public const NAVIGATION_ACTIONS = [
        'open_course_in_tree',
        'open_gpa_goal',
        'open_campus_place',
    ];

    public function __construct(
        private StudentAcademicContextService $context,
        private ValidationEngine $validator,
    ) {}

    public static function all(): array
    {
        return array_merge(self::WRITE_ACTIONS, self::NAVIGATION_ACTIONS);
    }

    public static function isKnown(string $action): bool
    {
        return in_array($action, self::all(), true);
    }

    public static function requiresConfirmation(string $action): bool
    {
        return in_array($action, self::WRITE_ACTIONS, true);
    }

    /**
     * @return array{
     *     ok: bool, action: string, applied: array, skipped: array,
     *     errors: array, warnings: array, refresh_cart: bool, message: string,
     *     validation?: array, target?: array
     * }
     */
    public function execute(User $user, string $action, array $payload = []): array
    {
        if (!self::isKnown($action)) {
            Log::warning('AI action rejected: not allow-listed', ['action' => $action, 'user_id' => $user->id]);

            return $this->result($action, false, message: 'هذا الإجراء غير مسموح به.', errors: [
                ['code' => 'action_not_allowed'],
            ]);
        }

        try {
            return match ($action) {
                'add_courses_to_cart' => $this->changeCart($user, 'add', $payload),
                'apply_semester_plan' => $this->changeCart($user, 'add', $payload, isPlan: true),
                'remove_courses_from_cart' => $this->changeCart($user, 'remove', $payload),
                default => $this->navigate($user, $action, $payload),
            };
        } catch (\Throwable $e) {
            Log::error("AI action «{$action}» failed: " . $e->getMessage(), [
                'user_id' => $user->id,
                'exception' => get_class($e),
                'line' => $e->getLine(),
            ]);

            return $this->result($action, false, message: 'تعذّر تنفيذ الإجراء. لم يتغيّر شيء في تسجيلك.', errors: [
                ['code' => 'action_failed'],
            ]);
        }
    }

    /**
     * The one place a cart write happens on the advisor's behalf.
     *
     * Written with the query builder exactly like TreeController::toggleSingleCart,
     * because UserCart::$fillable is ['user_id'] only — the Eloquent route silently
     * strips course_id and the academic period.
     */
    private function changeCart(User $user, string $direction, array $payload, bool $isPlan = false): array
    {
        $requested = array_values(array_unique(array_map('intval', (array) ($payload['course_ids'] ?? []))));

        if ($requested === []) {
            return $this->result(
                $isPlan ? 'apply_semester_plan' : ($direction === 'add' ? 'add_courses_to_cart' : 'remove_courses_from_cart'),
                false,
                message: 'لم تُحدَّد أي مادة.',
                errors: [['code' => 'no_courses']]
            );
        }

        $action = $isPlan ? 'apply_semester_plan' : ($direction === 'add' ? 'add_courses_to_cart' : 'remove_courses_from_cart');

        // Step 2: re-read. `fresh: true` is the whole point — the decision below
        // must be made against the student's state right now.
        $context = $this->context->for($user, fresh: true);
        $rules = $context['rules'];

        $hoursById = [];
        foreach ($context['available_courses'] as $course) {
            $hoursById[(int) $course['id']] = (int) $course['credit_hours'];
        }

        // Step 3: validate.
        $validation = $this->validator->validateCartAction($direction, $requested, [
            'cart_ids' => array_map('intval', $context['cart']['ids'] ?? []),
            'eligible_ids' => array_keys($hoursById),
            'hours_by_id' => $hoursById,
        ], $rules);

        $accepted = $validation['accepted_ids'] ?? [];
        $skipped = array_values(array_diff($requested, $accepted));

        if ($accepted === []) {
            return $this->result($action, false,
                skipped: $skipped,
                message: $this->explain($direction, [], $skipped, $validation, $rules),
                errors: $validation['errors'],
                warnings: $validation['warnings'],
                validation: $validation,
            );
        }

        // Step 4: write.
        $names = Course::whereIn('id', $accepted)->pluck('name', 'id')->all();

        if ($direction === 'add') {
            $rows = [];
            foreach ($accepted as $courseId) {
                $rows[] = [
                    'user_id' => $user->id,
                    'course_id' => $courseId,
                    'academic_year' => $context['period']['academic_year'],
                    'academic_term' => $context['period']['academic_term'],
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
            DB::table('user_carts')->insertOrIgnore($rows);
        } else {
            DB::table('user_carts')
                ->where('user_id', $user->id)
                ->whereIn('course_id', $accepted)
                ->delete();
        }

        // Step 5: audit. Reuses the same log the tree page writes to, so a student's
        // history reads as one timeline regardless of where the change came from.
        foreach ($accepted as $courseId) {
            StudentActivityLog::create([
                'user_id' => $user->id,
                'course_id' => $courseId,
                'action' => $direction === 'add' ? 'course_cart_added' : 'course_cart_removed',
            ]);
        }

        $this->context->invalidate($user);

        // A plan the student actually applied is worth remembering, so a follow-up
        // does not re-propose what they just registered. No-op with memory off.
        if ($isPlan) {
            try {
                app(AiMemoryService::class)->rememberApprovedPlan(
                    $user,
                    array_map(fn ($id) => ['id' => $id, 'name' => $names[$id] ?? null], $accepted)
                );
            } catch (\Throwable $e) {
                Log::warning('Could not remember the applied plan: ' . $e->getMessage());
            }
        }

        return $this->result($action, true,
            applied: array_values(array_map(fn ($id) => [
                'id' => (int) $id,
                'name' => $names[$id] ?? null,
            ], $accepted)),
            skipped: $skipped,
            message: $this->explain($direction, $accepted, $skipped, $validation, $rules),
            warnings: $validation['warnings'],
            refreshCart: true,
            validation: $validation,
        );
    }

    /**
     * Navigation targets, resolved to an in-app route name and its parameters.
     *
     * The frontend maps these to routes itself, so no URL crosses the wire and the
     * advisor cannot produce a link that leaves the application.
     */
    private function navigate(User $user, string $action, array $payload): array
    {
        $courseId = (int) ($payload['course_id'] ?? 0);

        // Route NAMES that exist in routes/web.php, never URLs: the frontend
        // resolves them with ziggy, so an advisor-produced destination cannot
        // leave the application.
        $target = match ($action) {
            'open_course_in_tree' => $courseId > 0
                ? ['route' => 'tree.index', 'params' => ['course' => $courseId]]
                : null,
            'open_gpa_goal' => ['route' => 'tree.index', 'params' => ['focus' => 'gpa']],
            'open_campus_place' => ($placeId = (int) ($payload['place_id'] ?? 0)) > 0
                ? ['route' => 'campus.directory', 'params' => ['place' => $placeId]]
                : null,
            default => null,
        };

        if ($target === null) {
            return $this->result($action, false, message: 'الوجهة غير صحيحة.', errors: [
                ['code' => 'invalid_target'],
            ]);
        }

        // A course the student cannot see is not a destination either.
        if ($action === 'open_course_in_tree') {
            $context = $this->context->for($user);
            $visible = array_merge(
                array_keys($context['course_names']),
                array_map('intval', $context['profile']['passed_course_ids'] ?? []),
                array_map(fn ($course) => (int) $course['id'], $context['locked_courses'])
            );

            if (!in_array($courseId, $visible, true)) {
                return $this->result($action, false, message: 'هذه المادة ليست ضمن خطتك.', errors: [
                    ['code' => 'course_not_visible'],
                ]);
            }
        }

        return $this->result($action, true, message: '', target: $target);
    }

    /** Plain Arabic for what happened, including what did not. */
    private function explain(string $direction, array $applied, array $skipped, array $validation, array $rules): string
    {
        $verb = $direction === 'add' ? 'أُضيفت' : 'أُزيلت';
        $parts = [];

        if ($applied !== []) {
            $parts[] = count($applied) === 1
                ? "✅ تمّت العملية: {$verb} مادة واحدة."
                : '✅ تمّت العملية: ' . $verb . ' ' . count($applied) . ' مواد.';
        }

        if ($skipped !== []) {
            $codes = array_column($validation['errors'] ?? [], 'code');
            $warningCodes = array_column($validation['warnings'] ?? [], 'code');

            if (in_array('exceeds_hour_limit', $codes, true)) {
                $limit = (int) ($rules['effective_limit'] ?? 18);
                $parts[] = "⚠️ لم تُضَف كل المواد: الحد المسموح لك هذا الفصل {$limit} ساعة.";
            } elseif (in_array('not_eligible', $codes, true)) {
                $parts[] = '⚠️ بعض المواد غير متاحة لك حالياً (متطلّب سابق ناقص أو غير مطروحة).';
            } elseif (in_array('not_in_cart', $codes, true)) {
                $parts[] = 'ℹ️ بعض المواد لم تكن في تسجيلك التجريبي أصلاً.';
            } elseif (in_array('already_in_cart', $warningCodes, true)) {
                $parts[] = 'ℹ️ بعض المواد كانت موجودة مسبقاً في تسجيلك.';
            } else {
                $parts[] = '⚠️ بعض المواد لم تُنفَّذ.';
            }
        }

        return $parts === [] ? 'لم يتغيّر شيء في تسجيلك.' : implode(' ', $parts);
    }

    private function result(
        string $action,
        bool $ok,
        array $applied = [],
        array $skipped = [],
        string $message = '',
        array $errors = [],
        array $warnings = [],
        bool $refreshCart = false,
        ?array $validation = null,
        ?array $target = null,
    ): array {
        $result = [
            'ok' => $ok,
            'action' => $action,
            'applied' => $applied,
            'skipped' => $skipped,
            'errors' => $errors,
            'warnings' => $warnings,
            'refresh_cart' => $refreshCart,
            'message' => $message,
        ];

        if ($validation !== null) {
            $result['validation'] = $validation;
        }
        if ($target !== null) {
            $result['target'] = $target;
        }

        return $result;
    }
}
