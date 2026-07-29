<?php

return [
    'version' => '2026.08.1',
    'cache_ttl_minutes' => 10,
    'roadmap_semesters' => 3,
    'default_regular_hours' => 15,
    'default_summer_hours' => 9,
    'ai_analysis_enabled' => env('ACADEMIC_PATH_AI_ENABLED', true),

    /*
    | Semester balance.
    |
    | Ranking alone produces an all-major-courses semester, because major courses
    | unlock the most and score highest — which is exactly the schedule an advisor
    | would refuse: five specialisation courses at once is how a student loses a
    | term. University requirements at this university are delivered online and
    | carry a lighter workload, so at least one is reserved per semester whenever
    | one is actually available.
    */
    /*
    | Semester load.
    |
    | `max_hard_courses` counts courses with difficulty ≥ 4 — and in this database
    | virtually every course still carries the default 3, so that cap never fired and
    | three or four advanced specialisation courses could share one term. The budget
    | below is measured in App\Support\CourseLoad units (one ordinary 3-hour
    | first-year course ≈ 1.0) and is derived from real signals: the actual failure
    | rate from course_user, the course level, its prerequisite depth, its hours and
    | whether it is an online requirement.
    |
    | `min_hours_before_relaxing` stops the cap from producing a 6-hour term for a
    | student whose remaining plan is simply all heavy: below that many hours the
    | budget yields and the term is filled anyway, with the load reported honestly.
    */
    'load' => [
        'demanding_threshold' => 1.5,
        'min_hours_before_relaxing' => 9,
    ],

    'balance' => [
        'university_types' => ['university_req', 'university_elective'],
        'min_university_courses' => (int) env('PLANNER_MIN_UNIVERSITY_COURSES', 1),
        // Never let the balance rule eat a whole light semester.
        'max_university_courses' => 2,
    ],

    'goals' => [
        'fastest_graduation' => [
            'label' => 'التخرج بأسرع وقت',
            'target_load' => 'maximum',
            'max_hard_courses' => 4,
            'max_load' => 5.6,
            'weights' => [
                'direct_unlocks' => 8,
                'path_unlocks' => 5,
                'compulsory' => 24,
                'semester_urgency' => 16,
                'difficulty_safety' => 4,
                'grade_safety' => 3,
            ],
        ],
        'improve_gpa' => [
            'label' => 'رفع المعدل',
            'target_load' => 'moderate',
            'max_hard_courses' => 2,
            'max_load' => 3.4,
            'weights' => [
                'direct_unlocks' => 3,
                'path_unlocks' => 2,
                'compulsory' => 12,
                'semester_urgency' => 7,
                'difficulty_safety' => 18,
                'grade_safety' => 18,
            ],
        ],
        'reduce_pressure' => [
            'label' => 'تقليل الضغط الدراسي',
            'target_load' => 'light',
            'max_hard_courses' => 1,
            'max_load' => 2.8,
            'weights' => [
                'direct_unlocks' => 3,
                'path_unlocks' => 2,
                'compulsory' => 10,
                'semester_urgency' => 5,
                'difficulty_safety' => 24,
                'grade_safety' => 16,
            ],
        ],
        'balanced' => [
            'label' => 'موازنة المعدل وسرعة التخرج',
            'target_load' => 'balanced',
            'max_hard_courses' => 2,
            'max_load' => 4.2,
            'weights' => [
                'direct_unlocks' => 6,
                'path_unlocks' => 4,
                'compulsory' => 18,
                'semester_urgency' => 11,
                'difficulty_safety' => 12,
                'grade_safety' => 10,
            ],
        ],
    ],
];
