import React from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const t = {
    ar: {
        pageTitle: 'سجل العمليات | سنفور', header: '📜 سجل عمليات الإدارة',
        headerSub: 'صفحة مستقلة لمتابعة كل عمليات الإضافة، التعديل، والحذف.',
        tableTitle: '🕵️ سجل نشاطات النظام', lastOps: (n) => `آخر ${n} عملية موثقة في النظام.`,
        loginTableTitle: '🔐 سجل تسجيل الدخول', loginLastOps: (n) => `آخر ${n} عملية دخول ناجحة.`,
        searchPlaceholder: 'بحث بالعملية أو المسؤول...',
        searchLoginPlaceholder: 'بحث بالمستخدم أو الإيميل...',
        colDate: 'التاريخ والوقت', colAdmin: 'المسؤول (الأدمن)', colDetails: 'تفاصيل العملية',
        colUser: 'المستخدم', colRole: 'الدور', colLoginAt: 'وقت تسجيل الدخول',
        unknownUser: 'مستخدم غير معروف', noResults: 'لا توجد عمليات مطابقة للبحث.',
        noLoginResults: 'لا توجد عمليات تسجيل دخول مطابقة.',
    },
    en: {
        pageTitle: 'Activity Log | Sanfoor', header: '📜 Admin Activity Log',
        headerSub: 'Standalone page to track all add, update, and delete operations.',
        tableTitle: '🕵️ System Activity Log', lastOps: (n) => `Last ${n} documented operations.`,
        loginTableTitle: '🔐 Login Activity', loginLastOps: (n) => `Last ${n} successful logins.`,
        searchPlaceholder: 'Search by action or admin...',
        searchLoginPlaceholder: 'Search by user or email...',
        colDate: 'Date & Time', colAdmin: 'Admin', colDetails: 'Operation Details',
        colUser: 'User', colRole: 'Role', colLoginAt: 'Login At',
        unknownUser: 'Unknown User', noResults: 'No matching operations found.',
        noLoginResults: 'No matching login events found.',
    },
};

