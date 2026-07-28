<?php

return [
    'version' => '2026.07.1',
    'cache_ttl_minutes' => 15,
    'dismiss_days' => 7,
    'critical_unlocks_threshold' => 3,

    /*
    | Scores are intentionally explicit. Type priority keeps the required
    | academic ordering stable, while the remaining factors rank candidates
    | of the same type in a way that can be explained to the student.
    */
    'weights' => [
        'type_priority' => [
            'critical_course' => 600,
            'risky_cart' => 500,
            'graduation_risk' => 400,
            'gpa_opportunity' => 300,
            'missing_data' => 200,
            'positive_status' => 100,
        ],
        'urgency' => 30,
        'academic_impact' => 25,
        'graduation_delay' => 20,
        'prerequisite_unlock' => 5,
        'risk' => 25,
        'data_confidence' => 20,
    ],
];
