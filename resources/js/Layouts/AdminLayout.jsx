import React, { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

// AdminLayout wraps all admin pages with a shared sidebar, header, and logout flow.
export default function AdminLayout({ children }) {
    const { auth = {}, admin_notifications: adminNotifications = {}, flash = {} } = usePage().props || {};
    const message = flash?.message;
    const type = flash?.type;

    // Role and notification state is shared from Inertia middleware.
    const role = (auth?.user?.role || '').toLowerCase().trim();
    const isOwner = Boolean(auth?.user?.is_owner) || role === 'owner';
    const openIssuesCount = Number(adminNotifications?.open_issues_count || 0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const { isDark, toggleTheme } = useTheme();
    const { lang, toggleLang } = useLanguage();

    const translations = {
        ar: {
            dashboard: 'الإحصائيات العامة',
            issues: 'بلاغات الطلاب',
            contactMessages: 'طلبات التواصل',
            demand: 'تحليل طلب المواد',
            courses: 'الشجرة والمواد',
            chapters: 'إدارة الشابترز',
            questions: 'إدارة الأسئلة',
            structure: 'الكليات والتخصصات',
            collegesDirectory: 'بطاقات الكليات',
            campusLandmarks: 'معالم الجامعة',
            logs: 'سجل العمليات',
            students: 'إدارة الطلاب',
            admins: 'إدارة الأدمنز',
            settings: 'الإعدادات',
            mainMenu: 'القائمة الرئيسية',
            online: 'أونلاين',
            safeLogout: 'خروج آمن من النظام',
            studentProfile: 'بروفايل الطالب',
            frontEnd: 'الواجهة الأمامية',
            site: 'الموقع',
            pageTitles: {
                'admin.dashboard': 'لوحة الإدارة المركزية',
                'admin.settings': 'إعدادات الإدارة',
                'admin.courses': 'إدارة الشجرة والمواد',
                'admin.chapters.index': 'إدارة الشابترز',
                'admin.questions.index': 'إدارة الأسئلة',
                'admin.structure': 'إدارة الكليات والتخصصات',
                'admin.logs': 'سجل عمليات الإدارة',
                'admin.students.index': 'إدارة الطلاب',
                'admin.issues.index': 'بلاغات الطلاب',
                'admin.contact_messages.index': 'طلبات التواصل',
                'admin.reports.demand': 'تحليل طلب المواد',
                'admin.admins.index': 'إدارة الأدمنز',
                'admin.colleges.index': 'بطاقات الكليات',
                'admin.colleges.create': 'إضافة كلية',
                'admin.colleges.edit': 'تعديل كلية',
                'admin.landmarks.index': 'معالم الجامعة',
                'admin.landmarks.create': 'إضافة معلم',
                'admin.landmarks.edit': 'تعديل معلم',
            },
            defaultTitle: 'لوحة الأدمن',
        },
        en: {
            dashboard: 'General Stats',
            issues: 'Student Reports',
            contactMessages: 'Contact Requests',
            demand: 'Course Demand',
            courses: 'Tree & Courses',
            chapters: 'Manage Chapters',
            questions: 'Manage Questions',
            structure: 'Colleges & Majors',
            collegesDirectory: 'College Cards',
            campusLandmarks: 'Campus Landmarks',
            logs: 'Activity Log',
            students: 'Manage Students',
            admins: 'Manage Admins',
            settings: 'Settings',
            mainMenu: 'Main Menu',
            online: 'Online',
            safeLogout: 'Secure Logout',
            studentProfile: 'Student Profile',
            frontEnd: 'Front Website',
            site: 'Site',
            pageTitles: {
                'admin.dashboard': 'Admin Control Center',
                'admin.settings': 'Admin Settings',
                'admin.courses': 'Tree & Courses',
                'admin.chapters.index': 'Manage Chapters',
                'admin.questions.index': 'Manage Questions',
                'admin.structure': 'Colleges & Majors',
                'admin.logs': 'Activity Log',
                'admin.students.index': 'Manage Students',
                'admin.issues.index': 'Student Reports',
                'admin.contact_messages.index': 'Contact Requests',
                'admin.reports.demand': 'Course Demand Analysis',
                'admin.admins.index': 'Manage Admins',
                'admin.colleges.index': 'College Cards',
                'admin.colleges.create': 'Create College',
                'admin.colleges.edit': 'Edit College',
                'admin.landmarks.index': 'Campus Landmarks',
                'admin.landmarks.create': 'Create Landmark',
                'admin.landmarks.edit': 'Edit Landmark',
            },
            defaultTitle: 'Admin Panel',
        },
    };
    const t = translations[lang] || translations.ar;

    const getCurrentRouteName = () => {
        try {
            return route().current();
        } catch (e) {
            return '';
        }
    };

    const safeRoute = (name, params) => {
        try {
            return route(name, params);
        } catch (e) {
            console.warn(`Admin route "${name}" not found.`);
            const map = {
                'admin.dashboard': '/admin/dashboard',
                'admin.courses': '/admin/courses',
                'admin.chapters.index': '/admin/chapters',
                'admin.questions.index': '/admin/questions',
                'admin.structure': '/admin/structure',
                'admin.students.index': '/admin/students',
                'admin.logs': '/admin/logs',
                'admin.settings': '/admin/settings',
            };
            return map[name] || '#';
        }
    };


    const currentRouteName = getCurrentRouteName();
    const currentPageTitle = t.pageTitles[currentRouteName] || t.defaultTitle;

    const flashType = String(type || '').toLowerCase();
    const flashClass = flashType === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
        : flashType === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';

    // Sidebar menu organized into logical sections for clearer navigation.
    const menuSections = [
        {
            label: lang === 'ar' ? 'نظرة عامة' : 'Overview',
            items: [
                { icon: '📊', name: t.dashboard, route: 'admin.dashboard', pattern: 'admin.dashboard' },
                { icon: '🔥', name: t.demand, route: 'admin.reports.demand', pattern: 'admin.reports.*' },
            ],
        },
        {
            label: lang === 'ar' ? 'المحتوى التعليمي' : 'Content',
            items: [
                { icon: '📚', name: t.courses, route: 'admin.courses', pattern: 'admin.courses' },
                { icon: '📖', name: t.chapters, route: 'admin.chapters.index', pattern: 'admin.chapters.*' },
                { icon: '❓', name: t.questions, route: 'admin.questions.index', pattern: 'admin.questions.*' },
            ],
        },
        {
            label: lang === 'ar' ? 'البنية الأكاديمية' : 'Academic',
            items: [
                { icon: '🏛️', name: t.structure, route: 'admin.structure', pattern: 'admin.structure|admin.majors.*|admin.majors' },
                { icon: '🧩', name: t.collegesDirectory, route: 'admin.colleges.index', pattern: 'admin.colleges.*' },
                { icon: '📍', name: t.campusLandmarks, route: 'admin.landmarks.index', pattern: 'admin.landmarks.*' },
            ],
        },
        {
            label: lang === 'ar' ? 'المستخدمون والدعم' : 'Users & Support',
            items: [
                { icon: '👨‍🎓', name: t.students, route: 'admin.students.index', pattern: 'admin.students.*' },
                { icon: '🛠️', name: t.issues, route: 'admin.issues.index', pattern: 'admin.issues.*', badge: openIssuesCount },
                { icon: '📩', name: t.contactMessages, route: 'admin.contact_messages.index', pattern: 'admin.contact_messages.*' },
                ...(isOwner ? [{ icon: '👑', name: t.admins, route: 'admin.admins.index', pattern: 'admin.admins.*' }] : []),
            ],
        },
        {
            label: lang === 'ar' ? 'النظام' : 'System',
            items: [
                { icon: '📜', name: t.logs, route: 'admin.logs', pattern: 'admin.logs' },
                ...(isOwner ? [{ icon: '🕵️', name: lang === 'ar' ? 'سجل المالك' : 'Owner Logs', route: 'admin.owner.logs', pattern: 'admin.owner.logs' }] : []),
                { icon: '⚙️', name: t.settings, route: 'admin.settings', pattern: 'admin.settings' },
            ],
        },
    ];

    // Support pipe-separated route patterns so one item can cover multiple screens.
    const isRouteActive = (pattern) => {
        if (!pattern) return false;
        try {
            const patterns = pattern.split('|').map((p) => p.trim()).filter(Boolean);
            return patterns.some((p) => {
                if (p.includes('*')) return route().current(p);
                return route().current(p) || route().current(`${p}.*`);
            });
        } catch (e) {
            return false;
        }
    };

    return (
        <div className={`min-h-screen transition-colors duration-300 text-right flex flex-col font-sans selection:bg-indigo-200 selection:text-indigo-900 relative ${isDark ? 'bg-[#0d1117]' : 'bg-[#f8fafc]'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            
            {/* Decorative grid background for the whole admin experience. */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.04] z-0" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>

            {/* Tap outside the sidebar on mobile to close it. */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40 lg:hidden transition-all duration-500"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Primary admin navigation sidebar. */}
            <aside className={`fixed top-0 right-0 h-full w-72 bg-[#0b0f19] text-slate-300 shadow-[25px_0_50px_rgba(0,0,0,0.2)] z-50 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] border-l border-slate-800 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>

                {/* Logo Section */}
                <div className="h-24 flex items-center justify-between px-6 border-b border-white/5 bg-white/[0.01] shrink-0 relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                    <Link href="/" className="flex items-center gap-3 group relative z-10">
                        <div className="relative w-12 h-12 flex items-center justify-center transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                            <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <img 
                                src="/images/sanfoor.png" 
                                alt="Sanfoor Logo" 
                                className="w-full h-full object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.5)] rounded-full relative z-10" 
                            />
                        </div>
                        <div className="flex flex-col pt-1">
                            <h1 className="text-2xl font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors leading-none">سنفور</h1>
                            <span className="text-[10px] font-black text-indigo-400 tracking-[0.2em] uppercase mt-1.5 bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block w-max border border-indigo-500/20">Admin Core</span>
                        </div>
                    </Link>
                    <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white bg-slate-800/80 hover:bg-indigo-600 rounded-xl transition-all">✕</button>
                </div>

                {/* User Info Section */}
                <div className="p-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-50"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-2xl font-black shadow-xl border border-white/20 relative group overflow-hidden">
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                            <span className="relative z-10">{auth?.user?.name?.charAt(0) ?? '?'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.15em] mb-1">
                                {isOwner ? 'OWNER' : 'ADMIN'}
                            </p>
                            <p className="font-black text-[15px] text-white truncate drop-shadow-sm">{auth?.user?.name ?? ''}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                </div>
                                <span className="text-[10px] text-emerald-400 font-black">{t.online}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Render sidebar links organized by section */}
                <nav className="flex-1 overflow-y-auto py-2 px-4 space-y-1 scrollbar-hide">
                    {menuSections.map((section, sIdx) => (
                        <div key={sIdx} className={sIdx > 0 ? 'mt-4' : ''}>
                            <p className="px-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.25em] mb-2 mt-2 flex items-center gap-2">
                                <span className="flex-1 h-px bg-slate-800"></span>
                                <span className="shrink-0">{section.label}</span>
                                <span className="flex-1 h-px bg-slate-800"></span>
                            </p>
                            {section.items.map((item, index) => {
                                const active = isRouteActive(item.pattern);
                                const href = item.route === '#' ? '#' : safeRoute(item.route);

                                return (
                                    <Link
                                        key={index}
                                        href={href}
                                        className={`relative flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-300 group overflow-hidden border mb-0.5
                                            ${active 
                                                ? 'text-white border-white/10 shadow-[0_8px_24px_-8px_rgba(79,70,229,0.5)]' 
                                                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                                            }
                                        `}
                                    >
                                        {active && <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-700"></div>}
                                        <span className={`relative z-10 text-lg transition-all duration-500 ${active ? 'scale-110' : 'grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110'}`}>
                                            {item.icon}
                                        </span>
                                        <span className={`relative z-10 font-black text-[12px] tracking-wide transition-colors ${active ? 'text-white' : 'group-hover:text-white'}`}>
                                            {item.name}
                                        </span>
                                        {item.badge > 0 && (
                                            <span className="relative z-10 mr-auto min-w-[20px] h-[20px] px-1 rounded-md bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.4)]">
                                                {item.badge > 99 ? '99+' : item.badge}
                                            </span>
                                        )}
                                        {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full shadow-[0_0_12px_#fff]"></div>}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Footer Section */}
                <div className="p-5 border-t border-white/5 bg-slate-950/60 backdrop-blur-md">
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="w-full flex items-center justify-center gap-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 py-4 rounded-2xl hover:bg-rose-600 hover:text-white transition-all font-black text-[11px] group shadow-lg"
                    >
                        <span className="text-lg group-hover:-translate-x-1 group-hover:rotate-12 transition-transform">👋</span>
                        {t.safeLogout}
                    </Link>
                </div>
            </aside>

            {/* Main admin content panel. */}
            <main className="lg:mr-72 flex-1 flex flex-col min-h-screen transition-all duration-500 relative z-10">

                {/* Header Navbar */}
                <header className={`backdrop-blur-3xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border-b h-20 flex items-center px-6 md:px-10 justify-between sticky top-0 z-30 transition-colors duration-300 ${isDark ? 'bg-[#0b0f19]/90 border-slate-800' : 'bg-white/80 border-slate-200/80'}`}>
                    <div className="flex items-center gap-5">
                        <button onClick={() => setIsSidebarOpen(true)} className={`lg:hidden p-3 rounded-2xl border text-slate-600 hover:text-indigo-600 transition-all shadow-sm active:scale-90 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-indigo-50'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                        </button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                <span className={`font-black text-[15px] tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{currentPageTitle}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5 ml-4 italic opacity-70">Infrastructure v2.1.4</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-4">
                        {/* Language Toggle */}
                        <button
                            onClick={toggleLang}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border transition-all active:scale-90 hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 border-slate-700 text-indigo-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-indigo-600 hover:bg-slate-200'}`}
                        >
                            {lang === 'ar' ? 'EN' : 'AR'}
                        </button>
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border transition-all active:scale-90 hover:-translate-y-0.5 ${isDark ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}
                        >
                            {isDark ? '☀️' : '🌙'}
                        </button>
                        <Link
                            href={route('dashboard')}
                            className={`hidden sm:flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all shadow-inner active:scale-95 ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white'}`}
                        >
                            <span>👤</span> {t.studentProfile}
                        </Link>
                        <Link
                            href="/"
                            className="flex items-center gap-2.5 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl hover:shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] hover:-translate-y-0.5 text-[11px] font-black transition-all group"
                        >
                            <span className="text-base group-hover:scale-125 transition-transform duration-500">🌐</span> 
                            <span className="hidden md:inline">{t.frontEnd}</span>
                            <span className="md:hidden">{t.site}</span>
                        </Link>
                    </div>
                </header>

                {/* Children Content */}
                <div className="p-5 md:p-10 flex-1">
                    <div className="max-w-[1600px] mx-auto">
                        {message && (
                            <div className={`mb-6 px-4 py-3 rounded-2xl border text-sm font-black ${flashClass}`}>
                                {message}
                            </div>
                        )}
                        {children}
                    </div>
                </div>

                <footer className={`px-5 md:px-10 pb-6 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <p className="text-[11px] font-black uppercase tracking-[0.12em]">By Asem Alkhabbas</p>
                </footer>
                
                {/* Layout-scoped utility styles for the admin shell. */}
                <style dangerouslySetInnerHTML={{ __html: `
                    .scrollbar-hide::-webkit-scrollbar { display: none; }
                    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                    
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(15px) scale(0.99); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .animate-fade-in-up {
                        animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }

                    ::selection {
                        background: #4f46e5;
                        color: white;
                    }
                ` }} />
            </main>
        </div>
    );
}