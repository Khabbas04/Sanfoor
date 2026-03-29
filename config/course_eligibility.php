<?php

return [
    // Course unlocking rules based on completed credit hours.
    'hour_rules' => [
        [
            'minimum_passed_hours' => 90,
            'keywords' => [
                'مشروع التخرج',
                'project',
                'graduation project',
                'تدريب',
                'التدريب العملي',
                'training',
                'internship',
            ],
            'code_prefixes' => [
                'GRAD',
                'PROJ',
                'TRAIN',
                'TRN',
                'INT',
            ],
            'codes' => [
                // Add exact course codes here when needed, e.g. 'CS499'.
            ],
        ],
    ],
];
