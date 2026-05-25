import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import ClearCacheButton from '@/Components/Admin/ClearCacheButton';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';
import { useOnlinePolling } from '@/Hooks/useOnlinePolling';
import Swal from 'sweetalert2';

const translations = {
    ar: {
        title: 'إعدادات الإدارة',
        subtitle: 'لوحة تحكم احترافية لإدارة الحالة المباشرة للمستخدمين وأدوات الإدارة.',
        tabOnline: 'المستخدمون الأونلاين',
        tabAdmin: 'أدوات الإدارة',
        onlineNow: 'المتصلون الآن',
        activeStudents: 'طلاب نشطون',
        activeAdmins: 'أدمن نشط',
        totalStudents: 'إجمالي الطلاب',
        totalAdmins: 'إجمالي الأدمن',
        noOnlineUsers: 'لا يوجد مستخدمون متصلون حالياً.',
        searchUsers: 'ابحث بالاسم أو البريد...',
        allRoles: 'كل الأدوار',
        roleOwner: 'مالك',
        roleAdmin: 'أدمن',
        roleStudent: 'طالب',
        roleLabel: 'الدور',
        lastActivity: 'آخر نشاط',
        updatedNow: 'تحديث مباشر',
        refresh: 'تحديث الآن',
        statusLoading: 'جاري تحميل الحالة...',
        statusError: 'تعذر تحديث بيانات الأونلاين حالياً.',
        updatedAt: 'آخر تحديث',
        adminToolsTitle: 'أدوات إدارة النظام',
        adminToolsDesc: 'كل الإجراءات الإدارية مركزة هنا بدل الداشبورد.',
        academicPeriodTitle: 'الفصل الأكاديمي الحالي',
        academicPeriodDesc: 'هذا الإعداد يظهر للطلاب ويُستخدم كمرجع موحد للفصل النشط داخل النظام.',
        academicYearLabel: 'السنة الأكاديمية',
        academicTermLabel: 'الترم',
        academicLabel: 'عنوان مخصص',
        academicPreview: 'المعاينة الحالية',
        saveAcademicPeriod: 'حفظ الفصل الحالي',
        maintenanceTitle: 'وضع الصيانة',
        maintenanceDesc: 'فعّل الصيانة عند الحاجة مع إبقاء الإدارة قادرة على الدخول والتعديل.',
        maintenanceEnabled: 'الصيانة مفعلة',
        maintenanceDisabled: 'الصيانة متوقفة',
        maintenanceModeLabel: 'حالة الصيانة',
        maintenanceNameLabel: 'عنوان الصيانة',
        maintenanceMessageLabel: 'رسالة الظهور للطلاب',
        maintenanceEtaLabel: 'المدة المتوقعة بالدقائق',
        maintenanceHint: 'الأدمن والمالك سيستمرون بالوصول للوحة التحكم أثناء الصيانة.',
        enableMaintenance: 'تفعيل الصيانة',
        disableMaintenance: 'إيقاف الصيانة',
        termFirst: 'الفصل الأول',
        termSecond: 'الفصل الثاني',
        termSummer: 'الفصل الصيفي',
        manageAdmins: 'إدارة الأدمنز',
        manageStudents: 'إدارة الطلاب',
        reports: 'بلاغات الطلاب',
        structure: 'الكليات والتخصصات',
        courses: 'الشجرة والمواد',
        logs: 'سجل العمليات',
        demand: 'تحليل الطلب',
        viewPage: 'فتح الصفحة',
        createAdminAccount: 'إنشاء حساب إدارة جديد (سري)',
    },
    en: {
        title: 'Admin Settings',
        subtitle: 'A professional control panel for live-user status and administrative tools.',
        tabOnline: 'Online Users',
        tabAdmin: 'Admin Tools',
        onlineNow: 'Online Now',
        activeStudents: 'Active Students',
        activeAdmins: 'Active Admins',
        totalStudents: 'Total Students',
        totalAdmins: 'Total Admins',
        noOnlineUsers: 'No users are currently online.',
        searchUsers: 'Search by name or email...',
        allRoles: 'All Roles',
        roleOwner: 'Owner',
        roleAdmin: 'Admin',
        roleStudent: 'Student',
        roleLabel: 'Role',
        lastActivity: 'Last Activity',
        updatedNow: 'Live',
        refresh: 'Refresh Now',
        statusLoading: 'Loading live status...',
        statusError: 'Unable to refresh online data right now.',
        updatedAt: 'Last updated',
        adminToolsTitle: 'System Administration Tools',
        adminToolsDesc: 'All admin actions are centralized here instead of Dashboard.',
        academicPeriodTitle: 'Current Academic Period',
        academicPeriodDesc: 'This setting is visible to students and serves as the unified active term across the system.',
        academicYearLabel: 'Academic Year',
        academicTermLabel: 'Term',
        academicLabel: 'Custom Label',
        academicPreview: 'Current Preview',
        saveAcademicPeriod: 'Save Current Period',
        maintenanceTitle: 'Maintenance Mode',
        maintenanceDesc: 'Enable maintenance when needed while keeping admin access available.',
        maintenanceEnabled: 'Maintenance Enabled',
        maintenanceDisabled: 'Maintenance Disabled',
        maintenanceModeLabel: 'Maintenance State',
        maintenanceNameLabel: 'Maintenance Title',
        maintenanceMessageLabel: 'Student-facing Message',
        maintenanceEtaLabel: 'Expected Minutes',
        maintenanceHint: 'Admins and owners will still access the control panel during maintenance.',
        enableMaintenance: 'Enable Maintenance',
        disableMaintenance: 'Disable Maintenance',
        termFirst: 'First Term',
        termSecond: 'Second Term',
        termSummer: 'Summer Term',
        manageAdmins: 'Manage Admins',
        manageStudents: 'Manage Students',
        reports: 'Student Reports',
        structure: 'Colleges & Majors',
        courses: 'Tree & Courses',
        logs: 'Activity Log',
        demand: 'Demand Analysis',
        viewPage: 'Open Page',
        createAdminAccount: 'Create New Admin (Secret)',
    },
};

