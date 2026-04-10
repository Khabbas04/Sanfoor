import React, { useMemo, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import ClearCacheButton from '@/Components/Admin/ClearCacheButton';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';
import { useOnlinePolling } from '@/Hooks/useOnlinePolling';

const translations = {
    ar: {
        title: 'إعدادات الإدارة',
        subtitle: 'مساحة موحدة لإدارة المستخدمين الأونلاين وإجراءات إدارة الأدمن.',
        tabOnline: 'الأشخاص الأونلاين',
        tabAdmin: 'إدارة الأدمن',
        onlineNow: 'متصل الآن',
        activeStudents: 'طلاب نشطون',
        activeAdmins: 'أدمن نشط',
        noOnlineUsers: 'لا يوجد مستخدمون متصلون حالياً.',
        adminToolsTitle: 'أدوات إدارة النظام',
        adminToolsDesc: 'كل أدوات التحكم الإدارية في مكان واحد بدل الداشبورد.',
        manageAdmins: 'إدارة الأدمنز',
        manageStudents: 'إدارة الطلاب',
        reports: 'بلاغات الطلاب',
        structure: 'الكليات والتخصصات',
        courses: 'الشجرة والمواد',
        logs: 'سجل العمليات',
        demand: 'تحليل الطلب',
        roleOwner: 'مالك',
        roleAdmin: 'أدمن',
        roleStudent: 'طالب',
    },
    en: {
        title: 'Admin Settings',
        subtitle: 'A unified space for online users and admin-management actions.',
        tabOnline: 'Online Users',
        tabAdmin: 'Admin Management',
        onlineNow: 'Online Now',
        activeStudents: 'Active Students',
        activeAdmins: 'Active Admins',
        noOnlineUsers: 'No users are currently online.',
        adminToolsTitle: 'Administration Tools',
        adminToolsDesc: 'All admin controls in one place instead of Dashboard.',
        manageAdmins: 'Manage Admins',
        manageStudents: 'Manage Students',
        reports: 'Student Reports',
        structure: 'Colleges & Majors',
        courses: 'Tree & Courses',
        logs: 'Activity Log',
        demand: 'Demand Analysis',
        roleOwner: 'Owner',
        roleAdmin: 'Admin',
        roleStudent: 'Student',
    },
};

function roleLabel(role, t) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'owner') return t.roleOwner;
    if (normalized === 'admin') return t.roleAdmin;
    return t.roleStudent;
}

export default function Settings({ stats = {}, onlineUsers = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const { auth } = usePage().props;
    const t = translations[lang] || translations.ar;
    const isOwner = String(auth?.user?.role || '').toLowerCase() === 'owner';

    const [activeTab, setActiveTab] = useState('online');

    const initialOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
    const { onlineUsers: liveOnlineUsers, stats: liveStats } = useOnlinePolling(initialOnlineUsers, stats || {});

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const cardSoft = isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';

    const adminActions = useMemo(() => {
        const actions = [
            { title: t.manageStudents, href: route('admin.students.index'), icon: '👨‍🎓' },
            { title: t.reports, href: route('admin.issues.index'), icon: '🛠️' },
            { title: t.structure, href: route('admin.structure'), icon: '🏛️' },
            { title: t.courses, href: route('admin.courses'), icon: '🌳' },
            { title: t.logs, href: route('admin.logs'), icon: '📜' },
            { title: t.demand, href: route('admin.reports.demand'), icon: '🔥' },
        ];

        if (isOwner) {
            actions.unshift({ title: t.manageAdmins, href: route('admin.admins.index'), icon: '👑' });
        }

        return actions;
    }, [isOwner, t]);

    return (
        <AdminLayout>
            <Head title={`${t.title} | سنفور`} />

            <div className="space-y-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className={`${card} rounded-3xl p-6 sm:p-8 border`}>
                    <h1 className={`text-2xl sm:text-3xl font-black ${heading}`}>{t.title}</h1>
                    <p className={`mt-2 text-sm font-bold ${subtext}`}>{t.subtitle}</p>

                    <div className="mt-5 inline-flex rounded-2xl p-1 bg-indigo-500/10 border border-indigo-500/20">
                        <button
                            onClick={() => setActiveTab('online')}
                            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'online' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-100/60'}`}
                        >
                            {t.tabOnline}
                        </button>
                        <button
                            onClick={() => setActiveTab('admin')}
                            className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'admin' ? 'bg-indigo-600 text-white' : 'text-indigo-600 hover:bg-indigo-100/60'}`}
                        >
                            {t.tabAdmin}
                        </button>
                    </div>
                </div>

                {activeTab === 'online' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Stat title={t.onlineNow} value={liveOnlineUsers.length} icon="🟢" isDark={isDark} />
                            <Stat title={t.activeStudents} value={liveStats.active_students_now || 0} icon="👨‍🎓" isDark={isDark} />
                            <Stat title={t.activeAdmins} value={liveStats.active_admins_now || 0} icon="⚙️" isDark={isDark} />
                        </div>

                        <div className={`${card} rounded-3xl p-6 border`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {liveOnlineUsers.length > 0 ? (
                                    liveOnlineUsers.map((user) => (
                                        <div
                                            key={`${user.id}-${user.email}`}
                                            className={`${cardSoft} border rounded-2xl p-4 transition-all hover:-translate-y-0.5`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <span className={`text-xs font-black ${heading} truncate max-w-[80%]`}>{user.name}</span>
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                                            </div>
                                            <p className={`text-[11px] font-bold ${subtext} truncate`}>{user.email}</p>
                                            <div className="mt-3 pt-3 border-t border-slate-200/30 flex items-center justify-between">
                                                <span className={`text-[10px] font-black uppercase ${subtext}`}>{roleLabel(user.role, t)}</span>
                                                <span className={`text-[10px] font-bold ${subtext}`}>{user.last_activity_ago}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className={`col-span-full text-center py-12 rounded-2xl ${cardSoft}`}>
                                        <p className={`text-sm font-black ${subtext}`}>{t.noOnlineUsers}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'admin' && (
                    <div className={`${card} rounded-3xl p-6 border`}>
                        <h2 className={`text-xl font-black ${heading}`}>{t.adminToolsTitle}</h2>
                        <p className={`mt-2 text-sm font-bold ${subtext}`}>{t.adminToolsDesc}</p>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminActions.map((action) => (
                                <Link
                                    key={action.href}
                                    href={action.href}
                                    className={`${cardSoft} border rounded-2xl px-4 py-4 flex items-center justify-between hover:border-indigo-400 transition-all`}
                                >
                                    <span className={`text-sm font-black ${heading}`}>{action.title}</span>
                                    <span className="text-lg">{action.icon}</span>
                                </Link>
                            ))}
                        </div>

                        <div className="mt-6">
                            <ClearCacheButton />
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

function Stat({ title, value, icon, isDark }) {
    return (
        <div className={`border rounded-2xl p-4 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{title}</span>
                <span>{icon}</span>
            </div>
            <p className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        </div>
    );
}
