import React, { useState, useEffect } from 'react';
import { Link, usePage, Head } from '@inertiajs/react';
import { useLanguage } from '@/Contexts/LanguageContext';
import { useTheme } from '@/Contexts/ThemeContext';
import AiWidget from '@/Pages/AI/AiWidget';

export default function MainLayout({ children }) {
    const { auth } = usePage().props;
    const role = (auth?.user?.role || '').toLowerCase().trim();
    const isOwner = Boolean(auth?.user?.is_owner) || role === 'owner';
    const isAdminOrOwner = Boolean(auth?.user?.is_admin_or_owner) || ['admin', 'owner'].includes(role);
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const { isDark, toggleTheme } = useTheme();
    const { lang, toggleLang } = useLanguage();

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

    const translations = {
        ar: {
            home: 'الرئيسية',
            tree: 'المسار الشجري',
            calc: 'حاسبة التفوّق',
            directory: 'دليل المباني',
            ai: 'AI Sanfoor',
            dashboard: 'لوحة التحكم',
            profile: 'إعدادات الحساب',
            logout: 'تسجيل الخروج',
            login: 'تسجيل الدخول',
            admin: 'لوحة الإدارة',
            footerDesc: 'المساعد الأكاديمي الرقمي الأول لطلاب الجامعات. ندمج الذكاء الاصطناعي في رحلتك الدراسية لنمنحك تجربة تعليمية أذكى.',
            quickLinks: 'روابط سريعة',
            systemStatus: 'حالة النظام',
            aiEngine: 'محرك الذكاء الاصطناعي',
            version: 'إصدار النظام'
        },
        en: {
            home: 'Home',
            tree: 'Tree Path',
            calc: 'Success Calc',
            directory: 'Directory',
            ai: 'AI Sanfoor',
            dashboard: 'Dashboard',
            profile: 'Settings',
            logout: 'Logout',
            login: 'Login',
            admin: 'Admin Panel',
            footerDesc: 'The first digital academic assistant for university students. Integrating AI into your journey for a smarter educational experience.',
            quickLinks: 'Quick Links',
            systemStatus: 'System Status',
            aiEngine: 'AI Engine',
            version: 'System Version'
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
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-dropdown { animation: slideDownMenu 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                    .animate-fade-in-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                    
                    .nav-capsule { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                    .nav-scrolled {
                        width: 95% !important;
                        max-width: 1280px !important;
                        top: 15px !important;
                        border-radius: 2rem !important;
                        background: ${isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'} !important;
                        backdrop-filter: blur(20px) !important;
                        box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15) !important;
                        border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'} !important;
                    }
                `}</style>
            </Head>

            {/* MODERN FLOATING NAVBAR */}
            <div className="fixed top-0 w-full z-[100] flex justify-center px-2 sm:px-4 transition-all duration-500 pointer-events-none">
                <nav className={`nav-capsule pointer-events-auto w-full max-w-[1400px] top-0 h-[90px] sm:h-[120px] bg-transparent border-b border-transparent ${scrolled ? 'nav-scrolled' : ''}`}>
                    <div className="h-full px-4 sm:px-6 lg:px-8 flex justify-between items-center">

                        {/* Logo Section */}
                        <Link href="/" className="flex items-center gap-4 group relative">
                            <div className="relative w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3">
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-xl" />
                            </div>
                            <div className="flex flex-col justify-center relative leading-none">
                                <span className={`text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 from-[50%] ${isDark ? 'to-white' : 'to-slate-900'} to-[50%] tracking-tight transition-all duration-300 pb-0.5`}>
                                    {lang === 'ar' ? 'سنفور' : 'Sanfoor'}
                                </span>
                                {lang === 'ar' && (
                                    <span className={`text-[0.65rem] sm:text-[0.8rem] font-black bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 from-[50%] ${isDark ? 'to-white' : 'to-slate-900'} to-[50%] tracking-[0.2em] uppercase transition-all duration-300`}>
                                        Sanfoor
                                    </span>
                                )}
                            </div>
                        </Link>

                        {/* Central Links with Icons */}
                        <div className={`hidden lg:flex items-center gap-1.5 p-1.5 rounded-[1.25rem] border transition-all duration-500 hover:shadow-lg ${isDark ? 'bg-slate-900/50 border-white/5 hover:border-white/10' : 'bg-slate-100/60 border-white/60 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] hover:bg-slate-100/80'}`}>
                            <Link href="/" className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('welcome') ? (isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50') : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'}`}>
                                <span className="transition-transform group-hover:scale-110">🏠</span> {t.home}
                            </Link>

                            <Link href={route('tree.index')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('tree.index') ? (isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50') : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'}`}>
                                <span className="transition-transform group-hover:scale-110">🌳</span> {t.tree}
                            </Link>

                            <Link href={route('calculator.index')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('calculator.index') ? (isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50') : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'}`}>
                                <span className="transition-transform group-hover:scale-110">📈</span> {t.calc}
                            </Link>

                            <Link href={route('campus.directory')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('campus.directory') ? (isDark ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50') : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-white/40'}`}>
                                <span className="transition-transform group-hover:scale-110">🏢</span> {t.directory}
                            </Link>

                            <Link href={route('ai.advisor')} className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-black transition-all duration-300 rounded-xl relative overflow-hidden group ${route().current('ai.advisor') ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20'}`}>
                                <span className="relative z-10 flex items-center gap-2">
                                    <span className="group-hover:animate-pulse text-base">🤖</span> {t.ai}
                                </span>
                            </Link>
                        </div>

                        {/* Right Section: Theme, Lang & User */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button onClick={toggleLang} className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border transition-all active:scale-90 pointer-events-auto hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 border-white/10 text-indigo-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-indigo-600 shadow-sm hover:bg-slate-50 hover:shadow'}`}>
                                {lang === 'ar' ? 'EN' : 'AR'}
                            </button>
                            <button onClick={toggleTheme} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 pointer-events-auto hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 text-yellow-400 border border-white/10 hover:bg-slate-700' : 'bg-white text-slate-400 border border-slate-200 shadow-sm hover:bg-slate-50 hover:shadow'}`}>
                                {isDark ? '☀️' : '🌙'}
                            </button>

                            {auth.user ? (
                                <div className="relative group hidden lg:block pointer-events-auto">
                                    <button className={`flex items-center gap-3 pl-2 pr-1.5 py-1.5 rounded-[1.25rem] border transition-all duration-300 hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 border-white/10 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'}`}>
                                        <div className="flex flex-col items-end leading-none ml-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-[13px] font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{auth.user.name.split(' ')[0]}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${isOwner ? 'bg-rose-100 text-rose-800' : isAdminOrOwner ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                                    {isOwner ? 'OWNER' : isAdminOrOwner ? 'ADMIN' : 'STUDENT'}
                                                </span>
                                            </div>
                                            {auth.user.major && <span className="text-[10px] font-bold text-slate-400 mt-1 max-w-[100px] truncate">{auth.user.major.name}</span>}
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center font-black text-sm shadow-inner relative overflow-hidden">
                                            {auth.user.name.charAt(0)}
                                        </div>
                                    </button>

                                    {/* Dropdown Menu */}
                                    <div className={`absolute ${lang === 'ar' ? 'left-0' : 'right-0'} top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50`}>
                                        <div className={`w-72 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border p-3 overflow-hidden animate-dropdown ${isDark ? 'bg-[#0F172A] border-white/10' : 'bg-white border-slate-100'}`}>
                                            <div className={`px-4 py-3 rounded-xl mb-3 flex items-center gap-3 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">📧</div>
                                                <p className="text-xs font-bold truncate opacity-70">{auth.user.email}</p>
                                            </div>
                                            {isAdminOrOwner && (
                                                <>
                                                    <Link href={route('admin.dashboard')} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-black mb-2 ${isDark ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}>
                                                        <span>🛡️</span> {t.admin}
                                                    </Link>
                                                    <div className={`border-b my-2 ${isDark ? 'border-white/10' : 'border-slate-100'}`}></div>
                                                </>
                                            )}
                                            <div className="space-y-1">
                                                <Link href={route('dashboard')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                    <span>📊</span> {t.dashboard}
                                                </Link>
                                                <Link href={route('profile.edit')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-bold ${isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'}`}>
                                                    <span>⚙️</span> {t.profile}
                                                </Link>
                                            </div>
                                            <div className={`border-t my-2 pt-2 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                                                <Link href={route('logout')} method="post" as="button" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors text-sm font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                                                    <span>👋</span> {t.logout}
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Link href={route('login')} className="hidden lg:inline-flex bg-slate-900 dark:bg-indigo-600 text-white px-7 py-2.5 rounded-xl font-black text-[13px] shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all pointer-events-auto">
                                    {t.login}
                                </Link>
                            )}

                            {/* Mobile Menu Button */}
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

            {/* Mobile Menu */}
            <div className={`fixed inset-0 z-[100] lg:hidden transition-all duration-500 ease-in-out ${mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}></div>
                <div className={`absolute top-0 ${lang === 'ar' ? 'right-0' : 'left-0'} w-[85%] max-w-sm h-full shadow-2xl flex flex-col transition-transform duration-500 ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} ${mobileOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`}>
                    <div className="h-32 border-b border-white/10 flex items-center justify-between px-6 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white">
                        <div className="flex items-center gap-4">
                            <img src="/images/sanfoor.png" alt="Logo" className="w-14 h-14 object-contain drop-shadow-md" />
                            <div className="flex flex-col leading-none">
                                <span className="text-2xl font-black">{lang === 'ar' ? 'سنفور' : 'Sanfoor'}</span>
                                {lang === 'ar' && <span className="text-sm font-black uppercase tracking-widest opacity-80">Sanfoor</span>}
                            </div>
                        </div>
                        <button onClick={() => setMobileOpen(false)} className="text-3xl opacity-70 hover:opacity-100 transition-opacity">&times;</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
                        <Link onClick={() => setMobileOpen(false)} href="/" className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">🏠 {t.home}</Link>
                        
                        <Link onClick={() => setMobileOpen(false)} href={route('tree.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">🌳 {t.tree}</Link>
                        <Link onClick={() => setMobileOpen(false)} href={route('calculator.index')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">📈 {t.calc}</Link>
                        <Link onClick={() => setMobileOpen(false)} href={route('campus.directory')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">🏢 {t.directory}</Link>
                        <Link onClick={() => setMobileOpen(false)} href={route('ai.advisor')} className="px-4 py-4 mt-2 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-center shadow-lg shadow-indigo-500/30 hover:opacity-90 transition-opacity">🤖 {t.ai}</Link>
                        
                        {auth.user && (
                            <>
                                {isAdminOrOwner && (
                                    <Link onClick={() => setMobileOpen(false)} href={route('admin.dashboard')} className="px-4 py-3.5 rounded-2xl font-black text-sm bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 mb-2 mt-2 transition-colors">🛡️ {t.admin}</Link>
                                )}
                                <Link onClick={() => setMobileOpen(false)} href={route('dashboard')} className="px-4 py-3.5 rounded-2xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">📊 {t.dashboard}</Link>
                            </>
                        )}
                        
                        {!auth.user && <Link onClick={() => setMobileOpen(false)} href={route('login')} className="px-4 py-4 mt-2 rounded-2xl font-black text-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-center hover:scale-[1.02] transition-transform">{t.login}</Link>}
                    </div>

                    {auth.user && (
                        <div className="p-4 border-t border-slate-100 dark:border-white/5">
                            <Link href={route('logout')} method="post" as="button" className="w-full py-3.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 font-bold text-sm transition-colors hover:bg-rose-100 dark:hover:bg-rose-500/20">👋 {t.logout}</Link>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col w-full relative z-10 pt-28 sm:pt-40 animate-fade-in-up">
                {children}
            </main>

            {/* AI WIDGET */}
            {auth.user && <AiWidget user={auth.user} />}

            {/* PREMIUM FOOTER */}
            <footer className={`relative transition-colors duration-500 overflow-hidden mt-12 ${isDark ? 'bg-[#050B14] border-t border-white/5' : 'bg-[#050B14] text-white'}`}>
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50"></div>
                
                {/* Subtle glowing orb in background */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-12 border-b border-white/10 pb-16">

                        <div className="md:col-span-5 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center p-2.5 shadow-lg">
                                    <img src="/images/sanfoor.png" alt="Logo" className="w-full h-full object-contain hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div className="flex flex-col leading-none">
                                    <h3 className="text-3xl font-black text-white pb-1">{lang === 'ar' ? 'سنفور' : 'Sanfoor'}</h3>
                                    {lang === 'ar' && <span className="text-sm font-black text-indigo-400 tracking-[0.25em] uppercase">Sanfoor</span>}
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">{t.footerDesc}</p>
                        </div>

                        <div className="md:col-span-3 space-y-5">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">{t.quickLinks}</h4>
                            <ul className="space-y-3">
                                <li><Link href="/" className="text-slate-400 hover:text-indigo-400 hover:translate-x-1 transition-all text-sm font-bold flex items-center gap-2"><span>🏠</span> {t.home}</Link></li>
                                <li><Link href={route('tree.index')} className="text-slate-400 hover:text-indigo-400 hover:translate-x-1 transition-all text-sm font-bold flex items-center gap-2"><span>🌳</span> {t.tree}</Link></li>
                                <li><Link href={route('calculator.index')} className="text-slate-400 hover:text-indigo-400 hover:translate-x-1 transition-all text-sm font-bold flex items-center gap-2"><span>📈</span> {t.calc}</Link></li>
                                <li><Link href={route('campus.directory')} className="text-slate-400 hover:text-indigo-400 hover:translate-x-1 transition-all text-sm font-bold flex items-center gap-2"><span>🏢</span> {t.directory}</Link></li>
                                <li><Link href={route('ai.advisor')} className="text-slate-400 hover:text-indigo-400 hover:translate-x-1 transition-all text-sm font-bold flex items-center gap-2"><span>🤖</span> {t.ai}</Link></li>
                            </ul>
                        </div>

                        <div className="md:col-span-4 space-y-5 flex flex-col md:items-end">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest">{t.systemStatus}</h4>
                            
                            {/* 🔥 مربع حالة النظام الاحترافي 🔥 */}
                            <div className="w-full max-w-[260px] bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_10px_30px_-15px_rgba(79,70,229,0.3)] group">
                                <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-300 transition-colors">{t.aiEngine}</span>
                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_#34d399]"></span>
                                        Online
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-300 transition-colors">{t.version}</span>
                                    <span className="text-[11px] font-black text-white bg-white/10 px-2 py-0.5 rounded border border-white/5 flex items-center gap-1.5">
                                        v2.1.4 <span className="text-indigo-400 text-[9px] bg-indigo-500/10 px-1 rounded">BETA</span>
                                    </span>
                                </div>
                            </div>
                            
                        </div>
                    </div>

                    {/* 🔥 حقوق النشر مع حساب LinkedIn 🔥 */}
                    <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-slate-500 text-[11px] font-bold tracking-wide">
                            &copy; {new Date().getFullYear()} {lang === 'ar' ? 'سنفور' : 'Sanfoor'}. Developed by{' '}
                            <a 
                                href="https://www.linkedin.com/in/asem-alkhabbas-667471371/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-indigo-400 hover:text-indigo-300 transition-all duration-300 relative group inline-block"
                            >
                                Asem Alkhabbas
                                <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-indigo-400 transition-all duration-300 group-hover:w-full"></span>
                            </a>.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
