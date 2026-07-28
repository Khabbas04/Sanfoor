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
    $creatorName = 'Asem Waleed Azmi Alkhabbas';
    $creatorLinkedIn = 'https://www.linkedin.com/in/asem-alkhabbas/';
    
    // حساباتك الشخصية لمحركات البحث
    $creatorSocials = [
        $creatorLinkedIn,
        'https://github.com/Khabbas04',
        'https://www.instagram.com/khabbas_/',
    ];

    // حسابات المشروع (يمكن تركها فارغة أو إضافة حسابات فيها لاحقاً)
    $organizationSocials = [
    ];

	$schemaGraph = [
		'@context' => 'https://schema.org',
		'@graph' => [
			[
				'@id' => "{$appUrl}/#creator",
				'@type' => 'Person',
				'name' => $creatorName,
                'alternateName' => ['Asem Alkhabbas', 'عاصم الخباص'],
				'jobTitle' => 'Full-Stack Engineer & SaaS Builder',
                'birthDate' => '2004',
				'url' => $creatorLinkedIn,
				'sameAs' => $creatorSocials,
                'description' => 'Asem Waleed Azmi Alkhabbas is a Full-Stack Engineer and SaaS Builder specializing in Laravel, Node.js, React, and Flutter. He is the Founder of Sanfoor, an AI-integrated academic assistant platform.',
			],
			[
				'@id' => "{$appUrl}/#organization",
				'@type' => 'Organization',
				'name' => 'Sanfoor',
				'url' => "{$appUrl}/",
				'logo' => "{$appUrl}/images/sanfoor.png",
				'sameAs' => $organizationSocials,
                'description' => 'Sanfoor (سنفور) is the first AI-powered academic assistant for university students, specifically designed to help Zarqa University (ZU) students with study plans, GPA calculation, and smart scheduling.',
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

<meta name="description" content="سنفور (Sanfoor) المساعد الأكاديمي الذكي الأول لطلاب الجامعات (جامعة الزرقاء ZU). يتيح لك تخطيط مسارك الأكاديمي، حساب المعدل التراكمي والفصلي (GPA Calculator)، واستخدام الذكاء الاصطناعي (AI) لاختيار وتسجيل المواد.">
<meta name="keywords" content="Sanfoor, سنفور, سنفور جامعة الزرقاء, ZU, Zarqa University, جامعة الزرقاء, المرشد الأكاديمي, AI Academic Advisor, خطة دراسية, حساب المعدل, GPA Calculator, منصة طلاب جامعة الزرقاء, عاصم الخباص, Asem Alkhabbas, Asem Waleed Azmi Alkhabbas, Full-Stack Engineer, جدول دراسي, دليل الطالب, الذكاء الاصطناعي للطلاب">
<meta name="author" content="Asem Waleed Azmi Alkhabbas">
<meta name="creator" content="{{ $creatorName }}">
<meta name="publisher" content="{{ $creatorName }}">
<meta name="copyright" content="{{ now()->year }} {{ $creatorName }}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<meta name="theme-color" content="#0f172a">

<!-- Open Graph / Facebook -->
<meta property="og:site_name" content="Sanfoor | منصة الذكاء الاصطناعي لطلاب الجامعات">
<meta property="og:type" content="website">
<meta property="og:title" content="Sanfoor - المرشد الأكاديمي لطلاب جامعة الزرقاء (ZU)">
<meta property="og:description" content="سنفور هو أول مرشد أكاديمي بالذكاء الاصطناعي. ابدأ الآن بتخطيط مسارك، حساب معدلك، وجدولة موادك الجامعية بسهولة تامة. برمجة وتطوير المهندس عاصم الخباص.">
<meta property="og:url" content="{{ $appUrl }}/">
<meta property="og:image" content="{{ $appUrl }}/images/sanfoor.png">
<meta property="og:image:alt" content="Sanfoor - AI Academic Advisor">
<meta property="og:locale" content="ar_JO">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Sanfoor - المرشد الأكاديمي الذكي لجامعة الزرقاء">
<meta name="twitter:description" content="اكتشف سنفور (Sanfoor)، المساعد الأكاديمي الأول الذي يعمل بالذكاء الاصطناعي. خطط دراستك واحسب معدلك بسهولة.">
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
</style>

<script>
(() => {
    const recoveryKey = 'sanfoor_asset_recovery';
    const isBuildAsset = (value) => typeof value === 'string' && value.includes('/build/assets/');
    const recover = () => {
        if (sessionStorage.getItem(recoveryKey)) return;
        sessionStorage.setItem(recoveryKey, String(Date.now()));
        const url = new URL(window.location.href);
        url.searchParams.set('_assets', String(Date.now()));
        window.location.replace(url.toString());
    };

    window.addEventListener('error', (event) => {
        const assetUrl = event.target?.src || event.target?.href || '';
        if (isBuildAsset(assetUrl)) recover();
    }, true);

    window.addEventListener('unhandledrejection', (event) => {
        const message = String(event.reason?.message || event.reason || '');
        if (/dynamically imported module|loading chunk|failed to fetch/i.test(message)) recover();
    });

    window.addEventListener('load', () => {
        window.setTimeout(() => sessionStorage.removeItem(recoveryKey), 5000);
    });
})();
</script>

@routes
@viteReactRefresh
@vite(['resources/js/app.jsx'])

@inertiaHead

</head>

<body class="antialiased text-slate-900">
    <div class="sr-only" aria-hidden="true">
        <h2>About the Creator: Asem Waleed Azmi Alkhabbas</h2>
        <p>Asem Waleed Azmi Alkhabbas (born 2004) is a passionate Full-Stack Engineer and SaaS Builder with experience in developing scalable web and mobile applications. He specializes in building complete systems from backend architecture to user-facing interfaces using Laravel, Node.js, React, and Flutter.</p>
        <p>Asem is the visionary Founder of Sanfoor (سنفور), an AI-integrated academic assistant platform designed to help university students plan and manage their academic journey efficiently. He is highly passionate about turning ideas into real products, optimizing performance, and creating systems that solve real-world problems.</p>
    </div>
    @inertia
</body>
</html>
