<?php

namespace App\AiTools;

use App\Models\User;

/**
 * One capability the advisor can invoke on the student's behalf.
 *
 * A tool NEVER contains business logic. It resolves arguments, calls the service
 * that already owns the rule (AcademicRulesEngine, ValidationEngine,
 * DeterministicWidgetEngine, the cart, the planner…) and returns the answer in a
 * uniform envelope. If a rule needs changing, it changes in that service and
 * every caller — advisor, tree, planner — changes with it.
 */
interface AiTool
{
    /** Stable snake_case identifier; also the allow-list key in config/ai.php. */
    public function name(): string;

    /** One line, in Arabic, describing when this tool is the right one. */
    public function description(): string;

    /** Argument schema, in the OpenAPI subset Gemini accepts for declarations. */
    public function parameters(): array;

    /**
     * Run for this student.
     *
     * Reads only data belonging to $user; ids are resolved against what that
     * student may see, so a tool call can never reach another student's record.
     *
     * @return array{ok: bool, data: array, errors: array, sources: array, warnings?: array}
     */
    public function run(User $user, array $arguments): array;
}
