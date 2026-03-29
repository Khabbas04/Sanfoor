<?php

return [
    // Keep this list explicit so SEO-critical pages are controlled from one place.
    'pages' => [
        ['path' => '/', 'priority' => '1.00', 'change' => 'daily'],
        ['path' => '/about-us', 'priority' => '0.90', 'change' => 'weekly'],
        ['path' => '/terms-of-use', 'priority' => '0.70', 'change' => 'monthly'],
        ['path' => '/privacy-policy', 'priority' => '0.70', 'change' => 'monthly'],
    ],

    // Optional auth pages.
    'include_auth_pages' => true,

    // Auto-discover extra public GET routes (non-auth, non-admin).
    'include_discoverable_public_routes' => false,

    // Cache settings for sitemap response.
    'cache_key' => 'seo:sitemap:xml:v4',
    'cache_ttl_minutes' => 60,
];
