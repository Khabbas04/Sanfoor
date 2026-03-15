<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title inertia>{{ config('app.name', 'Sanfoor') }}</title>

<meta name="description" content="سنفور - المرشد الأكاديمي الذكي لطلاب الجامعات.">
<meta name="keywords" content="Sanfoor, سنفور, المرشد الأكاديمي, AI Academic Advisor, خطة دراسية, University Planner, GPA Calculator">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0f172a">

<link rel="icon" href="/images/sanfoor.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">

<style>
body{
font-family:'Cairo',sans-serif;
}
</style>

@routes
@viteReactRefresh
@vite(['resources/js/app.jsx'])

@inertiaHead

</head>

<body class="antialiased text-slate-900">

@inertia

</body>
</html>
