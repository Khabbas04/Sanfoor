import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const translations = {
    ar: {
        pageTitle: 'بلاغات الطلاب - لوحة الإدارة',
        heading: 'بلاغات الطلاب',
        subheading: 'جميع بلاغات المشاكل المرسلة من الطلاب تظهر هنا للمتابعة والتحديث.',
        all: 'كل البلاغات',
        open: 'مفتوحة',
        inProgress: 'قيد المعالجة',
        resolved: 'محلولة',
        searchPlaceholder: 'بحث بالعنوان أو الوصف...',
        student: 'الطالب',
        email: 'البريد',
        date: 'التاريخ',
        openPage: 'فتح الصفحة المتأثرة ↗',
        markOpen: 'مفتوح',
        markInProgress: 'قيد المعالجة',
        markResolved: 'محلول',
        deleteReport: 'حذف البلاغ',
        noResults: 'لا توجد بلاغات مطابقة للفلتر الحالي.',
        backToDashboard: 'الرجوع للوحة الرئيسية',
        total: 'الكل',
        confirmDelete: 'تأكيد الحذف',
        confirmDeleteText: 'هل أنت متأكد من حذف هذا البلاغ نهائياً؟',
        yes: 'نعم، احذف',
        cancel: 'إلغاء',
        statusLabels: { open: 'مفتوح', in_progress: 'قيد المعالجة', resolved: 'محلول' },
        priorityLabel: { low: 'منخفضة', medium: 'متوسطة', high: 'عاجلة' },
    },
    en: {
        pageTitle: 'Student Reports - Admin Panel',
        heading: 'Student Reports',
        subheading: 'All problem reports submitted by students appear here for follow-up and updates.',
        all: 'All Reports',
        open: 'Open',
        inProgress: 'In Progress',
        resolved: 'Resolved',
        searchPlaceholder: 'Search by title or description...',
        student: 'Student',
        email: 'Email',
        date: 'Date',
        openPage: 'Open Affected Page ↗',
        markOpen: 'Open',
        markInProgress: 'In Progress',
        markResolved: 'Resolved',
        deleteReport: 'Delete Report',
        noResults: 'No reports match the current filter.',
        backToDashboard: 'Back to Dashboard',
        total: 'All',
        confirmDelete: 'Confirm Delete',
        confirmDeleteText: 'Are you sure you want to permanently delete this report?',
        yes: 'Yes, Delete',
        cancel: 'Cancel',
        statusLabels: { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' },
        priorityLabel: { low: 'Low', medium: 'Medium', high: 'Urgent' },
    },
};

const statusClass = {
    open: 'bg-rose-50 text-rose-700 border-rose-100',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const statusClassDark = {
    open: 'bg-rose-900/30 text-rose-300 border-rose-800/50',
    in_progress: 'bg-amber-900/30 text-amber-300 border-amber-800/50',
    resolved: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/50',
};

const priorityClass = {
    low: 'bg-slate-100 text-slate-600 border-slate-200',
    medium: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    high: 'bg-rose-50 text-rose-700 border-rose-100',
};

const priorityClassDark = {
    low: 'bg-slate-700 text-slate-300 border-slate-600',
    medium: 'bg-indigo-900/30 text-indigo-300 border-indigo-800/50',
    high: 'bg-rose-900/30 text-rose-300 border-rose-800/50',
};

export default function AdminIssuesIndex({ auth, issues = [], filters = {}, summary = {} }) {
export default function AdminIssuesIndex({ auth, issues = [], filters = {}, summary = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;

    const [query, setQuery] = useState('');

    const setStatus = (issueId, status) => {
        router.put(route('admin.issues.update_status', issueId), { status }, { preserveScroll: true });
    };

    const removeIssue = async (issueId) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: t.confirmDelete,
            text: t.confirmDeleteText,
            showCancelButton: true,
            confirmButtonText: t.yes,
            cancelButtonText: t.cancel,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
        });

        if (!result.isConfirmed) return;
        router.delete(route('admin.issues.destroy', issueId), { preserveScroll: true });
    };

    const applyFilter = (status) => {
        router.get(route('admin.issues.index'), status ? { status } : {}, { preserveState: true, preserveScroll: true });
    };

    const visibleIssues = useMemo(() => {
        if (!query) return issues;
        const q = query.toLowerCase();
        return issues.filter((issue) => {
            const subject = String(issue.subject || '').toLowerCase();
            const message = String(issue.message || '').toLowerCase();
            const user = String(issue.user?.name || '').toLowerCase();
            return subject.includes(q) || message.includes(q) || user.includes(q);
        });
    }, [issues, query]);

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = isDark
        ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500'
        : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-indigo-500 focus:border-indigo-500';
    const filterBarCls = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const filterBtnBase = isDark ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';

    return (
        <AdminLayout user={auth.user}>
            <Head title={t.pageTitle} />

            <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="rounded-[2rem] bg-[#0b0f19] border border-white/5 text-white p-6 sm:p-8">
                    <h1 className="text-2xl sm:text-3xl font-black">{t.heading}</h1>
                    <p className="mt-2 text-sm font-bold text-indigo-200/70">{t.subheading}</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard title={t.total} value={summary.total || 0} color="slate" isDark={isDark} />
                    <SummaryCard title={t.open} value={summary.open || 0} color="rose" isDark={isDark} />
                    <SummaryCard title={t.inProgress} value={summary.in_progress || 0} color="amber" isDark={isDark} />
                    <SummaryCard title={t.resolved} value={summary.resolved || 0} color="emerald" isDark={isDark} />
                </div>

                <div className={`${filterBarCls} border rounded-2xl p-4 flex flex-wrap gap-2 sticky top-24 z-10`}>
                    <button onClick={() => applyFilter('')} className={`px-4 py-2 rounded-xl text-xs font-black border ${!filters.status ? 'bg-slate-900 text-white border-slate-900' : filterBtnBase}`}>{t.all}</button>
                    <button onClick={() => applyFilter('open')} className={`px-4 py-2 rounded-xl text-xs font-black border ${filters.status === 'open' ? 'bg-rose-600 text-white border-rose-600' : filterBtnBase}`}>{t.open}</button>
                    <button onClick={() => applyFilter('in_progress')} className={`px-4 py-2 rounded-xl text-xs font-black border ${filters.status === 'in_progress' ? 'bg-amber-500 text-white border-amber-500' : filterBtnBase}`}>{t.inProgress}</button>
                    <button onClick={() => applyFilter('resolved')} className={`px-4 py-2 rounded-xl text-xs font-black border ${filters.status === 'resolved' ? 'bg-emerald-600 text-white border-emerald-600' : filterBtnBase}`}>{t.resolved}</button>
                    <div className={lang === 'ar' ? 'mr-auto w-full sm:w-72' : 'ml-auto w-full sm:w-72'}>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className={`w-full rounded-xl border text-sm font-bold ${inputCls}`}
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    {visibleIssues.map((issue) => (
                        <article key={issue.id} className={`${card} border rounded-2xl p-5 shadow-sm`}>
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>#{issue.id}</span>
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${isDark ? (statusClassDark[issue.status] || statusClassDark.open) : (statusClass[issue.status] || statusClass.open)}`}>{t.statusLabels[issue.status] || issue.status}</span>
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${isDark ? (priorityClassDark[issue.priority] || priorityClassDark.medium) : (priorityClass[issue.priority] || priorityClass.medium)}`}>{t.priorityLabel[issue.priority] || issue.priority}</span>
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${isDark ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800/50' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>{issue.category}</span>
                                    </div>

                                    <h2 className={`text-lg font-black ${heading}`}>{issue.subject}</h2>
                                    <p className={`text-sm font-bold ${subtext} leading-relaxed whitespace-pre-wrap`}>{issue.message}</p>

                                    <div className={`text-xs font-bold ${subtext} flex flex-wrap gap-x-4 gap-y-1`}>
                                        <span>{t.student}: {issue.user?.name || (lang === 'ar' ? 'غير معروف' : 'Unknown')}</span>
                                        <span>{t.email}: {issue.user?.email || '-'}</span>
                                        <span>{t.date}: {new Date(issue.created_at).toLocaleString()}</span>
                                    </div>

                                    {issue.page_url && (
                                        <a href={issue.page_url} target="_blank" rel="noreferrer" className="inline-flex text-xs font-black text-indigo-600 hover:text-indigo-700">
                                            {t.openPage}
                                        </a>
                                    )}
                                </div>

                                <div className="flex lg:flex-col gap-2 lg:min-w-[170px]">
                                    <button onClick={() => setStatus(issue.id, 'open')} className={`px-3 py-2 rounded-lg text-xs font-black border ${isDark ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{t.markOpen}</button>
                                    <button onClick={() => setStatus(issue.id, 'in_progress')} className={`px-3 py-2 rounded-lg text-xs font-black border ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-800/50 hover:bg-amber-900/50' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'}`}>{t.markInProgress}</button>
                                    <button onClick={() => setStatus(issue.id, 'resolved')} className={`px-3 py-2 rounded-lg text-xs font-black border ${isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/50' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'}`}>{t.markResolved}</button>
                                    <button onClick={() => removeIssue(issue.id)} className={`px-3 py-2 rounded-lg text-xs font-black border ${isDark ? 'bg-rose-900/30 text-rose-300 border-rose-800/50 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100'}`}>{t.deleteReport}</button>
                                </div>
                            </div>
                        </article>
                    ))}

                    {visibleIssues.length === 0 && (
                        <div className={`${card} border rounded-2xl p-10 text-center`}>
                            <p className={`${subtext} font-black`}>{t.noResults}</p>
                            <Link href={route('admin.dashboard')} className="mt-4 inline-flex text-sm font-black text-indigo-600 hover:text-indigo-700">
                                {t.backToDashboard}
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function SummaryCard({ title, value, color, isDark }) {
    const colors = {
        slate: 'from-slate-500 to-slate-700',
        rose: 'from-rose-500 to-rose-700',
        amber: 'from-amber-500 to-orange-600',
        emerald: 'from-emerald-500 to-emerald-700',
    };

    return (
        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4 shadow-sm`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color] || colors.slate} mb-3`}></div>
            <p className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} mb-1`}>{title}</p>
            <p className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</p>
        </div>
    );
}
