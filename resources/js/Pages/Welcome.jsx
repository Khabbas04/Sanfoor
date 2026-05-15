import { Link, Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/Contexts/LanguageContext';

// Resolve the public site URL for canonical and social metadata.
const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');
const creatorName = 'Asem Alkhabbas';
const creatorLinkedIn = 'https://www.linkedin.com/in/asem-alkhabbas-667471371/';

/* ─────────────────────────────────────────────
   Sanfoor – Premium Animated Landing Page v4.0
   By Kollia Team
───────────────────────────────────────────── */

// Reveal sections only after they enter the viewport to keep motion intentional.
function useInView(threshold = 0.15) {
    const ref = useRef(null);
    const [isInView, setIsInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIsInView(true); obs.unobserve(el); } }, { threshold });
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, isInView];
}

// Lightweight wrapper kept for future button motion experiments.
function MagneticButton({ children, className = '', ...props }) {
    return (
        <div
            className="inline-block"
        >
            <div className={className} {...props}>{children}</div>
        </div>
    );
}

// Small SVG helpers used to visualize the study-tree concept in the landing page.
function TreeNode({ x, y, delay, color, size = 52, label }) {
    return (
        <g className="tree-node" style={{ animationDelay: `${delay}s` }}>
            <rect x={x} y={y} width={size} height={size * 0.58} rx="12" fill={color} className="tree-node-rect" style={{ animationDelay: `${delay}s` }} />
            {label && <text x={x + size / 2} y={y + size * 0.35} textAnchor="middle" fill="white" fontSize="8" fontWeight="800" className="select-none">{label}</text>}
        </g>
    );
}

function TreeEdge({ x1, y1, x2, y2, delay, dashed = false }) {
    return (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dashed ? "5,5" : "none"} className="tree-edge" style={{ animationDelay: `${delay}s` }} />
    );
}

