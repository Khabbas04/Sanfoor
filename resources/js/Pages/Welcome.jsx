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

            <div className="bg-[#f4f6fb] text-slate-900 overflow-x-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

                {/* ════════════════════════════════════
                    1. HERO SECTION (Video & Curve)
                ════════════════════════════════════ */}
                <section ref={heroRef} className="relative overflow-hidden py-20 sm:py-28 bg-[#0b1220]">
                    <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%)]" />
                        <div
                            className="absolute inset-0 bg-center bg-cover opacity-30"
                            style={{ backgroundImage: "url('/images/background.png')" }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1220]/70 via-[#0b1220]/85 to-[#0b1220]" />
                    </div>

                    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                        <div className="text-center lg:text-right">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-cyan-100 border border-white/10 text-xs font-black mb-6">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                منصة تخطيط أكاديمي ذكية
                            </div>
                            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight">
                                رتّب مسارك الجامعي
                                <span className="block text-cyan-200">بوضوح وسرعة.</span>
                            </h1>
                            <p className="mt-5 text-base sm:text-lg text-slate-200 font-semibold leading-relaxed">
                                سنفور يجمع لك الشجرة التفاعلية، التسجيل التجريبي، الشباتر، وبنك الأسئلة في واجهة واحدة تساعدك تركز على الدراسة بدل التخطيط المربك.
                            </p>

                            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                                {auth.user ? (
                                    <Link href={route('tree.index')} className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-cyan-500 text-slate-900 font-black text-base hover:bg-cyan-400 transition-all">
                                        افتح خطتي الدراسية
                                    </Link>
                                ) : (
                                    <>
                                        <Link href={route('login')} className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-white text-slate-900 font-black text-base hover:bg-slate-100 transition-all">
                                            ابدأ الآن
                                        </Link>
                                        <a href="#features" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/20 text-white font-bold text-base hover:bg-white/10 transition-all">
                                            استكشف المزايا
                                        </a>
                                    </>
                                )}
                            </div>
                            <a
                                href={creatorLinkedIn}
                                target="_blank"
                                rel="noopener noreferrer"
                                dir="ltr"
                                className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-black tracking-[0.12em] text-white/70"
                            >
                                <span className="text-white/45">CREATED BY</span>
                                <span className="h-1 w-1 rounded-full bg-cyan-300"></span>
                                <span className="text-cyan-200">{creatorName}</span>
                            </a>
                        </div>

                        <div className="relative">
                            <div className="absolute -inset-4 bg-cyan-500/10 blur-2xl rounded-[2.5rem]" />
                            <div className="relative rounded-[2.5rem] bg-white/5 border border-white/10 p-6 sm:p-8 backdrop-blur-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                                        <img src="/images/sanfoor.png" alt="Sanfoor" className="w-10 h-10 object-contain" />
                                    </div>
                                    <div>
                                        <p className="text-white font-black text-lg">لوحة الأدوات الذكية</p>
                                        <p className="text-slate-300 text-sm">كل ما تحتاجه للدراسة في مكان واحد</p>
                                    </div>
                                </div>

                                <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { label: 'الشباتر', color: 'bg-amber-500/15 text-amber-200' },
                                        { label: 'بنك الأسئلة', color: 'bg-sky-500/15 text-sky-200' },
                                        { label: 'دليل الكليات', color: 'bg-fuchsia-500/15 text-fuchsia-200' },
                                    ].map((item) => (
                                        <div key={item.label} className={`rounded-xl px-3 py-3 text-xs font-black text-center border border-white/10 ${item.color}`}>
                                            {item.label}
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4">
                                    <p className="text-slate-200 text-sm font-semibold">
                                        احصل على توصيات فورية وخطة واضحة للفصل القادم بدون تعقيد.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>



                {/* ════════════════════════════════════
                    2. FEATURES
                ════════════════════════════════════ */}
                <section id="features" ref={featRef} className="py-20 sm:py-28 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_55%)] pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                        <div className={`text-center mb-16 sm:mb-24 transition-all duration-[1.1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${featIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black mb-6 border border-indigo-100">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                <span>خدمات أساسية</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-[3.5rem] font-black text-slate-900 mb-5 tracking-tight leading-[1.15]">
                                منصة مرتبة <span className="text-indigo-600">بأسلوب احترافي.</span>
                            </h2>
                            <p className="text-slate-500 font-semibold max-w-xl mx-auto text-sm sm:text-lg leading-relaxed">
                                كل أداة في مكانها، وكل خطوة واضحة لتنجز خطتك وتستعد للامتحانات بثقة.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                            {[
                                {
                                    icon: "🌳",
                                    title: 'الشجرة التفاعلية',
                                    desc: 'تتبع تقدمك لحظة بلحظة، واعرف المواد المفتوحة وما تبقى عليك بشكل مباشر.',
                                    gradient: 'from-indigo-500 to-blue-600',
                                    accentBg: 'bg-indigo-50',
                                    delay: 0,
                                },
                                {
                                    icon: "🧠",
                                    title: 'المرشد الذكي',
                                    desc: 'اقتراحات دقيقة للمواد المناسبة، مع تنبيهات التداخل والمتطلبات قبل التسجيل.',
                                    gradient: 'from-cyan-500 to-sky-600',
                                    accentBg: 'bg-cyan-50',
                                    delay: 150,
                                },
                                {
                                    icon: "🧪",
                                    title: 'تسجيل تجريبي',
                                    desc: 'جرّب خطتك القادمة بدون التزام، وشوف العبء والنتائج المتوقعة بشكل واضح.',
                                    gradient: 'from-emerald-500 to-teal-500',
                                    accentBg: 'bg-emerald-50',
                                    delay: 300,
                                },
                                {
                                    icon: "📚",
                                    title: 'الشباتر الدراسية',
                                    desc: 'شروحات مختصرة مع أمثلة وتمارين تساعدك تراجع وتثبت المعلومة بسرعة.',
                                    gradient: 'from-amber-500 to-orange-500',
                                    accentBg: 'bg-amber-50',
                                    delay: 450,
                                },
                                {
                                    icon: "📝",
                                    title: 'بنك الأسئلة',
                                    desc: 'أسئلة مختارة ومتدرجة تقيس مستواك وتجهزك للامتحان بثقة أعلى.',
                                    gradient: 'from-sky-500 to-indigo-500',
                                    accentBg: 'bg-sky-50',
                                    delay: 600,
                                },
                                {
                                    icon: "🏫",
                                    title: 'دليل الكليات',
                                    desc: 'موقع المباني والخدمات المهمة حولها بنقرة واحدة وبطريقة سهلة التصفح.',
                                    gradient: 'from-purple-500 to-fuchsia-500',
                                    accentBg: 'bg-purple-50',
                                    delay: 750,
                                },
                            ].map((f, i) => (
                                <div
                                    key={i}
                                    className={`group p-7 sm:p-8 rounded-[2rem] bg-white border border-slate-200/70 relative overflow-hidden transition-all duration-[0.9s] ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_18px_45px_-35px_rgba(15,23,42,0.45)] ${featIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}
                                    style={{ transitionDelay: `${f.delay + 100}ms` }}
                                >
                                    <div className={`absolute -top-16 -left-16 w-48 h-48 ${f.accentBg} rounded-full opacity-60 blur-3xl pointer-events-none`} />

                                    <div className={`relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-6 shadow-md text-2xl`}>
                                        {f.icon}
                                    </div>

                                    <h3 className="relative z-10 text-lg sm:text-xl font-black text-slate-900 mb-3 leading-snug">{f.title}</h3>
                                    <p className="relative z-10 text-slate-500 font-semibold leading-[1.85] text-sm sm:text-[15px]">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ════════════════════════════════════
                    3. TREE PREVIEW (Animated SVG)
                ════════════════════════════════════ */}
                <section ref={previewRef} className="py-20 sm:py-28 relative overflow-hidden bg-[#0f172a] border-t border-slate-800">
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:34px_34px] opacity-[0.06]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>

                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className={`text-center mb-12 sm:mb-16 transition-all duration-[1.1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${previewIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-cyan-200 text-xs font-black mb-6 border border-white/10 backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full" />
                                <span>واجهة واضحة للخطة</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-[3.5rem] font-black text-white mb-5 tracking-tight leading-[1.15]">
                                خريطة مرئية <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-300 to-indigo-300">تختصر عليك الوقت</span>
                            </h2>
                            <p className="text-slate-300 font-semibold max-w-lg mx-auto text-sm sm:text-base leading-relaxed">
                                تابع المواد المنجزة والمفتوحة بنظرة واحدة، بدون جداول معقدة.
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
                <section ref={aiRef} className="py-24 sm:py-32 bg-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_55%)] pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-10 items-center">

                            {/* Text Info */}
                            <div className={`transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${aiIn ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-14'}`}>
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black mb-6 border border-indigo-200">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                    <span>مساعد ذكي</span>
                                </div>
                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight leading-[1.2]">
                                    قرار تسجيلك <br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-600">صار أسهل وأوضح.</span>
                                </h2>
                                <p className="text-slate-500 font-semibold text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
                                    مساعد ذكي يقرأ خطتك ويتأكد من المتطلبات، ويعطيك اقتراحات عملية تناسب أهدافك ومعدلك.
                                </p>
                                <ul className="space-y-4">
                                    {['يتحقق من المتطلبات قبل التسجيل', 'يقلل التعارضات ويوازن العبء', 'يقترح مواد مناسبة لهدفك'].map((item, idx) => (
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
                <section ref={howRef} className="py-20 sm:py-32 bg-slate-50 relative overflow-hidden">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

                        <div className={`text-center mb-16 sm:mb-20 transition-all duration-[1.1s] ease-[cubic-bezier(0.16,1,0.3,1)] ${howIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 text-cyan-700 text-xs font-black mb-6 border border-cyan-100">
                                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                                <span>ابدأ بسرعة</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl md:text-[3.5rem] font-black text-slate-900 mb-5 tracking-tight">
                                خطوات بسيطة <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-indigo-500">وتنطلق.</span>
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
                                { step: '01', title: 'اختر تخصصك', desc: 'اختر تخصصك وسيجهز سنفور المواد والمتطلبات خلال ثوانٍ.', gradient: 'from-indigo-500 to-indigo-600', glow: 'shadow-indigo-500/30' },
                                { step: '02', title: 'حدد المنجز', desc: 'علّم المواد التي أنهيتها لتظهر لك المواد المتاحة فوراً.', gradient: 'from-cyan-500 to-cyan-600', glow: 'shadow-cyan-500/30' },
                                { step: '03', title: 'خطط الفصل', desc: 'جرّب تسجيلك أو اسأل المساعد الذكي لترتيب جدولك بسهولة.', gradient: 'from-emerald-500 to-emerald-600', glow: 'shadow-emerald-500/30' },
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
                    <section ref={ctaRef} className="py-20 sm:py-28 relative overflow-hidden bg-[#0b1220] border-t border-slate-800">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_55%)] pointer-events-none" />
                        <div className="morph-orb absolute w-[360px] h-[360px] bg-cyan-500/10 blur-[90px] top-[-18%] right-[-10%] pointer-events-none" />
                        <div className="morph-orb absolute w-[300px] h-[300px] bg-indigo-500/10 blur-[100px] bottom-[-20%] left-[-8%] pointer-events-none" style={{ animationDelay: '-6s' }} />

                        <div className={`max-w-4xl mx-auto px-4 relative z-10 text-center transition-all duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] ${ctaIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-14'}`}>
                            {/* 🔥 تكبير لوجو الـ CTA ليصبح متناسق مع الحجم الجديد 🔥 */}
                            <div className="inline-flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] bg-white/5 border border-white/10 mb-8 backdrop-blur-md shadow-2xl p-4" style={{ animation: 'bounce-s 3s ease-in-out infinite' }}>
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]" />
                            </div>

                            <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-5 leading-tight tracking-tight">
                                جهّز خطتك القادمة <br className="hidden sm:block" />بأسرع طريقة.
                            </h2>
                            <p className="text-slate-200/80 font-semibold text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                                أنشئ حسابك وابدأ ببناء خطة واضحة، مع أدوات تساعدك بالتحضير لكل مادة.
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
