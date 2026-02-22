import React, { useState, useEffect } from 'react';
import { Link, usePage, Head } from '@inertiajs/react';
// 🔥 إضافة الـ Import فقط
import AiWidget from '@/Pages/AI/AiWidget';

export default function MainLayout({ children }) {
    const { auth } = usePage().props;
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // 🔥 ميزة الـ Dark Mode الاحترافية 🔥
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' || 
                   (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    // 🔥 ميزة تبديل اللغات 🔥
    const [lang, setLang] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('lang') || 'ar';
        return 'ar';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const handleResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // كائن الترجمات لضمان ترجمة كل القوائم
    const translations = {
        ar: {
            home: 'الرئيسية',
            tree: 'المسار الشجري',
            calc: 'حاسبة التفوّق',
            ai: 'AI Sanfoor',
            dashboard: 'لوحة التحكم',
            profile: 'إعدادات الحساب',
            logout: 'تسجيل الخروج',
            login: 'تسجيل الدخول',
            admin: 'لوحة الإدارة',
            footerDesc: 'المساعد الأكاديمي الرقمي الأول لطلاب الجامعات. ندمج الذكاء الاصطناعي في رحلتك الدراسية.',
            quickLinks: 'روابط سريعة',
            systemStatus: 'حالة النظام',
            db: 'قاعدة البيانات',
            connected: 'متصلة • جامعة الزرقاء'
        },
        en: {
            home: 'Home',
            tree: 'Tree Path',
            calc: 'Success Calc',
            ai: 'AI Sanfoor',
            dashboard: 'Dashboard',
            profile: 'Settings',
            logout: 'Logout',
            login: 'Login',
            admin: 'Admin Panel',
            footerDesc: 'The first digital academic assistant for university students. Integrating AI into your journey.',
            quickLinks: 'Quick Links',
            systemStatus: 'System Status',
            db: 'Database',
            connected: 'Connected • Zarqa University'
        }
    };

    const t = translations[lang];

    return (
        <div className={`min-h-screen transition-colors duration-500 flex flex-col font-sans ${isDark ? 'dark bg-[#0a0f18] text-white' : 'bg-[#fafcff] text-slate-900'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head>
                <style>{`
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
                    .animate-dropdown { animation: slideDownMenu 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                    
                    .nav-capsule { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                    .nav-scrolled {
                        width: 90% !important;
                        max-width: 1200px !important;
                        top: 15px !important;
                        border-radius: 2rem !important;
                        background: ${isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.85)'} !important;
                        backdrop-filter: blur(20px) !important;
                        box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2) !important;
                        border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'} !important;
                    }
                `}</style>
            </Head>

            {/* 1. MODERN FLOATING NAVBAR */}
            <div className="fixed top-0 w-full z-[100] flex justify-center px-4 transition-all duration-500 pointer-events-none">
                <nav className={`nav-capsule pointer-events-auto w-full max-w-[1400px] top-0 h-[72px] sm:h-20 bg-transparent border-b border-transparent ${scrolled ? 'nav-scrolled' : ''}`}>
                    <div className="h-full px-4 sm:px-6 lg:px-8 flex justify-between items-center">

                        {/* 🔥 Logo 🔥 */}
                        <Link href="/" className="flex items-center gap-3 group relative">
                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3">
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-md" />
                            </div>
                            <div className="flex flex-col relative pt-1">
                                <span className={`text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-white to-slate-400' : 'from-slate-900 to-slate-700'} tracking-tight leading-none group-hover:from-indigo-600 group-hover:to-cyan-600 transition-all duration-300`}>
                                    {lang === 'ar' ? 'سنفور' : 'Sanfoor'}
                                </span>
                                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase mt-1">
                                    Sanfoor AI
                                </span>
                            </div>
                        </Link>

                        {/* 🔥 Central Links 🔥 */}
                        <div className={`hidden lg:flex items-center gap-1 p-1 rounded-[1.25rem] border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-100/60 border-white/60 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]'}`}>
                            <Link href="/" className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('welcome') ? (isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50') : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'}`}>
                                {t.home}
                            </Link>

                            {auth.user && (
                                <>
                                    <Link href={route('tree.index')} className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('tree.index') ? (isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50') : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'}`}>
                                        {t.tree}
                                    </Link>
                                    <Link href={route('calculator.index')} className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('calculator.index') ? (isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50') : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'}`}>
                                        {t.calc}
                                    </Link>
                                    <Link href={route('ai.advisor')} className={`flex items-center gap-2 px-5 py-2 text-[13px] font-black transition-all duration-300 rounded-xl relative overflow-hidden group ${route().current('ai.advisor') ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' : 'text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/50 dark:bg-indigo-900/20'}`}>
                                        <span className="relative z-10 flex items-center gap-2">
                                            <span className="group-hover:animate-pulse text-base">🤖</span> {t.ai}
                                        </span>
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* 🔥 Right Section: Theme, Lang & User 🔥 */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            
                            {/* Language Toggle */}
                            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border transition-all active:scale-90 pointer-events-auto ${isDark ? 'bg-slate-800 border-white/10 text-indigo-400' : 'bg-white border-slate-200 text-indigo-600 shadow-sm'}`}>
                                {lang === 'ar' ? 'EN' : 'AR'}
                            </button>

                            {/* Theme Toggle */}
                            <button onClick={() => setIsDark(!isDark)} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 pointer-events-auto ${isDark ? 'bg-slate-800 text-yellow-400 border border-white/10' : 'bg-white text-slate-400 border border-slate-200 shadow-sm'}`}>
                                {isDark ? '☀️' : '🌙'}
                            </button>

                            {auth.user ? (
                                <div className="relative group hidden lg:block pointer-events-auto">
                                    <button className={`flex items-center gap-3 pl-2 pr-1.5 py-1.5 rounded-[1.25rem] border transition-all duration-300 ${isDark ? 'bg-slate-800 border-white/10 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'}`}>
                                        <div className="flex flex-col items-end leading-none ml-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{auth.user.name.split(' ')[0]}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${auth.user.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                                    {auth.user.role === 'admin' ? t.admin : 'STUDENT'}
                                                </span>
                                            </div>
                                            {auth.user.major && <span className="text-[10px] font-bold text-slate-400 mt-1 max-w-[100px] truncate">{auth.user.major.name}</span>}
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center font-black text-sm shadow-inner relative overflow-hidden">
                                            {auth.user.name.charAt(0)}
                                        </div>
                                    </button>

                                    {/* Dropdown */}
                                    <div className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50`}>
                                        <div className={`w-64 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border p-2 overflow-hidden animate-dropdown ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-100'}`}>
                                            <div className={`px-4 py-3 rounded-xl mb-2 ${isDark ? 'bg-white/5' : 'bg-slate-50/50'}`}>
                                                <p className="text-xs font-black truncate">{auth.user.email}</p>
                                            </div>
                                            <Link href={route('dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'}`}>
                                                <span>📊</span> {t.dashboard}
                                            </Link>
                                            <Link href={route('profile.edit')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                <span>⚙️</span> {t.profile}
                                            </Link>
                                            <Link href={route('logout')} method="post" as="button" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-bold text-rose-500 hover:bg-rose-50/10">
                                                <span>👋</span> {t.logout}
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Link href={route('login')} className="hidden lg:inline-flex bg-slate-900 dark:bg-indigo-600 text-white px-7 py-2.5 rounded-xl font-black text-[13px] shadow-lg hover:-translate-y-0.5 transition-all pointer-events-auto">
                                    {t.login}
                                </Link>
                            )}

                            {/* Mobile Menu Button */}
                            <button onClick={() => setMobileOpen(!mobileOpen)} className={`lg:hidden relative w-11 h-11 rounded-[1.25rem] flex items-center justify-center transition-all active:scale-95 z-[101] pointer-events-auto ${isDark ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-700 shadow-sm'}`}>
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

            {/* 🔥 Mobile Menu 🔥 */}
            <div className={`fixed inset-0 z-[100] lg:hidden transition-all duration-500 ease-in-out ${mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
                <div className={`absolute top-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[85%] max-sm h-full shadow-2xl flex flex-col transition-transform duration-500 ${isDark ? 'bg-slate-900 text-white' : 'bg-white'} ${mobileOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`}>
                    <div className="h-24 border-b border-white/5 flex items-center justify-between px-6 bg-indigo-600 text-white">
                        <span className="text-2xl font-black">{lang === 'ar' ? 'سنفور' : 'Sanfoor'}</span>
                        <button onClick={() => setMobileOpen(false)} className="text-3xl">&times;</button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
                        <Link onClick={() => setMobileOpen(false)} href="/" className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/5">{t.home}</Link>
                        {auth.user && (
                            <>
                                <Link onClick={() => setMobileOpen(false)} href={route('dashboard')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/5">{t.dashboard}</Link>
                                <Link onClick={() => setMobileOpen(false)} href={route('tree.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/5">{t.tree}</Link>
                                <Link onClick={() => setMobileOpen(false)} href={route('calculator.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/5">{t.calc}</Link>
                                <Link onClick={() => setMobileOpen(false)} href={route('ai.advisor')} className="px-4 py-4 mt-2 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-center">🤖 {t.ai}</Link>
                            </>
                        )}
                        {!auth.user && <Link onClick={() => setMobileOpen(false)} href={route('login')} className="px-4 py-3.5 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-white/5 text-center">{t.login}</Link>}
                    </div>
                    {auth.user && (
                        <div className="p-4 border-t border-white/5">
                            <Link href={route('logout')} method="post" as="button" className="w-full py-3 rounded-xl bg-rose-500/10 text-rose-500 font-bold text-sm">{t.logout}</Link>
                        </div>
                    )}
                </div>
            </div>

            {/* =========================================
                3. MAIN CONTENT
            ========================================= */}
            <main className="flex-1 flex flex-col w-full relative z-10 pt-20 sm:pt-28">
                {children}
            </main>

            {/* 🔥 هنا يظهر الذكاء الاصطناعي في كل الصفحات 🔥 */}
            {auth.user && <AiWidget user={auth.user} />}

            {/* =========================================
                4. PREMIUM FOOTER
            ========================================= */}
            <footer className={`relative transition-colors duration-500 overflow-hidden mt-12 ${isDark ? 'bg-[#050B14] border-t border-white/5' : 'bg-[#050B14] text-white'}`}>
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-12 border-b border-white/10 pb-16">
                        
                        <div className="md:col-span-5 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center p-2.5">
                                    <img src="/images/sanfoor.png" alt="Logo" className="w-full h-full object-contain" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-3xl font-black text-white">{lang === 'ar' ? 'سنفور' : 'Sanfoor'}</h3>
                                    <span className="text-[10px] font-black text-indigo-400 tracking-[0.25em] uppercase">Sanfoor AI</span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">{t.footerDesc}</p>
                        </div>

                        <div className="md:col-span-3 space-y-5">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">{t.quickLinks}</h4>
                            <ul className="space-y-3">
                                <li><Link href="/" className="text-slate-400 hover:text-indigo-400 transition-all text-sm font-bold">{t.home}</Link></li>
                                <li><Link href={route('tree.index')} className="text-slate-400 hover:text-indigo-400 transition-all text-sm font-bold">{t.tree}</Link></li>
                                <li><Link href={route('calculator.index')} className="text-slate-400 hover:text-indigo-400 transition-all text-sm font-bold">{t.calc}</Link></li>
                                <li><Link href={route('ai.advisor')} className="text-slate-400 hover:text-indigo-400 transition-all text-sm font-bold">{t.ai}</Link></li>
                            </ul>
                        </div>

                        <div className="md:col-span-4 space-y-5 flex flex-col md:items-end">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">{t.systemStatus}</h4>
                            <div className="w-full max-w-[260px] bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-slate-400">{t.ai}</span>
                                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">Online</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">{t.db}</span>
                                    <span className="text-[10px] font-black text-white">{t.connected}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-slate-500 text-[11px] font-bold">
                            &copy; {new Date().getFullYear()} {lang === 'ar' ? 'سنفور' : 'Sanfoor'}. Developed by Kollia Team.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}