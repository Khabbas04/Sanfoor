import React, { useState, useEffect } from 'react';
import { Link, usePage, Head } from '@inertiajs/react';

export default function MainLayout({ children }) {
    const { auth } = usePage().props;
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

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

    return (
        <div className="min-h-screen bg-[#fafcff] text-right selection:bg-indigo-100 selection:text-indigo-900 flex flex-col font-sans" dir="rtl">
            <Head>
                <style>{`
                    * { scroll-behavior: smooth; }
                    ::-webkit-scrollbar { width: 6px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                    ::-webkit-scrollbar-thumb:hover { background: #818cf8; }
                    
                    @keyframes slideDownMenu {
                        from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .animate-dropdown { animation: slideDownMenu 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                    
                    /* Floating Header Animation */
                    .nav-capsule { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
                    .nav-scrolled {
                        width: 90% !important;
                        max-width: 1200px !important;
                        top: 15px !important;
                        border-radius: 2rem !important;
                        background: rgba(255, 255, 255, 0.85) !important;
                        backdrop-filter: blur(20px) !important;
                        box-shadow: 0 10px 40px -10px rgba(79,70,229,0.15) !important;
                        border: 1px solid rgba(255,255,255,0.8) !important;
                    }
                `}</style>
            </Head>

            {/* =========================================
                1. MODERN FLOATING NAVBAR
            ========================================= */}
            <div className="fixed top-0 w-full z-[100] flex justify-center px-4 transition-all duration-500 pointer-events-none">
                <nav className={`nav-capsule pointer-events-auto w-full max-w-[1400px] top-0 h-[72px] sm:h-20 bg-transparent border-b border-transparent ${scrolled ? 'nav-scrolled' : ''}`}>
                    <div className="h-full px-4 sm:px-6 lg:px-8 flex justify-between items-center">

                        {/* 🔥 Logo 🔥 */}
                        <Link href="/" className="flex items-center gap-3 group relative">
                            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3">
                                <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-md" />
                            </div>
                            <div className="flex flex-col relative pt-1">
                                <span className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight leading-none group-hover:from-indigo-600 group-hover:to-cyan-600 transition-all duration-300">
                                    سنفور
                                </span>
                                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 tracking-[0.3em] uppercase mt-1">
                                    Sanfoor AI
                                </span>
                            </div>
                        </Link>

                        {/* 🔥 Central Links (Desktop) 🔥 */}
                        <div className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/60 backdrop-blur-md rounded-[1.25rem] border border-white/60 shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]">
                            <Link href="/" className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('welcome') ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/40'}`}>
                                <span className="text-base group-hover:scale-110 transition-transform">🏠</span> الرئيسية
                            </Link>

                            {auth.user && (
                                <>
                                    <Link href={route('tree.index')} className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('tree.index') ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/40'}`}>
                                        <span className="text-base group-hover:scale-110 transition-transform">🌳</span> المسار الشجري
                                    </Link>
                                    <Link href={route('calculator.index')} className={`flex items-center gap-2 px-5 py-2 text-[13px] font-bold transition-all duration-300 rounded-xl group ${route().current('calculator.index') ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-900 hover:bg-white/40'}`}>
                                        <span className="text-base group-hover:scale-110 transition-transform">📈</span> حاسبة التفوّق
                                    </Link>
                                    <Link href={route('ai.advisor')} className={`flex items-center gap-2 px-5 py-2 text-[13px] font-black transition-all duration-300 rounded-xl relative overflow-hidden group ${route().current('ai.advisor') ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' : 'text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100/50'}`}>
                                        <span className="relative z-10 flex items-center gap-2">
                                            <span className="group-hover:animate-pulse">🤖</span> المستشار الذكي
                                        </span>
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* 🔥 User Profile / Auth 🔥 */}
                        <div className="flex items-center gap-3">
                            {auth.user ? (
                                <div className="relative group hidden lg:block">
                                    <button className="flex items-center gap-3 pl-2 pr-1.5 py-1.5 rounded-[1.25rem] bg-white border border-slate-200 hover:border-indigo-300 transition-all duration-300 shadow-sm hover:shadow-md">
                                        
                                        {/* بيانات المستخدم والتخصص (أضيفت هنا) */}
                                        <div className="flex flex-col items-end leading-none ml-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[13px] font-black text-slate-800">{auth.user.name.split(' ')[0]}</span>
                                                {auth.user.role === 'admin' ? (
                                                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[8px] font-black rounded uppercase">مدير نظام</span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase">طالب</span>
                                                )}
                                            </div>
                                            {/* إظهار التخصص تحت الاسم */}
                                            {auth.user.role === 'student' && auth.user.major && (
                                                <span className="text-[10px] font-bold text-slate-400 mt-1 max-w-[100px] truncate" title={auth.user.major.name}>
                                                    {auth.user.major.name}
                                                </span>
                                            )}
                                        </div>

                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center font-black text-sm shadow-inner relative overflow-hidden">
                                            {auth.user.name.charAt(0)}
                                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                                        </div>
                                    </button>

                                    {/* Dropdown */}
                                    <div className="absolute left-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                                        <div className="w-64 bg-white/95 backdrop-blur-2xl rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-slate-100 p-2 overflow-hidden animate-dropdown">
                                            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50 rounded-xl mb-2">
                                                <p className="text-[10px] text-slate-400 font-bold mb-1">الحساب الجامعي</p>
                                                <p className="text-xs font-black text-slate-800 truncate">{auth.user.email}</p>
                                            </div>
                                            
                                            <div className="space-y-1">
                                                {auth.user.role === 'admin' && (
                                                    <Link href={route('admin.dashboard')} className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors hover:bg-slate-900 group/admin bg-slate-800/5 mb-2">
                                                        <div className="flex items-center gap-3 text-sm font-bold text-slate-900 group-hover/admin:text-white">
                                                            <span className="text-lg opacity-80 group-hover/admin:scale-110 transition-transform">🛡️</span> لوحة الإدارة
                                                        </div>
                                                        <span className="text-[9px] bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded font-black">PRO</span>
                                                    </Link>
                                                )}

                                                <Link href={route('dashboard')} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-indigo-50 text-sm font-bold text-slate-700 hover:text-indigo-700">
                                                    <span className="text-lg opacity-80">📊</span> لوحة التحكم
                                                </Link>
                                                <Link href={route('profile.edit')} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-slate-50 text-sm font-bold text-slate-700 hover:text-slate-900">
                                                    <span className="text-lg opacity-80">⚙️</span> إعدادات الحساب
                                                </Link>
                                                <div className="my-1 border-t border-slate-50"></div>
                                                <Link href={route('logout')} method="post" as="button" className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-rose-50 text-sm font-bold text-rose-600">
                                                    <span className="text-lg opacity-80">👋</span> تسجيل الخروج
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Link href={route('login')} className="hidden lg:inline-flex bg-slate-900 text-white px-7 py-2.5 rounded-xl font-black text-[13px] shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 hover:shadow-xl hover:bg-indigo-600 transition-all active:scale-95">
                                    تسجيل الدخول
                                </Link>
                            )}

                            {/* Mobile Menu Button */}
                            <button onClick={() => setMobileOpen(!mobileOpen)} className={`lg:hidden relative w-11 h-11 rounded-[1.25rem] flex items-center justify-center transition-all active:scale-95 z-[101] ${mobileOpen ? 'bg-slate-100 text-slate-900' : 'bg-white border border-slate-200 text-slate-700 shadow-sm'}`}>
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

            {/* =========================================
                2. MOBILE MENU
            ========================================= */}
            <div className={`fixed inset-0 z-[100] lg:hidden transition-all duration-500 ease-in-out ${mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                <div className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-500 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setMobileOpen(false)}></div>
                <div className={`absolute top-0 right-0 w-[85%] max-w-sm h-full bg-white shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    
                    <div className="h-24 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-slate-50/80">
                        <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
                            <img src="/images/sanfoor.png" alt="Logo" className="w-14 h-14 object-contain drop-shadow-sm" />
                            <div className="flex flex-col">
                                <span className="text-2xl font-black text-slate-900">سنفور</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mobile</span>
                            </div>
                        </Link>
                    </div>

                    <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
                        {auth.user && auth.user.role === 'admin' && (
                            <Link onClick={() => setMobileOpen(false)} href={route('admin.dashboard')} className="flex items-center justify-between px-4 py-4 rounded-2xl font-black text-sm bg-slate-900 text-white shadow-lg mb-2">
                                <span className="flex items-center gap-3"><span className="text-xl">🛡️</span> لوحة الإدارة</span>
                                <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md">ADMIN</span>
                            </Link>
                        )}
                        <Link onClick={() => setMobileOpen(false)} href="/" className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-colors ${route().current('welcome') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                            <span className="text-lg">🏠</span> الرئيسية
                        </Link>

                        {auth.user && (
                            <>
                                <Link onClick={() => setMobileOpen(false)} href={route('dashboard')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-colors ${route().current('dashboard') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <span className="text-lg">📊</span> لوحة التحكم
                                </Link>
                                <Link onClick={() => setMobileOpen(false)} href={route('tree.index')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-colors ${route().current('tree.index') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <span className="text-lg">🌳</span> الخريطة الشجرية
                                </Link>
                                <Link onClick={() => setMobileOpen(false)} href={route('calculator.index')} className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-sm transition-colors ${route().current('calculator.index') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <span className="text-lg">📈</span> حاسبة المعدل
                                </Link>
                                <div className="my-2 border-t border-slate-100"></div>
                                <Link onClick={() => setMobileOpen(false)} href={route('ai.advisor')} className="flex items-center justify-center gap-3 px-4 py-4 mt-2 rounded-2xl font-black text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg active:scale-95 transition-transform">
                                    <span className="animate-pulse text-lg">🤖</span> المستشار الأكاديمي
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 pb-safe">
                        {auth.user ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 px-2 mb-4">
                                    <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-slate-800 to-slate-700 text-white flex items-center justify-center font-black text-base shadow-inner">
                                        {auth.user.name.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-black text-slate-900 truncate">{auth.user.name}</p>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${auth.user.role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>{auth.user.role === 'admin' ? 'مدير' : 'طالب'}</span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">{auth.user.email}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Link onClick={() => setMobileOpen(false)} href={route('profile.edit')} className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl active:bg-slate-50">
                                        ⚙️ الإعدادات
                                    </Link>
                                    <Link onClick={() => setMobileOpen(false)} href={route('logout')} method="post" as="button" className="flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 border border-rose-100 text-[11px] font-bold rounded-xl active:bg-rose-100">
                                        👋 خروج
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Link onClick={() => setMobileOpen(false)} href={route('login')} className="flex items-center justify-center w-full bg-slate-900 text-white py-3.5 rounded-xl font-black text-sm shadow-md active:scale-95 transition-transform">
                                    تسجيل الدخول
                                </Link>
                                <Link onClick={() => setMobileOpen(false)} href={route('register')} className="flex items-center justify-center w-full bg-white border-2 border-slate-200 text-slate-700 py-3 rounded-xl font-black text-sm active:bg-slate-50 transition-colors">
                                    حساب جديد
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* =========================================
                3. MAIN CONTENT
            ========================================= */}
            <main className="flex-1 flex flex-col w-full relative z-10 pt-20 sm:pt-28">
                {children}
            </main>

            {/* =========================================
                4. NEW PREMIUM FOOTER
            ========================================= */}
            <footer className="relative bg-[#050B14] text-white overflow-hidden mt-12">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent"></div>
                <div className="absolute -top-[300px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-12 border-b border-white/10 pb-16">
                        
                        {/* Brand Section */}
                        <div className="md:col-span-5 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center p-2.5 backdrop-blur-md">
                                    <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-lg" />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-3xl font-black tracking-tight text-white">سنفور</h3>
                                    <span className="text-[10px] font-black text-indigo-400 tracking-[0.25em] uppercase mt-1">Sanfoor AI</span>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-medium">
                                المساعد الأكاديمي الرقمي الأول لطلاب الجامعات. ندمج الذكاء الاصطناعي في رحلتك الدراسية لنضمن لك تخطيطاً ذكياً وتخرجاً مبكراً.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div className="md:col-span-3 space-y-5">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest mb-2">روابط سريعة</h4>
                            <ul className="space-y-3">
                                <li><Link href="/" className="text-slate-400 hover:text-indigo-400 hover:-translate-x-1 inline-block transition-all text-sm font-bold">🏠 الصفحة الرئيسية</Link></li>
                                <li><Link href={route('tree.index')} className="text-slate-400 hover:text-indigo-400 hover:-translate-x-1 inline-block transition-all text-sm font-bold">🌳 الخطة الشجرية</Link></li>
                                <li><Link href={route('calculator.index')} className="text-slate-400 hover:text-indigo-400 hover:-translate-x-1 inline-block transition-all text-sm font-bold">📈 حاسبة المعدل</Link></li>
                                <li><Link href={route('ai.advisor')} className="text-slate-400 hover:text-indigo-400 hover:-translate-x-1 inline-block transition-all text-sm font-bold">🤖 المستشار الذكي</Link></li>
                            </ul>
                        </div>

                        {/* System Status */}
                        <div className="md:col-span-4 space-y-5 flex flex-col md:items-end">
                            <h4 className="text-white font-black text-sm uppercase tracking-widest mb-2">حالة النظام</h4>
                            <div className="w-full max-w-[260px] bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-slate-400">الذكاء الاصطناعي</span>
                                    <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Online</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-400">قاعدة البيانات</span>
                                    <span className="text-[11px] font-black text-white">متصلة • جامعة الزرقاء</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-slate-500 text-[11px] font-bold">
                            &copy; {new Date().getFullYear()} <span className="text-white font-black">سنفور</span>. جميع الحقوق محفوظة.
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-slate-300 flex items-center gap-2">
                                <span className="text-indigo-400 text-sm">✦</span> Developed by Kollia Team
                            </span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}