export default function Welcome({ auth }) {
    const heroRef = useRef(null);
    const { lang } = useLanguage();

    // Each observer controls the reveal timing of a different landing section.
    const [featRef, featIn] = useInView();
    const [previewRef, previewIn] = useInView();
    const [aiRef, aiIn] = useInView(0.3);
    const [howRef, howIn] = useInView();
    const [ctaRef, ctaIn] = useInView();

    return (
        <MainLayout>
            <Head>
                <title>سنفور | Sanfoor - المرشد الأكاديمي الذكي</title>
                <meta name="description" content="منصة سنفور تساعد طلاب الجامعات على تخطيط المسار الأكاديمي، إدارة الخطة الدراسية، واختيار المواد بذكاء مدعوم بالذكاء الاصطناعي." />
                <meta name="keywords" content="سنفور, Sanfoor, المرشد الأكاديمي, AI Academic Advisor, خطة دراسية, اختيار المواد, GPA" />
                <meta name="author" content={creatorName} />
                <meta name="creator" content={creatorName} />
                <meta name="publisher" content={creatorName} />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/`} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="سنفور | Sanfoor - المرشد الأكاديمي الذكي" />
                <meta property="og:description" content="خطط مسارك الجامعي بذكاء، وتابع تقدمك الدراسي من مكان واحد." />
                <meta property="og:url" content={`${siteUrl}/`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
                <meta property="article:author" content={creatorName} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="سنفور | Sanfoor - المرشد الأكاديمي الذكي" />
                <meta name="twitter:description" content="دليلك الذكي لاختيار المواد وفهم الخطة الجامعية." />
                <meta name="twitter:image" content={`${siteUrl}/images/sanfoor.png`} />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@type': 'WebPage',
                            name: 'سنفور | Sanfoor - المرشد الأكاديمي الذكي',
                            url: `${siteUrl}/`,
                            author: {
                                '@type': 'Person',
                                name: creatorName,
                                url: creatorLinkedIn,
                            },
                        }),
                    }}
                />
            </Head>

            <style dangerouslySetInnerHTML={{
                __html: `
                /* ── HERO ENTRANCE ── */
                @keyframes heroSlideUp {
                    0% { opacity: 0; transform: translateY(40px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .hero-animate {
                    opacity: 0;
                    animation: heroSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .h-rise-slow {
                    opacity: 0;
                    animation: heroSlideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                /* ── FLOATING LOGO ── */
                @keyframes float-logo {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
                .animate-float { animation: float-logo 4s ease-in-out infinite; }

                /* ── BACKGROUND ORBS ── */
                @keyframes pulse-slow {
                    0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
                    50% { transform: scale(1.1) translate(10px, -10px); opacity: 0.8; }
                }
                .orb-pulse { animation: pulse-slow 8s infinite alternate ease-in-out; }

                /* ── GRADIENT TEXT ── */
                .txt-grad {
                    background: linear-gradient(135deg, #a5b4fc 0%, #67e8f9 50%, #6ee7b7 100%);
                    background-size: 200% 200%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: grad-flow 5s ease infinite;
                }
                .txt-grad-dark {
                    background: linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #06b6d4 100%);
                    background-size: 200% 200%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: grad-flow 5s ease infinite;
                }
                @keyframes grad-flow {
                    0%   { background-position: 0% 50%; }
                    50%  { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                /* ── BUTTON SHIMMER ── */
                .btn-shimmer { position: relative; overflow: hidden; }
                .btn-shimmer::after {
                    content: '';
                    position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
                    background: linear-gradient(to right, transparent, rgba(255,255,255,0.18) 50%, transparent 75%);
                    transform: skewX(-20deg);
                    animation: shimmer 3s infinite;
                }
                @keyframes shimmer { 100% { left: 200%; } }

                /* ── CARD LIFT ── */
                .card-lift { transition: all 0.55s cubic-bezier(0.16, 1, 0.3, 1); }
                .card-lift:hover {
                    transform: translateY(-14px) scale(1.015);
                    box-shadow: 0 36px 80px -20px rgba(79,70,229,0.18), 0 0 0 1px rgba(79,70,229,0.06);
                }

                .route-card { transition: all 0.55s cubic-bezier(0.16, 1, 0.3, 1); }
                .route-card:hover {
                    transform: translateY(-10px);
                    box-shadow: 0 30px 60px -24px rgba(30, 41, 59, 0.35);
                }
                .route-card:hover .route-icon {
                    transform: translateY(-4px) scale(1.08) rotate(-4deg);
                }
                .route-icon {
                    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                }

                /* ── NOISE & DOT GRID ── */
                .noise { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"); }
                .dot-grid { background-image: radial-gradient(circle, rgba(99,102,241,0.07) 1px, transparent 1px); background-size: 28px 28px; }

                /* ── SVG TREE ANIMATIONS ── */
                .tree-node-rect { opacity: 0; animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                @keyframes popIn { 0% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
                .tree-edge { stroke-dasharray: 100; stroke-dashoffset: 100; animation: drawLine 1s ease forwards; }
                @keyframes drawLine { to { stroke-dashoffset: 0; } }

                /* ── AI CHAT ANIMATIONS ── */
                @keyframes chat-pop {
                    0% { opacity: 0; transform: translateY(15px) scale(0.95); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                .chat-msg-1 { opacity: 0; animation: chat-pop 0.6s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: 0.5s; }
                .chat-msg-2 { opacity: 0; animation: chat-pop 0.6s cubic-bezier(0.16,1,0.3,1) forwards; animation-delay: 1.5s; }
                
                @keyframes typing { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
                .typing-dot { animation: typing 1.4s infinite ease-in-out both; }
                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }

                /* ── MISC ── */
                @keyframes ping-large { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }
                .animate-ping-large { animation: ping-large 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
                @keyframes rotate-border { to { transform: rotate(360deg); } }
                @keyframes bounce-s { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

                /* 🔥 الانحناء الناعم الجديد بدل الـ Polygon 🔥 */
                .hero-curve { 
                    border-bottom-left-radius: 50% 80px; 
                    border-bottom-right-radius: 50% 80px; 
                }

                @media (max-width: 768px), (prefers-reduced-motion: reduce) {
                    html:focus-within { scroll-behavior: auto; }
                    .hero-animate,
                    .h-rise-slow,
                    .chat-msg-1,
                    .chat-msg-2,
                    .tree-node-rect,
                    .tree-edge,
                    .animate-float,
                    .animate-ping-large,
                    .typing-dot {
                        animation: none !important;
                        opacity: 1 !important;
                        transform: none !important;
                    }

                    .btn-shimmer::after {
                        animation: none !important;
                    }

                    .card-lift,
                    .route-card,
                    .route-icon {
                        transition-duration: 0.01ms !important;
                    }
                }
            ` }} />

            <div className="bg-[#fafbff] text-slate-800 overflow-x-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

                {/* ════════════════════════════════════
                    1. HERO SECTION (Video & Curve)
                ════════════════════════════════════ */}
                <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-10 pb-28 hero-curve bg-transparent z-10 shadow-none">

                    {/* Static Image Background */}
                    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden rounded-b-[inherit]">
                        {/* Background image (subtle, blurred, low-opacity for performance & legibility) */}
                        <div
                            className="absolute inset-0 bg-center bg-cover opacity-100 transform scale-105"
                            style={{ backgroundImage: "url('/images/background.png')" }}
                        />

                        {/* Soft gradient overlay to improve contrast and give a professional look */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 rounded-b-[inherit]" />

                        {/* Very subtle highlight layer */}
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_40%)] rounded-b-[inherit] pointer-events-none" />
                    </div>

                    {/* Decorative Orbs */}
                    <div className="absolute hidden md:block w-[260px] h-[260px] bg-indigo-400/15 blur-[90px] top-[-5%] right-[2%] pointer-events-none z-0" />
                    <div className="absolute hidden md:block w-[220px] h-[220px] bg-cyan-300/12 blur-[90px] bottom-[2%] left-[2%] pointer-events-none z-0" />

                    {/* Content */}
                    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center w-full mt-8">

                        {/* Beta Badge */}
                        <div className="hero-animate mb-10" style={{ animationDelay: '0.1s' }}>
                            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-bold shadow-lg shadow-black/20 select-none">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                                </span>
                                <span className="font-i tracking-wide">النظام الذكي الأول في الجامعات</span>
                            </div>

                        </div>

                        {/* 🔥 Floating Animated Logo (تم تكبيره بشكل ضخم) 🔥 */}
                        <div className="hero-animate relative inline-flex justify-center items-center mb-10 mt-2" style={{ animationDelay: '0.3s' }}>
                            <div className="absolute inset-0 bg-indigo-400/12 rounded-full blur-2xl"></div>
                            <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 animate-float">
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]" />
                            </div>
                        </div>

                        {/* Heading */}
                        <h1 className="hero-animate mb-4" style={{ animationDelay: '0.65s' }}>
                            <span className="block text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[1.1] tracking-tight text-white drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]">
                                دليلك الذكي نحو
                            </span>
                        </h1>
                        <h1 className="hero-animate mb-8" style={{ animationDelay: '0.85s' }}>
                            <span className="block text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-black leading-[1.1] tracking-tight text-cyan-200 drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]">
                                التفوق الأكاديمي.
                            </span>
                        </h1>

                        {/* Sub */}
                        <div className="h-rise-slow" style={{ animationDelay: '1.1s' }}>
                            <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl text-white mb-7 font-semibold leading-relaxed px-4 drop-shadow-[0_4px_14px_rgba(0,0,0,0.75)]">
                                <strong className="text-white">سنفور</strong> ليس مجرد موقع، إنه مستشارك الشخصي. يرسم لك خريطة تخصصك، يفتح لك المواد المتاحة، ويخطط فصلك القادم بدقة مع <span className="text-cyan-200">AI Sanfoor</span>.
                            </p>
                            <a
                                href={creatorLinkedIn}
                                target="_blank"
                                rel="noopener noreferrer"
                                dir="ltr"
                                className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-[11px] sm:text-xs font-black tracking-[0.12em] text-white/80 backdrop-blur-md transition-all duration-300 hover:border-cyan-300/40 hover:bg-white/15 hover:text-cyan-100"
                            >
                                <span className="text-white/55">CREATED BY</span>
                                <span className="h-1 w-1 rounded-full bg-cyan-300"></span>
                                <span className="text-cyan-200">{creatorName}</span>
                            </a>
                        </div>

                        {/* CTA Buttons */}
                        <div className="h-rise-slow flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-5" style={{ animationDelay: '1.35s' }}>
                            {auth.user ? (
                                <MagneticButton>
                                    <Link href={route('tree.index')} className="btn-shimmer flex items-center justify-center gap-3 px-10 py-[1.15rem] sm:py-5 bg-gradient-to-l from-indigo-500 to-indigo-600 text-white text-base sm:text-lg font-extrabold rounded-2xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-xl shadow-indigo-600/30 active:scale-[0.96] w-full sm:w-auto">
                                        <span>افتح خطتي الدراسية</span>
                                        <span className="text-xl group-hover:-translate-x-1.5 transition-transform duration-300">←</span>
                                    </Link>
                                </MagneticButton>
                            ) : (
                                <>
                                    <MagneticButton>
                                        <Link href={route('login')} className="btn-shimmer flex items-center justify-center gap-3 px-10 py-[1.15rem] sm:py-5 bg-white text-slate-900 text-base sm:text-lg font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl shadow-black/40 active:scale-[0.96] w-full sm:w-auto">
                                            <span>ابدأ الآن</span>
                                            <span className="text-xl group-hover:-translate-x-1.5 transition-transform duration-300">←</span>
                                        </Link>
                                    </MagneticButton>
                                    <MagneticButton>
                                        <a href="#features" className="flex items-center justify-center gap-2 px-8 py-[1.15rem] sm:py-5 bg-white/10 backdrop-blur-md text-white text-base sm:text-lg font-bold rounded-2xl hover:bg-white/20 border border-white/20 transition-all w-full sm:w-auto">
                                            <span>شوف كيف بيشتغل</span>
                                            <svg className="w-5 h-5" style={{ animation: 'bounce-s 2s ease-in-out infinite' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                        </a>
                                    </MagneticButton>
                                </>
                            )}
                        </div>
                    </div>
                </section>


                {/* ════════════════════════════════════
                    2. FEATURES
                ════════════════════════════════════ */}
                <section id="features" ref={featRef} className="py-20 sm:py-32 bg-white relative overflow-hidden -mt-10 pt-32">
                    <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                        <div className={`text-center mb-16 sm:mb-24 transition-all duration-[1.1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${featIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold mb-6 border border-indigo-100">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                <span>ليش سنفور؟</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-[3.5rem] font-black text-slate-900 mb-5 tracking-tight leading-[1.15]">
                                كل اللي تحتاجه <span className="txt-grad-dark">بمكان واحد.</span>
                            </h2>
                            <p className="text-slate-500 font-medium max-w-xl mx-auto text-sm sm:text-lg leading-relaxed">
                                أدوات مصممة عشان تركز على دراستك بدل ما تضيع وقتك بالتخطيط المعقد.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                            {[
                                {
                                    icon: "🌳",
                                    title: 'الشجرة التفاعلية',
                                    desc: 'خريطة مرئية كاملة لموادك، تتحدث تلقائياً لتظهر لك ما تم إنجازه وما فُتح لك للتسجيل بألوان واضحة.',
                                    gradient: 'from-indigo-500 to-blue-600',
                                    accentBg: 'bg-indigo-50',
                                    delay: 0,
                                },
                                {
                                    icon: "🤖",
                                    title: 'التسجيل التجريبي الذكي',
                                    desc: 'ضيف المواد للتسجيل التجريبي وشوف العبء الدراسي، النظام رح ينبهك إذا اخترت مواد بتتعارض مع قوانين الخطة.',
                                    gradient: 'from-cyan-500 to-teal-500',
                                    accentBg: 'bg-cyan-50',
                                    delay: 150,
                                },
                                {
                                    icon: "📈",
                                    title: 'AI Sanfoor',
                                    desc: 'مساعد ذكي يقرأ خطتك، يفهم المتطلبات، ويقترح لك أفضل خيارات التسجيل بشكل واضح وسريع.',
                                    gradient: 'from-emerald-500 to-green-500',
                                    accentBg: 'bg-emerald-50',
                                    delay: 300,
                                },
                            ].map((f, i) => (
                                <div
                                    key={i}
                                    className={`card-lift group p-8 sm:p-10 rounded-[2.5rem] bg-white border border-slate-100 relative overflow-hidden cursor-default transition-all duration-[0.9s] ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-xl ${featIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
                                    style={{ transitionDelay: `${f.delay + 100}ms` }}
                                >
                                    <div className={`absolute -top-16 -left-16 w-48 h-48 ${f.accentBg} rounded-full opacity-0 group-hover:opacity-100 blur-3xl transition-opacity duration-700 pointer-events-none`} />

                                    <div className={`relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 text-3xl`}>
                                        {f.icon}
                                    </div>

                                    <h3 className="relative z-10 text-xl sm:text-2xl font-black text-slate-800 mb-4 leading-snug">{f.title}</h3>
                                    <p className="relative z-10 text-slate-500 font-medium leading-[1.85] text-sm sm:text-[15px]">{f.desc}</p>

                                    <div className={`absolute bottom-0 left-0 right-0 h-[4px] bg-gradient-to-r ${f.gradient} scale-x-0 group-hover:scale-x-100 transition-transform duration-[600ms] origin-right`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ════════════════════════════════════
                    3. TREE PREVIEW (Animated SVG)
                ════════════════════════════════════ */}
                <section ref={previewRef} className="py-20 sm:py-28 relative overflow-hidden bg-slate-900 border-t border-slate-800">
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-5"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>

                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className={`text-center mb-12 sm:mb-16 transition-all duration-[1.1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${previewIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-cyan-300 text-xs font-bold mb-6 border border-white/10 backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                                <span>شكل الخطة الشجرية</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-[3.5rem] font-black text-white mb-5 tracking-tight leading-[1.15]">
                                شوف خطتك كأنك <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-indigo-400">بتلعب لعبة</span>
                            </h2>
                            <p className="text-slate-400 font-medium max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
                                الأخضر منجز، الأزرق متاح، الرمادي مقفل. الخطة الأكاديمية عمرها ما كانت بهالوضوح.
                            </p>
                        </div>

                        <div className={`max-w-3xl mx-auto transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${previewIn ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} style={{ transitionDelay: '200ms' }}>
                            <div className="relative bg-white/5 backdrop-blur-xl border border-slate-700/50 rounded-[2rem] p-6 sm:p-10 overflow-hidden shadow-2xl">
                                <div className="absolute -inset-[1px] rounded-[2rem] overflow-hidden pointer-events-none">
                                    <div className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0%,#6366f140_25%,transparent_50%)]" style={{ animation: 'rotate-border 8s linear infinite' }} />
                                </div>

                                <svg viewBox="0 0 500 280" className="w-full h-auto relative z-10" dir="ltr">
                                    {previewIn && <>
                                        {/* Edges */}
                                        <TreeEdge x1="130" y1="38" x2="70" y2="95" delay={0.8} />
                                        <TreeEdge x1="130" y1="38" x2="190" y2="95" delay={0.9} />
                                        <TreeEdge x1="70" y1="128" x2="40" y2="185" delay={1.2} />
                                        <TreeEdge x1="70" y1="128" x2="130" y2="185" delay={1.3} />
                                        <TreeEdge x1="190" y1="128" x2="190" y2="185" delay={1.3} />
                                        <TreeEdge x1="370" y1="38" x2="310" y2="95" delay={1.0} />
                                        <TreeEdge x1="370" y1="38" x2="430" y2="95" delay={1.1} />
                                        <TreeEdge x1="310" y1="128" x2="310" y2="185" delay={1.4} />
                                        <TreeEdge x1="430" y1="128" x2="370" y2="185" delay={1.4} />
                                        <TreeEdge x1="430" y1="128" x2="460" y2="185" delay={1.5} />

                                        {/* Nodes */}
                                        <TreeNode x="104" y="8" delay={0.4} color="#4f46e5" label="متطلب 1" />
                                        <TreeNode x="344" y="8" delay={0.5} color="#4f46e5" label="متطلب 2" />

                                        <TreeNode x="44" y="95" delay={0.7} color="#10b981" label="منجزة ✓" />
                                        <TreeNode x="164" y="95" delay={0.8} color="#10b981" label="منجزة ✓" />
                                        <TreeNode x="284" y="95" delay={0.9} color="#06b6d4" label="متاحة" />
                                        <TreeNode x="404" y="95" delay={1.0} color="#06b6d4" label="متاحة" />

                                        <TreeNode x="14" y="185" delay={1.2} color="#06b6d4" label="متاحة" />
                                        <TreeNode x="104" y="185" delay={1.25} color="#334155" label="مغلقة 🔒" />
                                        <TreeNode x="164" y="185" delay={1.3} color="#334155" label="مغلقة 🔒" />
                                        <TreeNode x="284" y="185" delay={1.35} color="#334155" label="مغلقة 🔒" />
                                        <TreeNode x="344" y="185" delay={1.4} color="#f59e0b" label="تجريبي 🛒" />
                                        <TreeNode x="434" y="185" delay={1.45} color="#334155" label="مغلقة 🔒" />
                                    </>}
                                </svg>
                            </div>
                        </div>
                    </div>
                </section>


                {/* ════════════════════════════════════
                    5. AI BOT SECTION
                ════════════════════════════════════ */}
                <section ref={aiRef} className="py-24 sm:py-32 bg-slate-50 relative overflow-hidden">
                    <div className="absolute inset-0 dot-grid opacity-50 pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-10 items-center">

                            {/* Text Info */}
                            <div className={`transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${aiIn ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-14'}`}>
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold mb-6 border border-violet-200">
                                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />
                                    <span>ميزة حصرية</span>
                                </div>
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight leading-[1.2]">
                                    محتار شو تنزل؟ <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">اسأل مستشارك الذكي.</span>
                                </h2>
                                <p className="text-slate-500 font-medium text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                                    دربنا نموذج ذكاء اصطناعي خصيصاً ليقرأ خطتك الجامعية، يفهم القوانين، ويقترح عليك أفضل خيارات التسجيل اللي بترفع معدلك وبتقربك من التخرج.
                                </p>
                                <ul className="space-y-4">
                                    {['يقرأ خطتك المنجزة تلقائياً', 'يتجنب أوقات التعارض والضغط', 'يقترح مواد ترفع المعدل'].map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-3 font-bold text-slate-700">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">✓</div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Chat Simulation */}
                            <div className={`relative transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] delay-200 ${aiIn ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-14'}`}>
                                <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/20 to-indigo-500/20 rounded-[2.5rem] blur-3xl transform rotate-6"></div>
                                <div className="relative bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 flex flex-col gap-6" dir="rtl">

                                    {/* Student Message */}
                                    {aiIn && (
                                        <div className="chat-msg-1 self-end bg-indigo-600 text-white p-4 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md">
                                            <p className="text-sm font-bold leading-relaxed">
                                                شو أنزل مواد الفصل الجاي؟ بدي أرفع معدلي عشان هيك بدي مواد خفيفة.
                                            </p>
                                        </div>
                                    )}

                                    {/* AI Message */}
                                    {aiIn && (
                                        <div className="chat-msg-2 self-start bg-slate-50 border border-slate-200 text-slate-700 p-5 rounded-2xl rounded-tl-sm max-w-[90%] shadow-sm relative">
                                            <div className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-xs shadow-md border-2 border-white">
                                                🤖
                                            </div>
                                            <p className="text-sm font-semibold leading-loose">
                                                أهلاً بك! بناءً على خطتك، أنصحك بتنزيل:
                                                <br />
                                                <strong className="text-indigo-600">1. برمجة متقدمة (3س):</strong> ضرورية لأنها تفتح 3 مواد للفصل القادم.
                                                <br />
                                                <strong className="text-emerald-600">2. مهارات حياتية (3س):</strong> متطلب جامعة سهل يساعد برفع المعدل.
                                            </p>
                                        </div>
                                    )}

                                    {/* Typing Indicator */}
                                    {aiIn && (
                                        <div className="self-start bg-slate-100 rounded-full px-4 py-2 flex items-center gap-1.5 opacity-0" style={{ animation: 'chat-pop 0.6s ease forwards', animationDelay: '2.5s' }}>
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></div>
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></div>
                                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full typing-dot"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </section>


                {/* ════════════════════════════════════
                    6. HOW IT WORKS
                ════════════════════════════════════ */}
                <section ref={howRef} className="py-20 sm:py-32 bg-white relative overflow-hidden">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

                        <div className={`text-center mb-16 sm:mb-20 transition-all duration-[1.1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${howIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 text-cyan-700 text-xs font-bold mb-6 border border-cyan-100">
                                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                                <span>كيف بيشتغل؟</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-[3.5rem] font-black text-slate-900 mb-5 tracking-tight">
                                ثلاث خطوات <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-indigo-500">وبتكون جاهز.</span>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14 relative">
                            {/* Dashed connector (desktop) */}
                            <svg className="hidden md:block absolute top-14 left-0 right-0 w-full h-4 pointer-events-none" viewBox="0 0 900 10" preserveAspectRatio="none">
                                {howIn && <>
                                    <line x1="210" y1="5" x2="390" y2="5" stroke="#e2e8f0" strokeWidth="2.5" strokeDasharray="8 6" style={{ animation: 'dash-flow 1.5s linear infinite' }} />
                                    <line x1="510" y1="5" x2="690" y2="5" stroke="#e2e8f0" strokeWidth="2.5" strokeDasharray="8 6" style={{ animation: 'dash-flow 1.5s linear infinite', animationDelay: '0.5s' }} />
                                </>}
                            </svg>

                            {[
                                { step: '01', title: 'اختار تخصصك', desc: 'حدد تخصصك، و سنفور بيجهز لك المواد والمتطلبات تلقائياً بثوانٍ.', gradient: 'from-indigo-500 to-indigo-600', glow: 'shadow-indigo-500/30' },
                                { step: '02', title: 'حدد المواد المنجزة', desc: 'علّم على المواد اللي نجحت فيها. الشجرة بتتحدث فوراً وبتفتحلك المتاح.', gradient: 'from-cyan-500 to-cyan-600', glow: 'shadow-cyan-500/30' },
                                { step: '03', title: 'خطط فصلك بذكاء', desc: 'استخدم التسجيل التجريبي الذكي أو اسأل المرشد الآلي لترتيب جدولك صح.', gradient: 'from-emerald-500 to-emerald-600', glow: 'shadow-emerald-500/30' },
                            ].map((s, i) => (
                                <div
                                    key={i}
                                    className={`relative text-center md:text-right transition-all duration-[1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${howIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
                                    style={{ transitionDelay: `${i * 200 + 100}ms` }}
                                >
                                    <div className={`mx-auto md:mx-0 w-16 h-16 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center text-white text-xl font-black mb-6 shadow-xl ${s.glow} hover:scale-110 hover:rotate-3 transition-all duration-500 cursor-default`}>
                                        {s.step}
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3">{s.title}</h3>
                                    <p className="text-slate-500 font-medium leading-[1.85] text-sm sm:text-[15px]">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>


                {/* ════════════════════════════════════
                    7. BOTTOM CTA
                ════════════════════════════════════ */}
                {!auth.user && (
                    <section ref={ctaRef} className="py-20 sm:py-28 relative overflow-hidden bg-slate-900 border-t border-slate-800">
                        <div className="absolute inset-0 noise opacity-30 pointer-events-none" />
                        <div className="morph-orb absolute w-[400px] h-[400px] bg-indigo-500/10 blur-[80px] top-[-20%] right-[-10%] pointer-events-none" />
                        <div className="morph-orb absolute w-[300px] h-[300px] bg-cyan-400/10 blur-[100px] bottom-[-20%] left-[-8%] pointer-events-none" style={{ animationDelay: '-6s' }} />

                        <div className={`max-w-4xl mx-auto px-4 relative z-10 text-center transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${ctaIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            {/* 🔥 تكبير لوجو الـ CTA ليصبح متناسق مع الحجم الجديد 🔥 */}
                            <div className="inline-flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] bg-white/5 border border-white/10 mb-8 backdrop-blur-md shadow-2xl p-4" style={{ animation: 'bounce-s 3s ease-in-out infinite' }}>
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-5 leading-tight tracking-tight">
                                جاهز تبدأ مشوارك <br className="hidden sm:block" />بأذكى طريقة؟
                            </h2>
                            <p className="text-indigo-200/80 font-medium text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                                انضم للطلاب اللي حولوا خطتهم لنجاح حقيقي. سجّل حسابك وابدأ التخطيط لفصلك القادم.
                            </p>
                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                                <MagneticButton>
                                    <a href={route('auth.microsoft.redirect')} className="shimmer flex items-center justify-center gap-3 px-10 py-[1.15rem] sm:py-5 bg-white text-indigo-700 text-base sm:text-lg font-black rounded-2xl hover:bg-slate-100 transition-all shadow-2xl shadow-black/40 active:scale-[0.96] w-full sm:w-auto">
                                        تسجيل الدخول (Microsoft)
                                    </a>
                                </MagneticButton>
                                <MagneticButton>
                                    <Link href={route('login')} className="flex items-center justify-center gap-2 px-8 py-[1.15rem] sm:py-5 text-white/90 text-base font-bold rounded-2xl border border-white/20 hover:bg-white/10 transition-all w-full sm:w-auto backdrop-blur-sm">
                                        دخول الحسابات الخارجية
                                    </Link>
                                </MagneticButton>
                            </div>
                        </div>
                    </section>
                )}

            </div>
        </MainLayout>
    );
}
