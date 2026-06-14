<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="{{ csrf_token() }}">

<script>
(() => {
    const savedLang = localStorage.getItem('lang');
    const lang = savedLang === 'en' ? 'en' : 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
})();
</script>

<title inertia>{{ config('app.name', 'Sanfoor') }}</title>

@php
    $appUrl = rtrim(config('app.url', url('/')), '/');
    $creatorName = 'Asem Alkhabbas';
    $creatorLinkedIn = 'https://www.linkedin.com/in/asem-alkhabbas-667471371/';
	$schemaGraph = [
		'@context' => 'https://schema.org',
		'@graph' => [
			[
				'@id' => "{$appUrl}/#creator",
				'@type' => 'Person',
				'name' => $creatorName,
				'jobTitle' => 'Founder & Developer',
				'url' => $creatorLinkedIn,
				'sameAs' => [$creatorLinkedIn],
			],
			[
				'@id' => "{$appUrl}/#organization",
				'@type' => 'Organization',
				'name' => 'Sanfoor',
				'url' => "{$appUrl}/",
				'logo' => "{$appUrl}/images/sanfoor.png",
				'creator' => [
					'@id' => "{$appUrl}/#creator",
				],
				'founder' => [
					'@id' => "{$appUrl}/#creator",
				],
				'copyrightHolder' => [
					'@id' => "{$appUrl}/#creator",
				],
			],
			[
				'@id' => "{$appUrl}/#website",
				'@type' => 'WebSite',
				'name' => 'Sanfoor',
				'url' => "{$appUrl}/",
				'publisher' => [
					'@id' => "{$appUrl}/#organization",
				],
				'creator' => [
					'@id' => "{$appUrl}/#creator",
				],
			],
			[
				'@id' => "{$appUrl}/#webpage",
				'@type' => 'WebPage',
				'url' => "{$appUrl}/",
				'name' => 'Sanfoor - المرشد الأكاديمي الذكي',
				'isPartOf' => [
					'@id' => "{$appUrl}/#website",
				],
				'author' => [
					'@id' => "{$appUrl}/#creator",
				],
				'copyrightHolder' => [
					'@id' => "{$appUrl}/#creator",
				],
			],
		],
	];
@endphp

<meta name="description" content="سنفور (Sanfoor) - المرشد الأكاديمي الذكي الأول لطلاب جامعة الزرقاء (ZU). خطط مسارك الجامعي، احسب معدلك التراكمي، واكتشف أفضل المواد للتسجيل بسهولة.">
<meta name="keywords" content="Sanfoor, سنفور, جامعة الزرقاء, ZU, Zarqa University, المرشد الأكاديمي, AI Academic Advisor, خطة دراسية, حساب المعدل, GPA Calculator, منصة طلاب جامعة الزرقاء">
<meta name="author" content="Asem Alkhabbas">
<meta name="creator" content="{{ $creatorName }}">
<meta name="publisher" content="{{ $creatorName }}">
<meta name="copyright" content="{{ now()->year }} {{ $creatorName }}">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#0f172a">
<meta property="og:site_name" content="Sanfoor | جامعة الزرقاء">
<meta property="og:type" content="website">
<meta property="og:title" content="Sanfoor - المرشد الأكاديمي لطلاب جامعة الزرقاء">
<meta property="og:description" content="سنفور (Sanfoor) - منصتك الذكية لطلاب جامعة الزرقاء (ZU). خطط مسارك الأكاديمي، احسب معدلك، واستخدم الذكاء الاصطناعي لاختيار موادك.">
<meta property="og:url" content="{{ $appUrl }}/">
<meta property="og:image" content="{{ $appUrl }}/images/sanfoor.png">
<meta property="og:locale" content="ar_JO">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{{ $appUrl }}/images/sanfoor.png">
<link rel="author" href="{{ $creatorLinkedIn }}">

<script type="application/ld+json">
{!! json_encode($schemaGraph, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) !!}
</script>

<link rel="icon" href="/images/sanfoor.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">

<style>
body{
font-family:'Cairo',sans-serif;
}

/* Initial Loader Styles */
#initial-loader {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #0f172a; /* Match theme background */
    z-index: 999999;
    align-items: center;
    justify-content: center;
    flex-direction: column;
}
/* Show the loader only if #app has no child elements (before React hydration) */
#app:empty ~ #initial-loader {
    display: flex;
}
.loader-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-top: 1rem;
}
@keyframes spin {
    to { transform: rotate(360deg); }
}
.loader-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    animation: pulse-loader 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse-loader {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: .7; transform: scale(0.95); }
}
</style>

@routes
@viteReactRefresh
@vite(['resources/js/app.jsx'])

@inertiaHead

</head>

<body class="antialiased text-slate-900">
    @inertia

    <div id="initial-loader" dir="ltr">
        <img src="/images/sanfoor.png" alt="Sanfoor" class="loader-logo">
        <div class="loader-spinner"></div>
    </div>
</body>
</html>
