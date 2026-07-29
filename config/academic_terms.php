<?php

/*
|--------------------------------------------------------------------------
| Academic terms and registration limits
|--------------------------------------------------------------------------
|
| THE single source of truth for "how many hours may this student register".
|
| These numbers used to be repeated as constants in AcademicRulesEngine, as
| constants in AiAdvisorController, again inside its getRegistrationLimits(), in
| the planner config, in the advisor prompt text and as a literal `18` in
| Advisor.jsx. Six copies of one regulation is six chances to disagree, and they
| did: the summer cap read 9 in some paths and 10 in others.
|
| Change a number here and it applies everywhere — including the prompt the model
| is given and the cap the cart enforces.
|
*/

return [

    /*
    | The three terms of the academic year, in the order they occur. `next` is what
    | makes the roadmap able to say "then the summer term" instead of guessing.
    */
    'terms' => [
        1 => ['label' => 'الفصل الأول', 'short' => 'الأول', 'type' => 'regular', 'next' => 2, 'rolls_year' => false],
        2 => ['label' => 'الفصل الثاني', 'short' => 'الثاني', 'type' => 'regular', 'next' => 3, 'rolls_year' => false],
        // After the summer term the academic year itself advances.
        3 => ['label' => 'الفصل الصيفي', 'short' => 'الصيفي', 'type' => 'summer', 'next' => 1, 'rolls_year' => true],
    ],

    /*
    | Registration caps, in credit hours.
    |
    | `regular` / `summer` are the term ceilings. `probation` applies to a student
    | below the passing average and is compared against the term ceiling — the
    | student gets whichever is lower. `graduating_*` are the documented exceptions
    | for a student inside reach of finishing.
    */
    'limits' => [
        'regular' => (int) env('TERM_MAX_HOURS_REGULAR', 18),
        'summer' => (int) env('TERM_MAX_HOURS_SUMMER', 10),
        'probation' => (int) env('TERM_MAX_HOURS_PROBATION', 12),
        'graduating_regular' => (int) env('TERM_MAX_HOURS_GRADUATING', 21),
        'graduating_summer' => (int) env('TERM_MAX_HOURS_GRADUATING_SUMMER', 12),
    ],

    /*
    | Remaining hours at or below which a student counts as graduating, and so
    | qualifies for the exception above.
    */
    'graduating_threshold' => [
        'regular' => 21,
        'summer' => 12,
    ],

    /*
    | Hours a plan should AIM for, which is not the same as the ceiling: filling a
    | term to its legal maximum is not advice.
    */
    'target_hours' => [
        'regular' => 15,
        'summer' => 9,
    ],
];