export default function AdminLogs({ auth, logs = [], loginLogs = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const tr = t[lang] || t.ar;
    const [query, setQuery] = React.useState('');
    const [loginQuery, setLoginQuery] = React.useState('');

    const filteredLogs = React.useMemo(() => {
        if (!query) return logs;
        const q = query.toLowerCase();
        return logs.filter((log) => {
            const action = String(log.action || '').toLowerCase();
            const details = String(log.details || '').toLowerCase();
            const user = String(log.user?.name || '').toLowerCase();
            return action.includes(q) || details.includes(q) || user.includes(q);
        });
    }, [logs, query]);

    const filteredLoginLogs = React.useMemo(() => {
        if (!loginQuery) return loginLogs;
        const q = loginQuery.toLowerCase();

        return loginLogs.filter((log) => {
            const userName = String(log.user?.name || '').toLowerCase();
            const userEmail = String(log.user?.email || '').toLowerCase();
            const role = String(log.user?.role || '').toLowerCase();
            const details = String(log.details || '').toLowerCase();

            return userName.includes(q) || userEmail.includes(q) || role.includes(q) || details.includes(q);
        });
    }, [loginLogs, loginQuery]);

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = isDark
        ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500'
        : 'bg-white border-slate-200 text-slate-800 focus:ring-indigo-500 focus:border-indigo-500';
    const theadCls = isDark ? 'bg-slate-900 text-slate-500 border-slate-700' : 'bg-white text-slate-400 border-slate-100';
    const rowHover = isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50/50';
    const divider = isDark ? 'divide-slate-700' : 'divide-slate-50';

    const getBadgeClass = (action) => {
        if (action.includes('add')) return isDark ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700' : 'bg-emerald-50 text-emerald-600 border-emerald-100';
        if (action.includes('delete')) return isDark ? 'bg-rose-900/40 text-rose-400 border-rose-700' : 'bg-rose-50 text-rose-600 border-rose-100';
        return isDark ? 'bg-blue-900/40 text-blue-400 border-blue-700' : 'bg-blue-50 text-blue-600 border-blue-100';
    };

    return (
        <AdminLayout user={auth?.user}>
            <Head title={tr.pageTitle} />

            <div className="space-y-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className={`${card} rounded-[2rem] p-7 shadow-sm`}>
                    <h1 className={`text-2xl font-black ${heading} mb-2`}>{tr.header}</h1>
                    <p className={`text-sm font-bold ${subtext}`}>{tr.headerSub}</p>
                </div>

                <div className={`${card} rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden`}>
                    <div className={`p-6 md:p-8 border-b flex justify-between items-center ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div>
                            <h2 className={`text-xl font-[900] ${heading} tracking-tight`}>{tr.loginTableTitle}</h2>
                            <p className={`text-[11px] font-bold mt-1 ${subtext}`}>{tr.loginLastOps(loginLogs.length)}</p>
                        </div>
                        <div className="w-64">
                            <input
                                type="text"
                                value={loginQuery}
                                onChange={(e) => setLoginQuery(e.target.value)}
                                placeholder={tr.searchLoginPlaceholder}
                                className={`w-full rounded-xl text-sm font-bold border ${inputCls}`}
                            />
                        </div>
                    </div>

                    <div className={`overflow-x-auto border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                        <table className="w-full text-right whitespace-nowrap">
                            <thead className={`sticky top-0 text-[11px] font-black uppercase tracking-widest border-b z-10 ${theadCls}`}>
                                <tr>
                                    <th className="p-5">{tr.colUser}</th>
                                    <th className="p-5">{tr.colRole}</th>
                                    <th className="p-5">{tr.colLoginAt}</th>
                                </tr>
                            </thead>
                            <tbody className={`${divider} divide-y text-sm`}>
                                {filteredLoginLogs.length > 0 ? filteredLoginLogs.map((log) => {
                                    const role = String(log.user?.role || '').toUpperCase() || 'N/A';

                                    return (
                                        <tr key={`login-${log.id}`} className={`${rowHover} transition-colors`}>
                                            <td className={`p-5 font-[900] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                                <div>{log.user?.name || tr.unknownUser}</div>
                                                <div className={`text-[11px] mt-1 font-bold ${subtext}`}>{log.user?.email || '---'}</div>
                                            </td>
                                            <td className={`p-5 font-black text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{role}</td>
                                            <td className={`p-5 font-mono text-[11px] font-bold ${subtext}`} dir="ltr">
                                                {new Date(log.created_at).toLocaleString('en-GB')}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="3" className={`p-10 text-center font-bold ${subtext}`}>{tr.noLoginResults}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className={`p-6 md:p-8 border-b flex justify-between items-center ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div>
                            <h2 className={`text-xl font-[900] ${heading} tracking-tight`}>{tr.tableTitle}</h2>
                            <p className={`text-[11px] font-bold mt-1 ${subtext}`}>{tr.lastOps(logs.length)}</p>
                        </div>
                        <div className="w-64">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={tr.searchPlaceholder}
                                className={`w-full rounded-xl text-sm font-bold border ${inputCls}`}
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right whitespace-nowrap">
                            <thead className={`sticky top-0 text-[11px] font-black uppercase tracking-widest border-b z-10 ${theadCls}`}>
                                <tr>
                                    <th className="p-5">{tr.colDate}</th>
                                    <th className="p-5">{tr.colAdmin}</th>
                                    <th className="p-5">{tr.colDetails}</th>
                                </tr>
                            </thead>
                            <tbody className={`${divider} divide-y text-sm`}>
                                {filteredLogs.length > 0 ? filteredLogs.map((log) => {
                                    const action = String(log.action || '').toLowerCase();
                                    const badgeClass = getBadgeClass(action);
                                    return (
                                        <tr key={log.id} className={`${rowHover} transition-colors`}>
                                            <td className={`p-5 font-mono text-[11px] font-bold ${subtext}`} dir="ltr">
                                                {new Date(log.created_at).toLocaleString('en-GB')}
                                            </td>
                                            <td className={`p-5 font-[900] flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    {log.user?.name?.charAt(0) || '?'}
                                                </div>
                                                {log.user?.name || tr.unknownUser}
                                            </td>
                                            <td className={`p-5 font-bold whitespace-normal ${subtext}`}>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ml-2 border ${badgeClass}`}>
                                                    {log.action}
                                                </span>
                                                {log.details}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="3" className={`p-10 text-center font-bold ${subtext}`}>{tr.noResults}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
