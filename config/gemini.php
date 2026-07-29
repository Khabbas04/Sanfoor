<?php

/*
|--------------------------------------------------------------------------
| Gemini infrastructure: quotas and usage accounting
|--------------------------------------------------------------------------
|
| Quotas are per API KEY, because that is how Google enforces them. The
| account-wide figure the monitor shows is derived — per-key limit × number of
| configured keys — so adding a key raises the ceiling automatically instead of
| leaving a hardcoded total to drift out of date.
|
| Adjust `models` to match the tier the project's keys are actually on. Anything
| not listed here still gets logged and monitored, using `defaults`.
|
*/

return [

    // Writing a row per API call. Off means the dashboard shows only live cache
    // counters and no history.
    'usage_logging' => (bool) env('GEMINI_USAGE_LOGGING', true),

    // Rows older than this are pruned by `gemini:prune-usage`. A year of history
    // at a few thousand calls a day stays small; keep it bounded anyway.
    'usage_retention_days' => (int) env('GEMINI_USAGE_RETENTION_DAYS', 120),

    /*
    | Per-key limits. rpm = requests/minute, tpm = tokens/minute,
    | rpd = requests/day. `label` is what the dashboard shows.
    */
    'models' => [
        'gemini-3.5-flash-lite' => [
            'label' => 'Gemini 3.5 Flash Lite',
            'kind' => 'generative',
            'rpm' => 15,
            'tpm' => 250_000,
            'rpd' => 500,
        ],
        'gemini-2.5-flash-lite' => [
            'label' => 'Gemini 2.5 Flash Lite',
            'kind' => 'generative',
            'rpm' => 15,
            'tpm' => 250_000,
            'rpd' => 500,
        ],
        'gemini-2.5-flash' => [
            'label' => 'Gemini 2.5 Flash',
            'kind' => 'generative',
            'rpm' => 10,
            'tpm' => 250_000,
            'rpd' => 250,
        ],
        'gemini-embedding-2' => [
            'label' => 'Gemini Embedding 2',
            'kind' => 'embedding',
            'rpm' => 100,
            'tpm' => 30_000,
            'rpd' => 1_000,
        ],
    ],

    // Used for any model that appears in the logs but is not configured above,
    // so a model switch never leaves the dashboard blank.
    'defaults' => [
        'label' => null,      // falls back to the raw model id
        'kind' => 'generative',
        'rpm' => 15,
        'tpm' => 250_000,
        'rpd' => 500,
    ],

    /*
    | Thresholds shared by the progress bars and the health score, so a bar that
    | turns orange and a health score that drops are describing the same event.
    */
    'thresholds' => [
        'warning' => 60,   // %
        'high' => 85,
        'critical' => 95,
    ],

    // Weights of the health score (must sum to 100).
    'health_weights' => [
        'errors' => 35,
        'quota' => 30,
        'latency' => 20,
        'availability' => 15,
    ],

    // A generative reply slower than this is treated as degraded latency.
    'latency_budget_ms' => (int) env('GEMINI_LATENCY_BUDGET_MS', 6000),
];
