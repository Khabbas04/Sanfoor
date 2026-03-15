<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title inertia>{{ config('app.name', 'Sanfoor') }}</title>

<meta name="title" content="سنفور | Sanfoor - المرشد الأكاديمي الذكي">
<meta name="description" content="Sanfoor المرشد الأكاديمي الذكي الذي يساعد طلاب الجامعات على فهم الخطة الدراسية واختيار المواد واتخاذ قرارات أكاديمية أدق باستخدام الذكاء الاصطناعي.">

<meta name="keywords" content="Sanfoor, سنفور, المرشد الأكاديمي, AI Academic Advisor, خطة دراسية, University Planner, GPA Calculator, Chatbot جامعي">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="author" content="Sanfoor Team">
<meta name="application-name" content="Sanfoor">
<meta name="theme-color" content="#0f172a">

<link rel="canonical" href="{{ url()->current() }}">

<link rel="icon" href="/images/sanfoor.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">

<meta property="og:locale" content="{{ str_replace('_', '-', app()->getLocale()) }}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sanfoor">
<meta property="og:title" content="سنفور | Sanfoor - المرشد الأكاديمي الذكي">
<meta property="og:description" content="منصة أكاديمية ذكية تساعدك على تخطيط المواد، فهم المسار الجامعي، وتحسين الأداء الدراسي.">
<meta property="og:url" content="{{ url()->current() }}">
<meta property="og:image" content="{{ asset('images/sanfoor.png') }}">
<meta property="og:image:alt" content="Sanfoor Academic Advisor">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="سنفور | Sanfoor - المرشد الأكاديمي الذكي">
<meta name="twitter:description" content="ساعد خطتك الدراسية وقراراتك الأكاديمية بذكاء مع سنفور.">
<meta name="twitter:image" content="{{ asset('images/sanfoor.png') }}">

<script type="application/ld+json">
{
	"@context": "https://schema.org",
	"@type": "WebSite",
	"name": "Sanfoor",
	"alternateName": "سنفور",
	"url": "{{ url('/') }}",
	"description": "المرشد الأكاديمي الذكي لطلاب الجامعات.",
	"inLanguage": "ar",
	"publisher": {
		"@type": "Organization",
		"name": "Sanfoor",
		"logo": {
			"@type": "ImageObject",
			"url": "{{ asset('images/sanfoor.png') }}"
		}
	}
}
</script>

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
