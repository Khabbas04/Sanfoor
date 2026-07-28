<?php

return [
    'version' => '2026.08.1',
    'cache_ttl_minutes' => 10,
    'roadmap_semesters' => 3,
    'default_regular_hours' => 15,
    'default_summer_hours' => 9,
    'ai_analysis_enabled' => env('ACADEMIC_PATH_AI_ENABLED', true),

    'goals' => [
        'fastest_graduation' => [
            'label' => 'التخرج بأسرع وقت',
            'target_load' => 'maximum',
            'max_hard_courses' => 4,
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
