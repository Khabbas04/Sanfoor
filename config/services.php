<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'brevo' => [
        'key' => env('BREVO_API_KEY'),
    ],

    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'keys' => env('GEMINI_API_KEYS', ''),
        'model' => env('GEMINI_MODEL'),
    ],

    'azure' => [
        'client_id' => env('MICROSOFT_CLIENT_ID'),
        'client_secret' => env('MICROSOFT_CLIENT_SECRET'),
        'redirect' => env('MICROSOFT_REDIRECT_URI'),
        'tenant' => env('MICROSOFT_TENANT_ID', 'common'),
    ],

    'zu_portal' => [
        'base_url' => env('ZU_PORTAL_BASE_URL', 'https://eservices.zu.edu.jo'),
        'login_path' => env('ZU_PORTAL_LOGIN_PATH', '/StudentPortal2/Login/loginPage'),
        'profile_paths' => array_filter(array_map('trim', explode(',', env(
            'ZU_PORTAL_PROFILE_PATHS',
            '/StudentPortal2/Home/UniversityDegree,/StudentPortal2/Home/HomePage,/StudentPortal2/Student/Profile,/StudentPortal2/StudentPortal/profile,/StudentPortal2/Student/Main/profile'
        )))),
        'courses_paths' => array_filter(array_map('trim', explode(',', env(
            'ZU_PORTAL_COURSES_PATHS',
            '/StudentPortal2/Plans/studentPlan,/StudentPortal2/Student/StudyPlan,/StudentPortal2/Student/Courses,/StudentPortal2/Student/Main/plan'
        )))),
    ],

];