function roleLabel(role, t) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'owner') return t.roleOwner;
    if (normalized === 'admin') return t.roleAdmin;
    return t.roleStudent;
}

function roleBadge(role, isDark) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'owner') {
        return isDark ? 'bg-amber-900/40 text-amber-300 border-amber-700/60' : 'bg-amber-100 text-amber-700 border-amber-200';
    }
    if (normalized === 'admin') {
        return isDark ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700/60' : 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
    return isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/60' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

export default function Settings({ stats = {}, onlineUsers = [], currentAcademicPeriod = null, siteMaintenance = null }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const { auth } = usePage().props;
    const t = translations[lang] || translations.ar;
    const isOwner = String(auth?.user?.role || '').toLowerCase() === 'owner';

    const [activeTab, setActiveTab] = useState('online');
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [isSavingAcademicPeriod, setIsSavingAcademicPeriod] = useState(false);
    const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);
    const [academicForm, setAcademicForm] = useState({
        academic_year: currentAcademicPeriod?.academic_year || new Date().getFullYear().toString(),
        academic_term: String(currentAcademicPeriod?.academic_term || 1),
        label: currentAcademicPeriod?.label || '',
    });
    const [maintenanceForm, setMaintenanceForm] = useState({
        is_enabled: Boolean(siteMaintenance?.is_enabled),
        title: siteMaintenance?.title || 'الموقع تحت الصيانة',
        message: siteMaintenance?.message || 'نعمل الآن على تحسين الخدمة وإصلاح بعض الأمور. ستعود المنصة قريبًا.',
        expected_minutes: siteMaintenance?.expected_minutes ? String(siteMaintenance.expected_minutes) : '',
    });

    useEffect(() => {
        setAcademicForm({
            academic_year: currentAcademicPeriod?.academic_year || new Date().getFullYear().toString(),
            academic_term: String(currentAcademicPeriod?.academic_term || 1),
            label: currentAcademicPeriod?.label || '',
        });
    }, [currentAcademicPeriod]);

    useEffect(() => {
        setMaintenanceForm({
            is_enabled: Boolean(siteMaintenance?.is_enabled),
            title: siteMaintenance?.title || 'الموقع تحت الصيانة',
            message: siteMaintenance?.message || 'نعمل الآن على تحسين الخدمة وإصلاح بعض الأمور. ستعود المنصة قريبًا.',
            expected_minutes: siteMaintenance?.expected_minutes ? String(siteMaintenance.expected_minutes) : '',
        });
    }, [siteMaintenance]);

    const initialOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
    const {
        onlineUsers: liveOnlineUsers,
        stats: liveStats,
        isLoading,
        error,
        lastUpdatedAt,
        refreshNow,
    } = useOnlinePolling(initialOnlineUsers, stats || {}, { intervalMs: 3000, minutes: 30 });

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const cardSoft = isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';

    const filteredOnlineUsers = useMemo(() => {
        const text = query.trim().toLowerCase();
        return liveOnlineUsers.filter((user) => {
            const matchRole = roleFilter === 'all' ? true : String(user.role || '').toLowerCase() === roleFilter;
            if (!matchRole) return false;
            if (!text) return true;
            const name = String(user.name || '').toLowerCase();
            const email = String(user.email || '').toLowerCase();
            return name.includes(text) || email.includes(text);
        });
    }, [liveOnlineUsers, query, roleFilter]);

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
            actions.push({ title: t.createAdminAccount, href: route('register.secret'), icon: '🔑' });
        }

        return actions;
    }, [isOwner, t]);

    const currentAcademicPreview = currentAcademicPeriod?.display_label || (academicForm.label?.trim() || `${academicForm.academic_year} ${academicForm.academic_term}`);
    const currentMaintenancePreview = Boolean(maintenanceForm.is_enabled);

    const termOptions = [
        { value: '1', label: t.termFirst },
        { value: '2', label: t.termSecond },
        { value: '3', label: t.termSummer },
    ];

    const saveAcademicPeriod = () => {
        setIsSavingAcademicPeriod(true);
        router.put(route('admin.settings.academic_period'), academicForm, {
            preserveScroll: true,
            onFinish: () => setIsSavingAcademicPeriod(false),
            onSuccess: () => {
                Swal.fire({
                    icon: 'success',
                    title: t.saveAcademicPeriod,
                    text: `${t.academicPreview}: ${currentAcademicPreview}`,
                    confirmButtonColor: '#4f46e5',
                });
            },
        });
    };

    const saveMaintenanceMode = () => {
        setIsSavingMaintenance(true);
        router.put(route('admin.settings.maintenance'), maintenanceForm, {
            preserveScroll: true,
            onFinish: () => setIsSavingMaintenance(false),
            onSuccess: () => {
                Swal.fire({
                    icon: 'success',
                    title: currentMaintenancePreview ? t.enableMaintenance : t.disableMaintenance,
                    text: currentMaintenancePreview ? t.maintenanceEnabled : t.maintenanceDisabled,
                    confirmButtonColor: '#4f46e5',
                });
            },
        });
    };

    return (
        <AdminLayout>
            <Head title={`${t.title} | سنفور`} />

            <div className="space-y-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <section className={`${card} border rounded-3xl p-6 sm:p-8 relative overflow-hidden`}>
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none"></div>
                    <div className="relative">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                            <div>
                                <h1 className={`text-2xl sm:text-3xl font-black ${heading}`}>{t.title}</h1>
                                <p className={`mt-2 text-sm font-bold ${subtext}`}>{t.subtitle}</p>
                            </div>
                            <div className={`inline-flex items-center gap-2 text-xs font-black px-3 py-2 rounded-xl ${isDark ? 'bg-slate-900/70 text-emerald-300 border border-slate-700' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                {t.updatedNow}
                            </div>
                        </div>

                        <div className="mt-6 inline-flex rounded-2xl p-1 bg-indigo-500/10 border border-indigo-500/20">
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
                </section>

                {activeTab === 'online' && (
                    <section className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Stat title={t.onlineNow} value={liveOnlineUsers.length} icon="🟢" isDark={isDark} />
                            <Stat title={t.activeStudents} value={liveStats.active_students_now || 0} icon="👨‍🎓" isDark={isDark} />
                            <Stat title={t.activeAdmins} value={liveStats.active_admins_now || 0} icon="⚙️" isDark={isDark} />
                            <Stat title={t.totalStudents} value={stats?.students_count || 0} icon="📊" isDark={isDark} />
                        </div>

                        <div className={`${card} border rounded-3xl p-5 sm:p-6`}>
                            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
                                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder={t.searchUsers}
                                        className={`w-full sm:w-72 rounded-xl border px-3 py-2 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                                    />
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className={`rounded-xl border px-3 py-2 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}
                                    >
                                        <option value="all">{t.allRoles}</option>
                                        <option value="student">{t.roleStudent}</option>
                                        <option value="admin">{t.roleAdmin}</option>
                                        <option value="owner">{t.roleOwner}</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={refreshNow}
                                        className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-3 py-2 transition-colors"
                                    >
                                        {t.refresh}
                                    </button>
                                    <span className={`text-[11px] font-bold ${subtext}`}>
                                        {t.updatedAt}: {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : '--:--'}
                                    </span>
                                </div>
                            </div>

                            {isLoading && (
                                <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-black ${isDark ? 'bg-slate-900 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                    {t.statusLoading}
                                </div>
                            )}

                            {Boolean(error) && (
                                <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-black ${isDark ? 'bg-rose-900/30 text-rose-300 border border-rose-800/60' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                                    {t.statusError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredOnlineUsers.length > 0 ? (
                                    filteredOnlineUsers.map((user) => (
                                        <div
                                            key={`${user.id}-${user.email}`}
                                            className={`${cardSoft} border rounded-2xl p-4 transition-all hover:-translate-y-0.5`}
                                        >
                                            <div className="flex items-center justify-between mb-3 gap-2">
                                                <span className={`text-sm font-black ${heading} truncate`}>{user.name}</span>
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                                            </div>
                                            <p className={`text-[11px] font-bold ${subtext} truncate`}>{user.email}</p>
                                            <div className="mt-3 pt-3 border-t border-slate-200/30 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black ${subtext}`}>{t.roleLabel}</span>
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${roleBadge(user.role, isDark)}`}>
                                                        {roleLabel(user.role, t)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black ${subtext}`}>{t.lastActivity}</span>
                                                    <span className={`text-[10px] font-bold ${subtext}`}>{user.last_activity_ago}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black ${subtext}`}>القسم</span>
                                                    <span className={`text-[10px] font-bold ${subtext}`}>{user.major?.name || '—'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black ${subtext}`}>مواد بالكارت</span>
                                                    <span className={`text-[10px] font-bold ${subtext}`}>{user.cart_count ?? 0} ({user.cart_hours ?? 0} س)</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black ${subtext}`}>الساعات المكتملة</span>
                                                    <span className={`text-[10px] font-bold ${subtext}`}>{user.passed_hours ?? 0} س</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-black ${subtext}`}>خطة معتمدة</span>
                                                    <span className={`text-[10px] font-bold ${subtext}`}>{user.has_approved_plan ? 'نعم' : 'لا'}</span>
                                                </div>
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
                    </section>
                )}

                {activeTab === 'admin' && (
                    <section className={`${card} border rounded-3xl p-6`}>
                        <h2 className={`text-xl font-black ${heading}`}>{t.adminToolsTitle}</h2>
                        <p className={`mt-2 text-sm font-bold ${subtext}`}>{t.adminToolsDesc}</p>

                        <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className={`${cardSoft} border rounded-2xl p-5`}>
                                <p className={`text-[11px] font-black ${subtext}`}>{t.academicPeriodTitle}</p>
                                <h3 className={`mt-2 text-2xl font-black ${heading}`}>{currentAcademicPreview}</h3>
                                <p className={`mt-2 text-sm font-bold ${subtext}`}>{t.academicPeriodDesc}</p>
                                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-bold ${isDark ? 'bg-slate-950/40 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                                    <span className="block text-[11px] font-black uppercase tracking-wider opacity-60">{t.academicPreview}</span>
                                    <span className="block mt-1 text-base font-black text-indigo-600">{currentAcademicPreview}</span>
                                </div>
                            </div>

                            <div className={`${cardSoft} border rounded-2xl p-5`}>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className={`block text-[11px] font-black mb-2 ${subtext}`}>{t.academicYearLabel}</label>
                                        <input
                                            type="text"
                                            value={academicForm.academic_year}
                                            onChange={(e) => setAcademicForm((prev) => ({ ...prev, academic_year: e.target.value }))}
                                            className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                                            placeholder="2026"
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-[11px] font-black mb-2 ${subtext}`}>{t.academicTermLabel}</label>
                                        <select
                                            value={academicForm.academic_term}
                                            onChange={(e) => setAcademicForm((prev) => ({ ...prev, academic_term: e.target.value }))}
                                            className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}
                                        >
                                            {termOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-[11px] font-black mb-2 ${subtext}`}>{t.academicLabel}</label>
                                        <input
                                            type="text"
                                            value={academicForm.label}
                                            onChange={(e) => setAcademicForm((prev) => ({ ...prev, label: e.target.value }))}
                                            className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                                            placeholder="2026 الفصل الأول"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={saveAcademicPeriod}
                                    disabled={isSavingAcademicPeriod}
                                    className="mt-4 inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-black px-4 py-2.5 transition-colors"
                                >
                                    {isSavingAcademicPeriod ? t.updatedNow : t.saveAcademicPeriod}
                                </button>
                            </div>
                        </div>

                        <div className={`${cardSoft} border rounded-2xl p-5 mt-4`}>
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                <div>
                                    <p className={`text-[11px] font-black ${subtext}`}>{t.maintenanceTitle}</p>
                                    <h3 className={`mt-2 text-2xl font-black ${heading}`}>{maintenanceForm.title}</h3>
                                    <p className={`mt-2 text-sm font-bold ${subtext}`}>{t.maintenanceDesc}</p>
                                </div>
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-black border ${currentMaintenancePreview ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    <span className={`w-2 h-2 rounded-full ${currentMaintenancePreview ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    {currentMaintenancePreview ? t.maintenanceEnabled : t.maintenanceDisabled}
                                </span>
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3">
                                <label className={`text-[11px] font-black ${subtext}`}>{t.maintenanceModeLabel}</label>
                                <button
                                    type="button"
                                    onClick={() => setMaintenanceForm((prev) => ({ ...prev, is_enabled: !prev.is_enabled }))}
                                    className={`w-full rounded-2xl border px-4 py-3 text-sm font-black transition-colors ${maintenanceForm.is_enabled ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
                                >
                                    {maintenanceForm.is_enabled ? t.disableMaintenance : t.enableMaintenance}
                                </button>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-[11px] font-black mb-2 ${subtext}`}>{t.maintenanceNameLabel}</label>
                                    <input
                                        type="text"
                                        value={maintenanceForm.title}
                                        onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, title: e.target.value }))}
                                        className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-[11px] font-black mb-2 ${subtext}`}>{t.maintenanceEtaLabel}</label>
                                    <input
                                        type="number"
                                        min="5"
                                        max="1440"
                                        value={maintenanceForm.expected_minutes}
                                        onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, expected_minutes: e.target.value }))}
                                        className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                                        placeholder="60"
                                    />
                                </div>
                            </div>

                            <div className="mt-3">
                                <label className={`block text-[11px] font-black mb-2 ${subtext}`}>{t.maintenanceMessageLabel}</label>
                                <textarea
                                    rows="3"
                                    value={maintenanceForm.message}
                                    onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, message: e.target.value }))}
                                    className={`w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none resize-none ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                                />
                            </div>

                            <p className={`mt-3 text-[11px] font-bold ${subtext}`}>{t.maintenanceHint}</p>

                            <button
                                onClick={saveMaintenanceMode}
                                disabled={isSavingMaintenance}
                                className="mt-4 inline-flex items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-black px-4 py-2.5 transition-colors"
                            >
                                {isSavingMaintenance ? t.updatedNow : (maintenanceForm.is_enabled ? t.enableMaintenance : t.disableMaintenance)}
                            </button>
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {adminActions.map((action) => (
                                <Link
                                    key={action.href}
                                    href={action.href}
                                    className={`${cardSoft} border rounded-2xl p-4 flex items-center justify-between hover:border-indigo-400 transition-all group`}
                                >
                                    <div>
                                        <p className={`text-sm font-black ${heading}`}>{action.title}</p>
                                        <p className={`text-[11px] font-bold ${subtext} mt-1`}>{t.viewPage}</p>
                                    </div>
                                    <span className="text-2xl group-hover:scale-110 transition-transform">{action.icon}</span>
                                </Link>
                            ))}
                        </div>

                        <div className="mt-6">
                            <ClearCacheButton />
                        </div>
                    </section>
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
