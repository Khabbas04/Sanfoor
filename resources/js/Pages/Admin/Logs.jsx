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
    const [sortBy, setSortBy] = React.useState('recent');

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

    const getRelativeTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return lang === 'ar' ? 'الآن' : 'Now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return lang === 'ar' ? `${minutes} دقيقة` : `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return lang === 'ar' ? `${hours} ساعة` : `${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return lang === 'ar' ? `${days} يوم` : `${days}d`;
        if (days < 30) return lang === 'ar' ? `${Math.floor(days / 7)} أسابيع` : `${Math.floor(days / 7)}w`;
        return new Date(dateString).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB');
    };

    const getDateGroup = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return lang === 'ar' ? 'اليوم' : 'Today';
        if (days === 1) return lang === 'ar' ? 'أمس' : 'Yesterday';
        if (days < 7) return lang === 'ar' ? 'هذا الأسبوع' : 'This Week';
        return lang === 'ar' ? 'أقدم' : 'Earlier';
    };

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

    const groupedLoginLogs = React.useMemo(() => {
        const sorted = [...filteredLoginLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const grouped = {};
        sorted.forEach((log) => {
            const group = getDateGroup(log.created_at);
            if (!grouped[group]) grouped[group] = [];
            grouped[group].push(log);
        });
        return grouped;
    }, [filteredLoginLogs]);

    const groupedLogs = React.useMemo(() => {
        const sorted = [...filteredLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const grouped = {};
        sorted.forEach((log) => {
            const group = getDateGroup(log.created_at);
            if (!grouped[group]) grouped[group] = [];
            grouped[group].push(log);
        });
        return grouped;
    }, [filteredLogs]);

    const systemStats = React.useMemo(() => {
        const now = new Date();
        const today = Math.floor(now / (1000 * 60 * 60 * 24));
        
        const todayLogs = logs.filter((log) => {
            const logDay = Math.floor(new Date(log.created_at) / (1000 * 60 * 60 * 24));
            return logDay === today;
        }).length;

        const actionTypes = {};
        logs.forEach((log) => {
            const action = log.action || 'UNKNOWN';
            actionTypes[action] = (actionTypes[action] || 0) + 1;
        });

        return { todayLogs, actionTypes };
    }, [logs]);

    const loginStats = React.useMemo(() => {
        const now = new Date();
        const today = Math.floor(now / (1000 * 60 * 60 * 24));
        
        const todayLogins = loginLogs.filter((log) => {
            const logDay = Math.floor(new Date(log.created_at) / (1000 * 60 * 60 * 24));
            return logDay === today;
        }).length;

        const uniqueUsers = new Set(loginLogs.map((log) => log.user_id)).size;
        const totalLogins = loginLogs.length;

        return { todayLogins, uniqueUsers, totalLogins };
    }, [loginLogs]);

    const getRoleColor = (role) => {
        const roleUpper = String(role || '').toUpperCase();
        if (roleUpper === 'ADMIN') return isDark ? 'bg-purple-900/40 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-700 border-purple-200';
        if (roleUpper === 'STUDENT') return isDark ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-700 border-blue-200';
        if (roleUpper === 'OWNER') return isDark ? 'bg-rose-900/40 text-rose-300 border-rose-700' : 'bg-rose-100 text-rose-700 border-rose-200';
        return isDark ? 'bg-slate-700/40 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const getRoleIcon = (role) => {
        const roleUpper = String(role || '').toUpperCase();
        if (roleUpper === 'ADMIN') return '👨‍💼';
        if (roleUpper === 'STUDENT') return '👨‍🎓';
        if (roleUpper === 'OWNER') return '👑';
        return '👤';
    };

    const getActionColor = (action) => {
        const actionLower = String(action || '').toLowerCase();
        if (actionLower.includes('add') || actionLower.includes('create')) {
            return isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
        }
        if (actionLower.includes('delete')) {
            return isDark ? 'bg-rose-900/40 text-rose-300 border-rose-700' : 'bg-rose-100 text-rose-700 border-rose-200';
        }
        if (actionLower.includes('update') || actionLower.includes('edit')) {
            return isDark ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-700 border-blue-200';
        }
        if (actionLower.includes('login')) {
            return isDark ? 'bg-purple-900/40 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-700 border-purple-200';
        }
        return isDark ? 'bg-slate-700/40 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const getActionIcon = (action) => {
        const actionLower = String(action || '').toLowerCase();
        if (actionLower.includes('add') || actionLower.includes('create')) return '✨';
        if (actionLower.includes('delete')) return '🗑️';
        if (actionLower.includes('update') || actionLower.includes('edit')) return '✏️';
        if (actionLower.includes('login')) return '🔐';
        return '📝';
    };

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

                {/* System Activity Log - MOVED TO TOP */}
                <div className={`${card} rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden`}>
                    <div className={`p-6 md:p-8 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div>
                            <h2 className={`text-xl font-[900] ${heading} tracking-tight`}>{tr.tableTitle}</h2>
                            <p className={`text-[11px] font-bold mt-1 ${subtext}`}>{tr.lastOps(logs.length)}</p>
                        </div>
                        <div className="w-full md:w-64">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={tr.searchPlaceholder}
                                className={`w-full rounded-xl text-sm font-bold border ${inputCls}`}
                            />
                        </div>
                    </div>

                    {/* Stats Cards */}
                    {systemStats && Object.keys(systemStats.actionTypes).length > 0 && (
                        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-6 md:p-8 border-b overflow-x-auto ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-100 bg-slate-50/30'}`}>
                            <div className={`rounded-xl p-4 border whitespace-nowrap ${isDark ? 'bg-blue-500/10 border-blue-700/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                <div className="text-xs font-bold opacity-75">{lang === 'ar' ? 'اليوم' : 'Today'}</div>
                                <div className="text-2xl font-black mt-1">{systemStats.todayLogs}</div>
                            </div>
                            {Object.entries(systemStats.actionTypes).slice(0, 2).map(([action, count]) => (
                                <div key={action} className={`rounded-xl p-4 border whitespace-nowrap ${isDark ? 'bg-purple-500/10 border-purple-700/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                                    <div className="text-xs font-bold opacity-75 truncate">{action}</div>
                                    <div className="text-2xl font-black mt-1">{count}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Activity Cards */}
                    <div className={`p-6 md:p-8 space-y-8 ${isDark ? 'bg-slate-800/20' : 'bg-white/50'}`}>
                        {Object.keys(groupedLogs).length > 0 ? (
                            Object.entries(groupedLogs).map(([group, logs]) => (
                                <div key={group}>
                                    <div className={`text-xs font-[900] px-3 py-2 mb-4 rounded-lg inline-block border ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                                        {group}
                                    </div>
                                    <div className="space-y-3">
                                        {logs.map((log) => {
                                            const relTime = getRelativeTime(log.created_at);
                                            const actionColors = getActionColor(log.action);
                                            const actionIcon = getActionIcon(log.action);

                                            return (
                                                <div
                                                    key={`log-${log.id}`}
                                                    className={`rounded-xl p-4 border transition-all duration-300 ${isDark ? 'bg-slate-700/40 border-slate-600 hover:bg-slate-700/60 hover:border-slate-500' : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md'}`}
                                                >
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Left Side: User & Action */}
                                                        <div className="flex items-start gap-4">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${isDark ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-300' : 'bg-indigo-100 border-indigo-300 text-indigo-700'}`}>
                                                                {log.user?.name?.charAt(0) || '?'}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`font-[900] text-sm truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                                                    {log.user?.name || tr.unknownUser}
                                                                </div>
                                                                <div className={`text-xs mt-1 ${subtext}`}>
                                                                    <span className={`font-black px-2 py-1 rounded-md border ${actionColors} inline-block`}>
                                                                        {actionIcon} {log.action}
                                                                    </span>
                                                                </div>
                                                                <div className={`text-[11px] mt-2 font-bold line-clamp-2 ${subtext}`}>
                                                                    {log.details}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right Side: DateTime & IP */}
                                                        <div className="flex flex-col md:flex-row md:justify-end md:items-start gap-4">
                                                            <div className="flex flex-col gap-2">
                                                                <div className={`text-right`}>
                                                                    <div className={`text-xs font-black ${subtext}`}>
                                                                        {new Date(log.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
                                                                            month: 'short',
                                                                            day: 'numeric',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        })}
                                                                    </div>
                                                                    <div className={`text-[10px] font-black mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                                        {relTime}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {log.ip_address && (
                                                                <div className={`rounded-lg px-3 py-2 border text-right ${isDark ? 'bg-orange-900/30 border-orange-700/50 text-orange-300' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                                                                    <div className="text-[10px] font-bold opacity-75">🌐 IP</div>
                                                                    <div className="text-xs font-black font-mono">{log.ip_address}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={`p-10 text-center rounded-xl border-2 border-dashed ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                                <div className="text-3xl mb-2">🔍</div>
                                <div className={`font-bold ${heading}`}>{tr.noResults}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Login Activity Log */}
                    <div className={`p-6 md:p-8 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-100 bg-slate-50/50'}`}>
                        <div>
                            <h2 className={`text-xl font-[900] ${heading} tracking-tight`}>{tr.loginTableTitle}</h2>
                            <p className={`text-[11px] font-bold mt-1 ${subtext}`}>{tr.loginLastOps(loginLogs.length)}</p>
                        </div>
                        <div className="w-full md:w-64">
                            <input
                                type="text"
                                value={loginQuery}
                                onChange={(e) => setLoginQuery(e.target.value)}
                                placeholder={tr.searchLoginPlaceholder}
                                className={`w-full rounded-xl text-sm font-bold border ${inputCls}`}
                            />
                        </div>
                    </div>

                    {/* Stats Cards */}
                    {loginStats && (
                        <div className={`grid grid-cols-3 gap-4 p-6 md:p-8 border-b ${isDark ? 'border-slate-700 bg-slate-800/30' : 'border-slate-100 bg-slate-50/30'}`}>
                            <div className={`rounded-xl p-4 border ${isDark ? 'bg-blue-500/10 border-blue-700/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                <div className="text-xs font-bold opacity-75">{lang === 'ar' ? 'اليوم' : 'Today'}</div>
                                <div className="text-2xl font-black mt-1">{loginStats.todayLogins}</div>
                            </div>
                            <div className={`rounded-xl p-4 border ${isDark ? 'bg-purple-500/10 border-purple-700/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>
                                <div className="text-xs font-bold opacity-75">{lang === 'ar' ? 'المستخدمون' : 'Users'}</div>
                                <div className="text-2xl font-black mt-1">{loginStats.uniqueUsers}</div>
                            </div>
                            <div className={`rounded-xl p-4 border ${isDark ? 'bg-emerald-500/10 border-emerald-700/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                <div className="text-xs font-bold opacity-75">{lang === 'ar' ? 'الإجمالي' : 'Total'}</div>
                                <div className="text-2xl font-black mt-1">{loginStats.totalLogins}</div>
                            </div>
                        </div>
                    )}

                    {/* Login Logs Cards */}
                    <div className={`p-6 md:p-8 space-y-8 ${isDark ? 'bg-slate-800/20' : 'bg-white/50'}`}>
                        {Object.keys(groupedLoginLogs).length > 0 ? (
                            Object.entries(groupedLoginLogs).map(([group, logs]) => (
                                <div key={group}>
                                    <div className={`text-xs font-[900] px-3 py-2 mb-4 rounded-lg inline-block border ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                                        {/* @ts-ignore */}
                                        {group}
                                    </div>
                                    <div className="space-y-3">
                                        {logs.map((log) => {
                                            const role = String(log.user?.role || '').toUpperCase() || 'N/A';
                                            const relTime = getRelativeTime(log.created_at);
                                            const roleColors = getRoleColor(role);
                                            const roleIcon = getRoleIcon(role);
                                            const initials = (log.user?.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

                                            return (
                                                <div
                                                    key={`login-${log.id}`}
                                                    className={`rounded-xl p-4 border transition-all duration-300 ${isDark ? 'bg-slate-700/40 border-slate-600 hover:bg-slate-700/60 hover:border-slate-500' : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md'}`}
                                                >
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black border-2 ${isDark ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-300' : 'bg-indigo-100 border-indigo-300 text-indigo-700'}`}>
                                                                {roleIcon}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`font-[900] text-sm truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                                                    {log.user?.name || tr.unknownUser}
                                                                </div>
                                                                <div className={`text-xs mt-1 truncate ${subtext}`}>
                                                                    {log.user?.email || '---'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                                                            <div className={`text-right md:text-left`}>
                                                                <div className={`text-xs font-black ${subtext}`}>
                                                                    {new Date(log.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    })}
                                                                </div>
                                                                <div className={`text-[10px] font-black mt-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                                    {relTime}
                                                                </div>
                                                            </div>

                                                            <span className={`text-xs font-black px-3 py-1.5 rounded-lg border whitespace-nowrap ${roleColors}`}>
                                                                {role}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={`p-10 text-center rounded-xl border-2 border-dashed ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                                <div className="text-3xl mb-2">🔍</div>
                                <div className={`font-bold ${heading}`}>{tr.noLoginResults}</div>
                            </div>
                        )}
                    </div>
                </div>
        </AdminLayout>
    );
}
