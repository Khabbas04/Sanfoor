<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">

        <meta name="theme-color" content="#4f46e5">

        <link rel="icon" type="image/png" href="/images/sanfoor.png">
        <link rel="apple-touch-icon" href="/images/sanfoor.png">

        <meta name="description" content="سنفور - المساعد الأكاديمي الذكي لطلاب الجامعات. خطط لجدولك، احسب معدلك، وتخرج بامتياز باستخدام الذكاء الاصطناعي.">
        <meta property="og:title" content="سنفور - المساعد الأكاديمي الذكي | Kulliya Campus">
        <meta property="og:description" content="خطط لمسارك الأكاديمي بذكاء، تجنب التعارضات، وتوقع معدلك بدقة.">
        <meta property="og:image" content="/images/sanfoor.png">
        <meta property="og:type" content="website">
        
        <title inertia>{{ config('app.name', 'سنفور') }} - Kulliya Campus</title>

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead

        <style>
            body {
                font-family: 'Cairo', sans-serif !important;
            }
        </style>
    </head>
    
    <body class="antialiased bg-[#fafcff] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
        @inertia
    </body>
</html>