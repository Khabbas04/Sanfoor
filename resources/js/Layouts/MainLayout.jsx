import React, { useState, useEffect, useCallback } from 'react';
import { Link, usePage, Head } from '@inertiajs/react';
import { useLanguage } from '@/Contexts/LanguageContext';
import { useTheme } from '@/Contexts/ThemeContext';
import AiWidget from '@/Pages/Ai/AiWidget';

/**
 * Premium Guest Demo Banner — shown on every page when a guest user is active.
 * Features: animated gradient border, glassmorphism, live session timer, NTP branding.
 */
function GuestDemoBanner() {
    const [elapsed, setElapsed] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const [expanded, setExpanded] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto-collapse on mobile after 8 seconds to reduce visual noise.
    useEffect(() => {
        if (window.innerWidth < 640) {
            const t = setTimeout(() => setExpanded(false), 8000);
            return () => clearTimeout(t);
        }
    }, []);

    const formatTime = useCallback((s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }, []);

    if (dismissed) return null;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes demo-gradient-spin {
                    0% { --demo-angle: 0deg; }
                    100% { --demo-angle: 360deg; }
                }
                @keyframes demo-pulse-ring {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(2.2); opacity: 0; }
                }
                @keyframes demo-shimmer-slide {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes demo-float-icon {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    25% { transform: translateY(-3px) rotate(-2deg); }
                    75% { transform: translateY(2px) rotate(2deg); }
                }
                @keyframes demo-border-flow {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .demo-banner-border {
                    background: linear-gradient(90deg, #f59e0b, #ef4444, #8b5cf6, #3b82f6, #06b6d4, #10b981, #f59e0b);
                    background-size: 300% 100%;
                    animation: demo-border-flow 4s linear infinite;
                }
            `}} />

            <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 mb-6" dir="rtl">
                {/* Animated gradient border wrapper */}
                <div className="demo-banner-border rounded-[1.5rem] p-[2px] shadow-[0_8px_32px_rgba(245,158,11,0.15)]">
                    <div className="relative overflow-hidden rounded-[calc(1.5rem-2px)] bg-gradient-to-br from-slate-900 via-[#0f172a] to-[#1a1033]">
                        {/* Background effects */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/3" />
                            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
                            {/* Shimmer effect */}
                            <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                                <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" style={{ animation: 'demo-shimmer-slide 5s ease-in-out infinite' }} />
                            </div>
                        </div>

                        <div className="relative z-10 p-4 sm:p-5">
                            {/* Main content row */}
                            <div className="flex items-center justify-between gap-4">
                                {/* Left: Icon + Text */}
                                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                    {/* Animated logo */}
                                    <div className="relative shrink-0">
                                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-amber-500/30 p-1.5 sm:p-2" style={{ animation: 'demo-float-icon 3s ease-in-out infinite' }}>
                                            <img src="/images/ntp-logo.png" alt="NTP 2026" className="w-full h-full object-contain drop-shadow-sm" />
                                        </div>
                                        <div className="absolute -inset-1 rounded-xl sm:rounded-2xl border-2 border-amber-400/30" style={{ animation: 'demo-pulse-ring 2s ease-out infinite' }} />
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-white text-sm sm:text-base font-black tracking-tight whitespace-nowrap">
                                                جرّب سنفور <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-300 to-orange-400">DEMO</span>
                                            </h3>
                                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider whitespace-nowrap">
                                                NTP 2026
                                            </span>
                                        </div>
                                        {expanded && (
                                            <p className="text-slate-400 text-[11px] sm:text-xs font-bold mt-1 leading-relaxed max-w-lg">
                                                أنت تتصفح نسخة تجريبية كاملة من منصة سنفور ببيانات أكاديمية واقعية — استكشف كل الميزات بحرية!
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Timer + Actions */}
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    {/* Live session timer */}
                                    <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                        </span>
                                        <span className="text-emerald-300 text-xs font-mono font-black tracking-wider" dir="ltr">
                                            {formatTime(elapsed)}
                                        </span>
                                    </div>

                                    {/* Collapse toggle on mobile */}
                                    <button
                                        onClick={() => setExpanded(prev => !prev)}
                                        className="sm:hidden w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                                    >
                                        {expanded ? '▲' : '▼'}
                                    </button>

                                    {/* Dismiss button */}
                                    <button
                                        onClick={() => setDismissed(true)}
                                        className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all text-sm"
                                        title="إخفاء البانر"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Feature chips - shown when expanded */}
                            {expanded && (
                                <div className="flex items-center gap-2 mt-3 overflow-x-auto hide-scrollbar pb-1">
                                    {[
                                        { icon: '📊', label: 'لوحة الطالب' },
                                        { icon: '🌳', label: 'الشجرة التفاعلية' },
                                        { icon: '🤖', label: 'المرشد الذكي' },
                                        { icon: '📈', label: 'حاسبة المعدل' },
                                        { icon: '📚', label: 'بنك الأسئلة' },
                                    ].map((chip, i) => (
                                        <span key={i} className="inline-flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] text-slate-300 text-[10px] sm:text-[11px] font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap hover:bg-white/10 transition-colors cursor-default" style={{ animationDelay: `${i * 80}ms` }}>
                                            {chip.icon} {chip.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// MainLayout is the shared shell for public pages and authenticated student pages.
export default function MainLayout({ children, hideNavbarOnMobileLandscape = false, hideAiWidgetOnMobileLandscape = false, absoluteNavbar = false }) {
    const page = usePage();
    if (!page || !page.props) return null; // Prevent rendering if props aren't ready

    const { props = {} } = page;
    const { auth = {}, admin_notifications = [], flash = {} } = props;
    const safeAuth = auth || {};
    const safeUser = safeAuth.user || {};
    const safeRouteCurrent = (name, pattern) => {
        try {
            if (!name || typeof route === 'undefined') return false;
            return route().current(name, {});
        } catch (e) {
            if (pattern && typeof window !== 'undefined') {
                return window.location.pathname.includes(pattern);
            }
            return false;
        }
    };
    const isAdvisorRoute = safeRouteCurrent('ai.advisor', '/ai-advisor');

    // Normalize role flags once so the layout can render the correct user actions.
    const role = (safeUser.role || '').toLowerCase().trim();
    const isOwner = Boolean(safeUser.is_owner) || role === 'owner';
    const isAdminOrOwner = Boolean(safeUser.is_admin_or_owner) || ['admin', 'owner'].includes(role);
    const isInstructor = Boolean(safeUser.is_instructor) || role === 'instructor';

    // UI state for the floating navbar and mobile drawer menu.
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [viewport, setViewport] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1280,
        height: typeof window !== 'undefined' ? window.innerHeight : 720,
    });

    const { isDark, toggleTheme } = useTheme();
    const { lang, toggleLang } = useLanguage();
    const isLandscapeMobile = viewport.width < 1024 && viewport.width >= viewport.height;
    const shouldHideNav = hideNavbarOnMobileLandscape && isLandscapeMobile;
    const shouldHideAiWidget = hideAiWidgetOnMobileLandscape && isLandscapeMobile;

    // Add the compact navbar style after the user scrolls down.
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [page.url]);

    // Close the mobile menu whenever the current route changes.
    useEffect(() => {
        setMobileOpen(false);
    }, [page.url]);

    // Also close the mobile menu when switching back to desktop width.
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setViewport({ width, height });
            if (width >= 1024) setMobileOpen(false);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (shouldHideNav) setMobileOpen(false);
    }, [shouldHideNav]);

    // Prevent background scroll when the mobile drawer is open.
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }

        document.body.style.overflow = '';
    }, [mobileOpen]);

    // Shared translations used by navigation labels and the footer.
    const translations = {
            ar: {
            home: 'الرئيسية',
            tree: 'المسار الشجري',
            calc: 'حاسبة التفوّق',
            directory: 'دليل المباني',
            chapters: 'الشابترز',
            quiz: 'بنك الأسئلة',
            ai: 'AI Sanfoor',
            dashboard: 'لوحة التحكم',
            profile: 'إعدادات الحساب',
            logout: 'تسجيل الخروج',
            login: 'تسجيل الدخول',
            admin: 'لوحة الإدارة',
            footerDesc: 'المساعد الأكاديمي الرقمي الأول لطلاب الجامعات. ندمج الذكاء الاصطناعي في رحلتك الدراسية لنمنحك تجربة تعليمية أذكى.',
            quickLinks: 'روابط سريعة',
            resources: 'المعرفة',
            legal: 'قانوني',
            about: 'من نحن',
            howItWorks: 'كيف يعمل سنفور',
            faq: 'الأسئلة الشائعة',
            contact: 'انضم إلينا',
            supportCenter: 'مركز الدعم',
            studentTools: 'أدوات الطالب',
            supportHint: 'للمشاكل التقنية داخل الحساب، استخدم صفحة البلاغات ليصل الطلب للفريق مباشرة.',
            reportIssue: 'الإبلاغ عن مشكلة',
            terms: 'شروط الاستخدام',
            privacy: 'سياسة الخصوصية',
            systemStatus: 'حالة النظام',
            aiEngine: 'محرك الذكاء الاصطناعي',
            version: 'إصدار النظام',
            announcements: 'الإعلانات',
            students: 'الطلاب',
        },
        en: {
            home: 'Home',
            tree: 'Tree Path',
            calc: 'Success Calc',
            directory: 'Directory',
            chapters: 'Chapters',
            quiz: 'Quiz Bank',
            ai: 'AI Sanfoor',
            dashboard: 'Dashboard',
            profile: 'Settings',
            logout: 'Logout',
            login: 'Login',
            admin: 'Admin Panel',
            footerDesc: 'The first digital academic assistant for university students. Integrating AI into your journey for a smarter educational experience.',
            quickLinks: 'Quick Links',
            resources: 'Resources',
            legal: 'Legal',
            about: 'About Us',
            howItWorks: 'How It Works',
            faq: 'FAQ',
            contact: 'Join Us',
            supportCenter: 'Support Center',
            studentTools: 'Student Tools',
            supportHint: 'For technical account issues, use the issue report page so the team can track it directly.',
            reportIssue: 'Report an Issue',
            terms: 'Terms of Use',
            privacy: 'Privacy Policy',
            systemStatus: 'System Status',
            aiEngine: 'AI Engine',
            version: 'System Version',
            announcements: 'Announcements',
            students: 'Students',
        }
    };

    const t = (translations[lang] || translations.ar) || translations.en || {};

    const safeRoute = (name, params) => {
        try {
            return route(name, params);
        } catch (e) {
            console.warn(`Ziggy route "${name}" not found, falling back to path.`);
            if (name === 'tree.index') return '/tree';
            if (name === 'calculator.index') return '/calculator';
            if (name === 'campus.directory') return '/campus-directory';
            if (name === 'ai.advisor') return '/ai-advisor';
            if (name === 'dashboard') return '/dashboard';
            if (name === 'profile.edit') return '/profile';
            if (name === 'login') return '/login';
            if (name === 'admin.dashboard') return '/admin/dashboard';
            return '#';
        }
    };

    // academicOpen state removed

    return (
        <div className={`min-h-screen flex flex-col font-sans bg-[#F7FAFC] text-[#0F172A]`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
            </Head>

            <style dangerouslySetInnerHTML={{
                __html: `
                * { scroll-behavior: smooth; }
                ::selection { background: #e0e7ff; color: #312e81; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${isDark ? '#334155' : '#cbd5e1'}; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #818cf8; }
                
                @keyframes slideDownMenu {
                    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes floatBadge {
                    0%, 100% { transform: translateY(0px) rotate(12deg); }
                    50% { transform: translateY(-3px) rotate(16deg) scale(1.05); }
                }
                .animate-dropdown { animation: slideDownMenu 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .animate-float-badge { animation: floatBadge 3s ease-in-out infinite; }
                
                .nav-capsule { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                .nav-scrolled {
                    width: 95% !important;
                    max-width: 1280px !important;
                    top: 15px !important;
                    border-radius: 2rem !important;
                    background: ${isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'} !important;
                    backdrop-filter: blur(200px) !important;
                    box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15) !important;
                    border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'} !important;
                }
            ` }} />

            {/* Shared floating navbar used across the public-facing experience. */}
            {!shouldHideNav && (
                <div className={`${absoluteNavbar ? 'absolute' : 'relative md:fixed'} top-0 w-full z-50 flex justify-center px-2 sm:px-4 transition-all duration-500 pointer-events-none`}>
                    <nav className={`nav-capsule pointer-events-auto w-full max-w-[1400px] top-0 h-[72px] sm:h-[96px] bg-transparent border-b border-transparent ${scrolled ? 'nav-scrolled' : ''}`}>
                        <div className="h-full px-4 sm:px-6 lg:px-8 flex justify-between items-center">

                            {/* Logo Section */}
                            <Link href="/" className="flex items-center gap-4 group relative">
                                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3">
                                    <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-xl" />
                                </div>
                                <div className="flex flex-col justify-center relative leading-none">
                                    <div className="relative w-fit">
                                        <span className={`text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-l from-blue-600 from-[50%] ${isDark ? 'to-white' : 'to-slate-900'} to-[50%] tracking-tight transition-all duration-300 pb-0.5`}>
                                            {lang === 'ar' ? 'سنفور' : 'Sanfoor'}
                                        </span>
                                        <span className={`absolute -top-1.5 sm:-top-2.5 ${lang === 'ar' ? '-left-3 sm:-left-4' : '-right-3 sm:-right-4'} px-1.5 py-0.5 bg-gradient-to-br from-sky-400 to-blue-500 text-white text-[7px] sm:text-[9px] font-black rounded-md shadow-[0_0_10px_rgba(59,130,246,0.4)] animate-float-badge tracking-widest pointer-events-none z-10 border border-white/20`}>
                                            ZU
                                        </span>
                                    </div>
                                    {lang === 'ar' && (
                                        <span className={`text-[0.65rem] sm:text-[0.8rem] font-black bg-clip-text text-transparent bg-gradient-to-l from-blue-600 from-[50%] ${isDark ? 'to-white' : 'to-slate-900'} to-[50%] tracking-[0.2em] uppercase transition-all duration-300 mt-0.5`}>
                                            Sanfoor
                                        </span>
                                    )}
                                </div>
                            </Link>

                            {/* Central Links with Icons */}
                            <div className="hidden lg:flex items-center gap-1.5 p-1.5 rounded-brand border border-[#E2E8F0] bg-white shadow-soft transition-all duration-300 hover:shadow-soft-hover">
                                <Link href="/" className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-brand group ${safeRouteCurrent('welcome', '/') && window.location.pathname === '/' ? 'bg-[#F7FAFC] text-[#2F80ED] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAFC]'}`}>
                                    <span className="transition-transform group-hover:scale-110">🏠</span> {t.home}
                                </Link>

                                {!isInstructor ? (
                                    <>
                                        <Link href={safeRoute('tree.index')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-brand group ${safeRouteCurrent('tree.index', '/tree') ? 'bg-[#F7FAFC] text-[#2F80ED] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAFC]'}`}>
                                            <span className="transition-transform group-hover:scale-110">🌳</span> {t.tree}
                                        </Link>

                                        <Link href={safeRoute('calculator.index')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-brand group ${safeRouteCurrent('calculator.index', '/calculator') ? 'bg-[#F7FAFC] text-[#2F80ED] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAFC]'}`}>
                                            <span className="transition-transform group-hover:scale-110">📈</span> {t.calc}
                                        </Link>

                                        <Link href={safeRoute('campus.directory')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-brand group ${safeRouteCurrent('campus.directory', '/campus-directory') ? 'bg-[#F7FAFC] text-[#2F80ED] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAFC]'}`}>
                                            <span className="transition-transform group-hover:scale-110">🏢</span> {t.directory}
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link href={safeRoute('tree.index')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-brand group ${safeRouteCurrent('tree.index', '/tree') ? 'bg-[#F7FAFC] text-[#2F80ED] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAFC]'}`}>
                                            <span className="transition-transform group-hover:scale-110">🌳</span> {lang === 'ar' ? 'خطط الكلية' : 'College Plans'}
                                        </Link>

                                        <Link href={route('instructor.students')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-brand group ${safeRouteCurrent('instructor.students') ? 'bg-[#F7FAFC] text-[#2F80ED] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAFC]'}`}>
                                            <span className="transition-transform group-hover:scale-110">👥</span> {t.students}
                                        </Link>

                                        <Link href={safeRoute('schedule_reviews.index')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-brand group ${safeRouteCurrent('schedule_reviews.index', '/schedule-reviews') ? 'bg-[#F7FAFC] text-[#2F80ED] shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F7FAFC]'}`}>
                                            <span className="transition-transform group-hover:scale-110">📑</span> {lang === 'ar' ? 'مراجعة الخطط' : 'Plan Reviews'}
                                        </Link>
                                    </>
                                )}

                                {/* Academic Content removed from central nav to keep header compact */}

                                <Link href={isInstructor ? safeRoute('instructor.ai.scheduler') : safeRoute('ai.advisor')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-black transition-all duration-300 rounded-xl relative overflow-hidden group ${(isInstructor ? safeRouteCurrent('instructor.ai.scheduler') : safeRouteCurrent('ai.advisor', '/ai-advisor')) ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'text-blue-600 bg-sky-50 hover:bg-sky-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20'}`}>
                                    <span className="relative z-10 flex items-center gap-2">
                                        <span className="group-hover:animate-pulse text-base">🤖</span> {isInstructor ? (lang === 'ar' ? 'المساعد للجدول' : 'AI Scheduler') : t.ai}
                                    </span>
                                </Link>

                            </div>

                            {/* Theme toggle, language switcher, and account actions. */}
                            <div className="flex items-center gap-2 sm:gap-3">

                                {!safeUser.id && (
                                    <>
                                        <button onClick={toggleLang} className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border transition-all active:scale-90 pointer-events-auto hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 border-white/10 text-blue-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-blue-600 shadow-sm hover:bg-slate-50 hover:shadow'}`}>
                                            {lang === 'ar' ? 'EN' : 'AR'}
                                        </button>
                                        <button onClick={toggleTheme} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 pointer-events-auto hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 text-yellow-400 border border-white/10 hover:bg-slate-700' : 'bg-white text-slate-400 border border-slate-200 shadow-sm hover:bg-slate-50 hover:shadow'}`}>
                                            {isDark ? '☀️' : '🌙'}
                                        </button>
                                    </>
                                )}

                                {safeUser.id ? (
                                    <div className="relative group hidden lg:block pointer-events-auto">
                                        <button className={`flex items-center gap-3 pl-2 pr-1.5 py-1.5 rounded-[1.25rem] border transition-all duration-300 hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 border-white/10 hover:border-blue-500' : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md'}`}>
                                            <div className="flex flex-col items-end leading-none ml-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{(safeUser.name ?? '').split(' ')[0] || '?'}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${isOwner ? 'bg-rose-100 text-rose-800' : isAdminOrOwner ? 'bg-amber-100 text-amber-800' : isInstructor ? 'bg-teal-100 text-teal-800' : safeUser.is_guest ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-orange-800 shadow-sm' : 'bg-sky-100 text-blue-800'}`}>
                                                        {isOwner ? 'OWNER' : isAdminOrOwner ? 'ADMIN' : isInstructor ? 'INSTRUCTOR' : safeUser.is_guest ? 'DEMO' : 'STUDENT'}
                                                    </span>
                                                </div>
                                                {safeUser.major && <span className="text-[10px] font-bold text-slate-400 mt-1 max-w-[100px] truncate">{safeUser.major.name}</span>}
                                            </div>
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-blue-500 text-white flex items-center justify-center font-black text-sm shadow-inner relative overflow-hidden shrink-0">
                                                {safeUser.avatar ? (
                                                    <img src={safeUser.avatar} alt={safeUser.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    safeUser.name?.charAt(0) ?? '?'
                                                )}
                                            </div>
                                        </button>

                                        {/* Dropdown Menu */}
                                        <div className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50`}>
                                            <div className={`w-72 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border p-3 overflow-hidden animate-dropdown ${isDark ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-100'}`}>
                                                <div className={`px-4 py-3 rounded-xl mb-3 flex items-center gap-3 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                                                    <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">📧</div>
                                                    <p className="text-xs font-bold truncate opacity-70">{safeUser.email}</p>
                                                </div>
                                                {isAdminOrOwner && (
                                                    <>
                                                        <Link href={safeRoute('admin.dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-black mb-2 ${isDark ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}>
                                                            <span>🛡️</span> {t.admin}
                                                        </Link>
                                                        <div className={`border-b my-2 ${isDark ? 'border-white/10' : 'border-slate-100'}`}></div>
                                                    </>
                                                )}
                                                <div className="space-y-1">
                                                    <div className={`px-4 pt-1 pb-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {lang === 'ar' ? 'عام' : 'General'}
                                                    </div>
                                                    <Link href={safeRoute('dashboard')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                        <span>📊</span> {t.dashboard}
                                                    </Link>
                                                    <Link href={safeRoute('public.announcements')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                        <span>📢</span> {t.announcements}
                                                    </Link>
                                                    {!isInstructor && (
                                                        <>
                                                            <div className={`px-4 pt-3 pb-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                {lang === 'ar' ? 'أكاديمي' : 'Academic'}
                                                            </div>
                                                            <Link href="/chapters" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                                <span>📖</span> {t.chapters}
                                                            </Link>
                                                            <Link href="/quiz" className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                                <span>❓</span> {t.quiz}
                                                            </Link>
                                                        </>
                                                    )}
                                                    <div className={`px-4 pt-3 pb-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {lang === 'ar' ? 'الحساب' : 'Account'}
                                                    </div>
                                                    <Link href={safeRoute('profile.edit')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                        <span>⚙️</span> {t.profile}
                                                    </Link>
                                                </div>

                                                <div className={`border-t my-2 ${isDark ? 'border-white/10' : 'border-slate-100'}`}></div>
                                                <div className="flex items-center gap-2 px-1">
                                                    <button onClick={toggleLang} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-colors ${isDark ? 'text-blue-400 hover:bg-white/5' : 'text-blue-600 hover:bg-slate-50'}`}>
                                                        🌍 {lang === 'ar' ? 'English' : 'العربية'}
                                                    </button>
                                                    <button onClick={toggleTheme} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-colors ${isDark ? 'text-yellow-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}>
                                                        {isDark ? '☀️ Light' : '🌙 Dark'}
                                                    </button>
                                                </div>
                                                <div className={`border-t my-2 pt-2 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                                                    <Link href={safeRoute('logout')} method="post" as="button" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                                                        <span>👋</span> {t.logout}
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <Link href={safeRoute('login')} className="hidden lg:inline-flex bg-slate-900 dark:bg-blue-600 text-white px-7 py-2.5 rounded-xl font-black text-[13px] shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all pointer-events-auto">
                                        {t.login}
                                    </Link>
                                )}

                                {/* Mobile menu button for the off-canvas navigation. */}
                                <button onClick={() => setMobileOpen(!mobileOpen)} className={`lg:hidden relative w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all active:scale-95 z-[101] pointer-events-auto ${isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50'}`}>
                                    <div className="flex flex-col items-center justify-center gap-[5px] w-5 h-5">
                                        <span className={`block w-full h-[2.5px] bg-current rounded-full transition-all duration-300 origin-left ${mobileOpen ? 'rotate-[42deg] w-[22px]' : ''}`}></span>
                                        <span className={`block w-full h-[2.5px] bg-current rounded-full transition-all duration-300 ${mobileOpen ? 'opacity-0 translate-x-4' : ''}`}></span>
                                        <span className={`block w-full h-[2.5px] bg-current rounded-full transition-all duration-300 origin-left ${mobileOpen ? '-rotate-[42deg] w-[22px]' : ''}`}></span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </nav>
                </div>
            )}

            {/* Mobile drawer version of the main navigation. */}
            {!shouldHideNav && (
                <div className={`fixed inset-0 z-[100] lg:hidden transition-all duration-500 ease-in-out ${mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
                    <div className={`absolute top-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[85%] max-w-sm h-full shadow-2xl flex flex-col transition-transform duration-500 bg-white text-[#0F172A] ${mobileOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`}>
                        <div className="h-32 border-b border-white/10 flex items-center justify-between px-6 bg-gradient-to-r from-sky-400 to-blue-600 text-white">
                            <div className="flex items-center gap-4">
                                <img src="/images/sanfoor.png" alt="Logo" className="w-14 h-14 object-contain drop-shadow-md" />
                                <div className="flex flex-col leading-none mt-1">
                                    <div className="relative w-fit">
                                        <span className="text-2xl font-black">{lang === 'ar' ? 'سنفور' : 'Sanfoor'}</span>
                                        <span className={`absolute -top-2 ${lang === 'ar' ? '-left-4' : '-right-4'} px-1.5 py-0.5 bg-gradient-to-br from-sky-400 to-blue-500 text-white text-[7px] font-black rounded-md shadow-lg animate-float-badge tracking-widest border border-white/20 z-10`}>
                                            ZU
                                        </span>
                                    </div>
                                    {lang === 'ar' && <span className="text-sm font-black uppercase tracking-widest opacity-80 mt-0.5">Sanfoor</span>}
                                </div>
                            </div>
                            <button onClick={() => setMobileOpen(false)} className="text-3xl opacity-70 hover:opacity-100 transition-opacity">&times;</button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
                            <Link onClick={() => setMobileOpen(false)} href="/" className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">🏠 {t.home}</Link>

                            <div className={`px-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {lang === 'ar' ? 'أكاديمي' : 'Academic'}
                            </div>
                            
                            {!isInstructor ? (
                                <>
                                    <Link onClick={() => setMobileOpen(false)} href={safeRoute('tree.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">🌳 {t.tree}</Link>
                                    <Link onClick={() => setMobileOpen(false)} href={safeRoute('calculator.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">📈 {t.calc}</Link>
                                    <Link onClick={() => setMobileOpen(false)} href="/chapters" className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">📖 {t.chapters}</Link>
                                    <Link onClick={() => setMobileOpen(false)} href="/quiz" className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">❓ {t.quiz}</Link>
                                </>
                            ) : (
                                <>
                                    <Link onClick={() => setMobileOpen(false)} href={safeRoute('tree.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">🌳 {lang === 'ar' ? 'خطط الكلية' : 'College Plans'}</Link>
                                    <Link onClick={() => setMobileOpen(false)} href={route('instructor.students')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">👥 {t.students}</Link>
                                    <Link onClick={() => setMobileOpen(false)} href={safeRoute('schedule_reviews.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">📑 {lang === 'ar' ? 'مراجعة الخطط' : 'Plan Reviews'}</Link>
                                </>
                            )}

                            <div className={`px-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {lang === 'ar' ? 'عام' : 'General'}
                            </div>
                            {!isInstructor && (
                                <Link onClick={() => setMobileOpen(false)} href={safeRoute('campus.directory')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">🏢 {t.directory}</Link>
                            )}
                            <Link onClick={() => setMobileOpen(false)} href={safeRoute('public.announcements')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">📢 {t.announcements}</Link>
                            
                            <div className={`px-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {lang === 'ar' ? 'الذكاء الاصطناعي' : 'AI'}
                            </div>
                            <Link onClick={() => setMobileOpen(false)} href={isInstructor ? safeRoute('instructor.ai.scheduler') : safeRoute('ai.advisor')} className="px-4 py-4 mt-1 rounded-2xl font-black text-sm bg-gradient-to-r from-sky-400 to-blue-500 text-white text-center shadow-lg shadow-blue-500/30 hover:opacity-90 transition-opacity">🤖 {isInstructor ? (lang === 'ar' ? 'المساعد للجدول' : 'AI Scheduler') : t.ai}</Link>

                            {safeUser.id && (
                                <>
                                    <div className={`px-4 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {lang === 'ar' ? 'حسابي' : 'My Account'}
                                    </div>
                                    {isAdminOrOwner && (
                                        <Link onClick={() => setMobileOpen(false)} href={safeRoute('admin.dashboard')} className="px-4 py-3.5 rounded-2xl font-black text-sm bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 mb-2 transition-colors">🛡️ {t.admin}</Link>
                                    )}
                                    <Link onClick={() => setMobileOpen(false)} href={safeRoute('dashboard')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">📊 {t.dashboard}</Link>
                                    <Link onClick={() => setMobileOpen(false)} href={safeRoute('profile.edit')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">⚙️ {t.profile}</Link>
                                </>
                            )}

                            {!safeUser.id && <Link onClick={() => setMobileOpen(false)} href={safeRoute('login')} className="px-4 py-4 mt-2 rounded-2xl font-black text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-center hover:scale-[1.02] transition-transform">{t.login}</Link>}
                        </div>

                        <div className="p-4 border-t border-slate-100 dark:border-white/5 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <button onClick={() => { toggleLang(); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-colors ${isDark ? 'bg-white/5 text-blue-400 hover:bg-white/10' : 'bg-slate-50 text-blue-600 hover:bg-slate-100'}`}>
                                    🌍 {lang === 'ar' ? 'English' : 'العربية'}
                                </button>
                                <button onClick={() => { toggleTheme(); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-colors ${isDark ? 'bg-white/5 text-yellow-400 hover:bg-white/10' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                    {isDark ? '☀️ Light' : '🌙 Dark'}
                                </button>
                            </div>
                            {safeUser.id && (
                                <Link href={safeRoute('logout')} method="post" as="button" className="w-full py-3.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 font-bold text-sm transition-colors hover:bg-rose-100 dark:hover:bg-rose-500/20">👋 {t.logout}</Link>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Routed page content is rendered inside the shared layout shell with a professional fade/blur transition. */}
            <main className={`flex-1 flex flex-col w-full relative ${shouldHideNav ? 'pt-0' : 'pt-4 md:pt-28'}`}>
                {/* ═══ NTP GUEST DEMO BANNER ═══ */}
                {safeUser.is_guest && <GuestDemoBanner />}
                {children}
            </main>

            {/* The floating AI assistant is available only for signed-in users on the welcome page. */}
            {safeUser.id && safeRouteCurrent('welcome', '/') && !shouldHideAiWidget && <AiWidget user={safeUser} />}

            {/* Global footer with cleaner grouped links and focused actions. */}
            <footer className={`relative transition-colors duration-500 overflow-hidden mt-12 ${isDark ? 'bg-[#050B14] border-t border-white/5' : 'bg-[#050B14] text-white'}`}>
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-8 border-b border-white/10 pb-12">
                        <div className="xl:col-span-2 space-y-5">
                            <div className="flex items-center gap-4">
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
                                <div className="flex flex-col leading-none mt-1">
                                    <div className="relative w-fit">
                                        <h3 className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-l from-blue-500 from-[50%] to-white to-[50%] tracking-tight pb-0.5">{lang === 'ar' ? 'سنفور' : 'Sanfoor'}</h3>
                                        <span className={`absolute -top-2 sm:-top-3 ${lang === 'ar' ? '-left-3 sm:-left-4' : '-right-3 sm:-right-4'} px-1.5 py-0.5 bg-gradient-to-br from-sky-400 to-blue-500 text-white text-[7px] sm:text-[9px] font-black rounded-md shadow-[0_0_10px_rgba(59,130,246,0.4)] animate-float-badge tracking-widest border border-white/20 z-10`}>
                                            ZU
                                        </span>
                                    </div>
                                    {lang === 'ar' && <span className="text-[0.65rem] sm:text-[0.8rem] font-black text-blue-400 tracking-[0.2em] uppercase mt-0.5">Sanfoor</span>}
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-md">{t.footerDesc}</p>
                            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-4 max-w-md">
                                <p className="text-xs font-black text-blue-200 mb-1">{t.supportCenter}</p>
                                <p className="text-[12px] text-slate-300 font-bold leading-relaxed">{t.supportHint}</p>
                                <div className="mt-3 flex items-center gap-3">
                                    <Link href={safeRoute('support.issue.create')} className="inline-flex items-center gap-2 text-sm font-black text-blue-300 hover:text-blue-200 transition-colors">
                                        🛠️ {t.reportIssue}
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">{isInstructor ? (lang === 'ar' ? 'أدوات الكادر التدريسي' : 'Instructor Tools') : t.studentTools}</h4>
                            <ul className="space-y-2.5">
                                <li><Link href="/" className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.home}</Link></li>
                                <li><Link href={safeRoute('tree.index')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{isInstructor ? (lang === 'ar' ? 'خطط الكلية' : 'College Plans') : t.tree}</Link></li>
                                {!isInstructor && (
                                    <>
                                        <li><Link href={safeRoute('calculator.index')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.calc}</Link></li>
                                    </>
                                )}
                                {!isInstructor && (
                                    <>
                                        <li><Link href="/chapters" className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.chapters}</Link></li>
                                        <li><Link href="/quiz" className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.quiz}</Link></li>
                                    </>
                                )}
                                <li><Link href={isInstructor ? safeRoute('instructor.ai.scheduler') : safeRoute('ai.advisor')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{isInstructor ? (lang === 'ar' ? 'المساعد للجدول' : 'AI Scheduler') : t.ai}</Link></li>
                                {isInstructor && (
                                    <>
                                        <li><Link href={route('instructor.students')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.students}</Link></li>
                                        <li><Link href={safeRoute('schedule_reviews.index')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{lang === 'ar' ? 'مراجعة الخطط' : 'Plan Reviews'}</Link></li>
                                    </>
                                )}
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">{t.resources}</h4>
                            <ul className="space-y-2.5">
                                <li><Link href={safeRoute('public.how_it_works')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.howItWorks}</Link></li>
                                <li><Link href={safeRoute('public.faq')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.faq}</Link></li>
                                <li><Link href={safeRoute('public.contact')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.contact}</Link></li>
                                <li><Link href={safeRoute('legal.about')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.about}</Link></li>
                            </ul>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">{t.legal}</h4>
                            <ul className="space-y-2.5">
                                <li><Link href={safeRoute('legal.terms')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.terms}</Link></li>
                                <li><Link href={safeRoute('legal.privacy')} className="text-slate-400 hover:text-blue-300 transition-colors text-sm font-bold">{t.privacy}</Link></li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-slate-500 text-[11px] font-bold tracking-wide">
                            &copy; {new Date().getFullYear()} {lang === 'ar' ? 'سنفور' : 'Sanfoor'}.
                        </p>
                        <div className="flex items-center justify-end gap-1.5 text-[11px] font-black tracking-widest text-slate-500 uppercase" dir="ltr">
                            Developed by
                            <a
                                href="https://www.linkedin.com/in/asem-alkhabbas-667471371/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 transition-all border-b border-blue-400/30 hover:border-blue-400 pb-0.5"
                            >
                                Asem Alkhabbas
                            </a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
