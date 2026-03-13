<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title inertia>Sanfoor | المرشد الأكاديمي الذكي</title>

<meta name="description" content="Sanfoor المرشد الأكاديمي الذكي الذي يساعد طلاب الجامعات على فهم الخطة الدراسية واختيار المواد باستخدام الذكاء الاصطناعي.">

<meta name="keywords" content="Sanfoor, المرشد الأكاديمي, AI Academic Advisor, خطة دراسية, University Planner">

<link rel="icon" href="/images/sanfoor.png">

<link rel="preconnect" href="https://fonts.googleapis.com">

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
