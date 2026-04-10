import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import ClearCacheButton from '@/Components/Admin/ClearCacheButton';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const translations = {
    ar: {
        title: 'لوحة الإدارة المركزية', subtitle: 'لوحة متابعة تشغيلية: الإحصائيات، البلاغات، السجل، والتحكم السريع.',
        liveOps: 'Live Ops', infrastructure: 'بنية تحتية نشطة', greeting: 'أهلاً بك،',
        manageStudents: 'إدارة الطلاب', liveReports: 'التقارير الحية',
        totalStudents: 'إجمالي الطلاب', activeNow: 'نشطين حالياً', courses: 'المواد الدراسية',
        simulatorRequests: 'طلبات التسجيل التجريبي', nextSemesterForecast: 'توقعات الفصل القادم',
        systemStatus: 'حالة النظام', systemProtected: 'حماية Postgre فعال',
        openReports: 'بلاغات مفتوحة', totalReports: 'إجمالي البلاغات:',
        academicCoverage: 'التغطية الأكاديمية', collegesSlashMajors: 'كليات / تخصصات',
        topDemand: 'المواد الأكثر طلباً (Top 5)', viewFullReport: 'عرض التقرير الكامل ←',
        student: 'طالب', noSimulatorData: 'لا يوجد بيانات تسجيل تجريبي مسجلة حالياً.',
        quickActions: 'إجراءات سريعة', studentReports: 'بلاغات الطلاب',
        addCollege: 'إضافة كلية جديدة', updatePlan: 'تحديث خطة تخصص', activityLog: 'سجل حركات الإدارة',
        aiStatus: 'ذكاء اصطناعي نشط', configAlgo: 'تهيئة الخوارزميات',
        latestReports: 'آخر البلاغات', viewAll: 'عرض الكل', unknown: 'غير معروف',
        noNewReports: 'لا توجد بلاغات جديدة.', adminLog: 'سجل حركات الإدارة',
        lastMoves: (n) => `آخر ${n} حركة`, noLogEntries: 'لا توجد حركات مسجلة حالياً.',
        statusOpen: 'مفتوح', statusInProgress: 'قيد المعالجة', statusResolved: 'محلول',
        majorCourses: 'مادة تخصص', statsTracker: 'Stats Tracker',
        onlineUsers: 'المستخدمون الآن', noOnlineUsers: 'لا أحد متصل الآن',
        admins: 'أدمن', student_role: 'طالب', admin_role: 'أدمن', activeAgo: 'قبل',
    },
    en: {
        title: 'Admin Control Center', subtitle: 'Operational dashboard: stats, reports, log, and quick controls.',
        liveOps: 'Live Ops', infrastructure: 'Active Infrastructure', greeting: 'Welcome,',
        manageStudents: 'Manage Students', liveReports: 'Live Reports',
        totalStudents: 'Total Students', activeNow: 'Currently Active', courses: 'Courses',
        simulatorRequests: 'Trial Registration Requests', nextSemesterForecast: 'Next Semester Forecast',
        systemStatus: 'System Status', systemProtected: 'PostgreSQL Protection Active',
        openReports: 'Open Reports', totalReports: 'Total Reports:',
        academicCoverage: 'Academic Coverage', collegesSlashMajors: 'Colleges / Majors',
        topDemand: 'Top 5 Most Demanded Courses', viewFullReport: 'View Full Report →',
        student: 'students', noSimulatorData: 'No trial registration data recorded yet.',
        quickActions: 'Quick Actions', studentReports: 'Student Reports',
        addCollege: 'Add New College', updatePlan: 'Update Major Plan', activityLog: 'Activity Log',
        aiStatus: 'AI Active', configAlgo: 'Configure Algorithms',
        latestReports: 'Latest Reports', viewAll: 'View All', unknown: 'Unknown',
        noNewReports: 'No new reports.', adminLog: 'Admin Activity Log',
        lastMoves: (n) => `Last ${n} entries`, noLogEntries: 'No activity recorded yet.',
        statusOpen: 'Open', statusInProgress: 'In Progress', statusResolved: 'Resolved',
        majorCourses: 'major courses', statsTracker: 'Stats',
        onlineUsers: 'Online Users', noOnlineUsers: 'No users online',
        admins: 'Admins', student_role: 'Student', admin_role: 'Admin', activeAgo: 'ago',
    },
};

export default function AdminDashboard({ auth, stats, platform = {}, demandReport = [], issueSummary = {}, recentIssues = [], logs = [], onlineUsers = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;
    const safeAuth = auth || {};
    const safeUser = safeAuth.user || { name: 'Admin' };
    const safeStats = stats || {};
    const safePlatform = platform || {};
    const safeIssueSummary = issueSummary || {};
    const safeDemandReport = Array.isArray(demandReport) ? demandReport : [];
    const safeRecentIssues = Array.isArray(recentIssues) ? recentIssues : [];
    const safeLogs = Array.isArray(logs) ? logs : [];

    const safeStudentsCount = Number(safeStats.students_count || 0);
    const safeOnlineUsers = Array.isArray(onlineUsers) ? onlineUsers : [];
    const demandBase = safeStudentsCount > 0 ? safeStudentsCount : 1;

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const cardAlt = isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-[#f8fafc] border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const logRow = isDark ? 'border-slate-700 bg-slate-800/30 hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-200';

    const getStatusBadge = (s) => {
        if (s === 'open') return isDark ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-100 text-rose-700';
        if (s === 'in_progress') return isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-700';
        return isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700';
    };
    const getStatusLabel = (s) => s === 'open' ? t.statusOpen : s === 'in_progress' ? t.statusInProgress : t.statusResolved;

    return (
        <AdminLayout user={safeUser}>
            <Head title={`${t.title} | سنفور`} />

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .animate-slide-in { animation: slideInRight 0.5s ease-out forwards; }
                .delay-100 { animation-delay: 100ms; } .delay-200 { animation-delay: 200ms; }
            ` }} />

            <div className="space-y-8 pb-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Top bar */}
                <div className={`flex items-center justify-between ${card} rounded-2xl px-5 py-3`}>
                    <p className={`text-xs font-black ${subtext}`}>{t.subtitle}</p>
                    <span className={`text-[10px] font-black rounded-lg px-2 py-1 ${isDark ? 'text-indigo-400 bg-indigo-500/20 border border-indigo-500/30' : 'text-indigo-600 bg-indigo-50 border border-indigo-100'}`}>{t.liveOps}</span>
                </div>

                {/* Hero Banner */}
                <div className="relative overflow-hidden bg-[#0b0f19] rounded-[3rem] p-10 text-white shadow-2xl border border-white/5">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                    <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/20 blur-[100px] rounded-full"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="max-w-2xl text-center md:text-right">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black tracking-widest uppercase mb-6">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                                {t.infrastructure} • v2.1.4
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
                                {t.greeting} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">{safeUser.name}</span> 👋
                            </h1>
                            <p className="text-slate-400 font-bold text-sm md:text-base leading-relaxed">
                                {lang === 'ar'
                                    ? <>نراقب الآن أداء <span className="text-white">{safeStats.students_count || 0}</span> طالب، وإدارة <span className="text-white">{safeStats.admins_count || 0}</span> أدمن + <span className="text-white">{safeStats.owners_count || 0}</span> مالك نظام، مع تحليل <span className="text-white">{safeStats.courses_count || 0}</span> مادة أكاديمية.</>
                                    : <>Monitoring <span className="text-white">{safeStats.students_count || 0}</span> students, managing <span className="text-white">{safeStats.admins_count || 0}</span> admins + <span className="text-white">{safeStats.owners_count || 0}</span> owners, analyzing <span className="text-white">{safeStats.courses_count || 0}</span> courses.</>
                                }
                            </p>
                        </div>
                        <div className="flex shrink-0 gap-3">
                            <Link href={route('admin.students.index')} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-xl shadow-white/10">{t.manageStudents}</Link>
                            <Link href={route('admin.reports.demand')} className="bg-white/5 border border-white/10 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-white/10 transition-all">{t.liveReports}</Link>
                        </div>
                    </div>
                </div>

                {/* KPI Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                    <StatCard title={t.totalStudents} value={safeStats.students_count || 0} icon="👨‍🎓" color="indigo" trend={`${t.activeNow}: ${safeStats.active_students_now || 0}`} link={route('admin.students.index')} isDark={isDark} tLabel={t.statsTracker} />
                    <StatCard title={t.admins} value={safeStats.admins_count || 0} icon="⚙️" color="violet" trend={`${t.activeNow}: ${safeStats.active_admins_now || 0}`} isDark={isDark} tLabel={t.statsTracker} />
                    <StatCard title={t.courses} value={safeStats.courses_count || 0} icon="📚" color="emerald" trend={`${safeStats.compulsory_count || 0} ${t.majorCourses}`} link={route('admin.courses')} isDark={isDark} tLabel={t.statsTracker} />
                    <StatCard title={t.simulatorRequests} value={safeDemandReport.reduce((acc, curr) => acc + Number(curr?.cart_users_count || 0), 0)} icon="🛒" color="rose" trend={t.nextSemesterForecast} link={route('admin.reports.demand')} isDark={isDark} tLabel={t.statsTracker} />
                    <StatCard title={t.systemStatus} value="100%" icon="🛡️" color="amber" trend={t.systemProtected} isDark={isDark} tLabel={t.statsTracker} />
                    <StatCard title={t.academicCoverage} value={`${safePlatform.colleges_count || 0}/${safePlatform.majors_count || 0}`} icon="🏛️" color="indigo" trend={t.collegesSlashMajors} link={route('admin.courses')} isDark={isDark} tLabel={t.statsTracker} />
                </div>

                {/* Online Users Section */}
                <div className={`${card} rounded-[2.5rem] p-8 shadow-sm`}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className={`text-xl font-black ${heading} flex items-center gap-3`}>
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            </span>
                            {t.onlineUsers}
                        </h3>
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{safeOnlineUsers.length} متصل</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {safeOnlineUsers.length > 0 ? (
                            safeOnlineUsers.map((user) => (
                                <div
                                    key={`${user.id}-${user.email}`}
                                    className={`p-4 border rounded-2xl transition-all ${
                                        isDark
                                            ? 'bg-slate-800/50 border-slate-700 hover:border-emerald-500/50'
                                            : 'bg-slate-50 border-slate-100 hover:border-emerald-300'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className={`text-lg flex-shrink-0 ${user.role === 'admin' ? '⚙️' : user.role === 'owner' ? '👑' : '👤'}`}></span>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-black truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{user.name}</p>
                                                <p className={`text-[10px] font-bold truncate ${subtext}`}>{user.email}</p>
                                            </div>
                                        </div>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 ml-2"></span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-3 border-t" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                                        <span className={`text-[10px] font-black uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {user.role === 'admin' ? t.admin_role : user.role === 'owner' ? 'Owner' : t.student_role}
                                        </span>
                                        <span className={`text-[10px] font-bold ${subtext}`}>{user.last_activity_ago}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={`col-span-full text-center py-12 px-4 rounded-xl ${isDark ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
                                <p className={`text-sm font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.noOnlineUsers}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reports + Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className={`lg:col-span-2 ${card} rounded-[2.5rem] p-8 shadow-sm`}>
                        <div className="flex justify-between items-center mb-8">
                            <h3 className={`text-xl font-black ${heading} flex items-center gap-3`}>
                                <span className="text-indigo-500 text-2xl">🔥</span> {t.topDemand}
                            </h3>
                            <Link href={route('admin.reports.demand')} className="text-xs font-black text-indigo-500 hover:underline">{t.viewFullReport}</Link>
                        </div>
                        <div className="space-y-6">
                            {safeDemandReport.slice(0, 5).map((item) => (
                                <div key={item.id} className="group">
                                    <div className="flex justify-between mb-2">
                                        <span className={`text-xs font-black group-hover:text-indigo-500 transition-colors ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.name}</span>
                                        <span className={`text-[10px] font-bold ${subtext}`}>{item.cart_users_count} {t.student}</span>
                                    </div>
                                    <div className={`w-full h-2 ${isDark ? 'bg-slate-700' : 'bg-slate-100'} rounded-full overflow-hidden`}>
                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000" style={{ width: `${(Number(item.cart_users_count || 0) / demandBase) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                            {safeDemandReport.length === 0 && <p className={`text-center py-10 font-bold ${subtext}`}>{t.noSimulatorData}</p>}
                        </div>
                    </div>

                    <div className={`${cardAlt} rounded-[2.5rem] p-8`}>
                        <h3 className={`text-lg font-black ${heading} mb-6`}>{t.quickActions}</h3>
                        <div className="space-y-4">
                            <QuickLink title={t.studentReports} icon="🛠️" href={route('admin.issues.index')} isDark={isDark} />
                            <QuickLink title={t.addCollege} icon="🏛️" href={route('admin.structure')} isDark={isDark} />
                            <QuickLink title={t.updatePlan} icon="🌳" href={route('admin.courses')} isDark={isDark} />
                            <QuickLink title={t.activityLog} icon="📜" href={route('admin.logs')} isDark={isDark} />
                            <ClearCacheButton />
                        </div>
                        <div className="mt-8 p-6 bg-indigo-600 rounded-3xl text-white relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 group-hover:scale-125 transition-transform">🧠</div>
                            <p className="text-[10px] font-black opacity-60 uppercase mb-1">AI Advisor Status</p>
                            <h4 className="text-sm font-black mb-3">{t.aiStatus}</h4>
                            <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black transition-all">{t.configAlgo}</button>
                        </div>
                    </div>
                </div>

                {/* Bottom panels */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className={`${card} rounded-[2rem] p-6 sm:p-7 shadow-sm`}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className={`text-lg font-black ${heading} flex items-center gap-2`}>🛠️ {t.latestReports}</h3>
                            <Link href={route('admin.issues.index')} className="text-xs font-black text-indigo-500 hover:underline">{t.viewAll}</Link>
                        </div>
                        <div className="space-y-3">
                            {safeRecentIssues.length > 0 ? safeRecentIssues.map((issue) => (
                                <div key={issue.id} className={`p-3.5 border rounded-xl transition-colors ${logRow}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className={`text-[13px] font-black ${heading}`}>#{issue.id} {issue.subject}</p>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${getStatusBadge(issue.status)}`}>{getStatusLabel(issue.status)}</span>
                                    </div>
                                    <p className={`text-[11px] font-bold ${subtext}`}>{issue.user?.name || t.unknown} • {new Date(issue.created_at).toLocaleString()}</p>
                                </div>
                            )) : <p className={`text-sm font-bold py-8 text-center ${subtext}`}>{t.noNewReports}</p>}
                        </div>
                    </div>

                    <div className={`${card} rounded-[2rem] p-6 sm:p-7 shadow-sm`}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className={`text-lg font-black ${heading} flex items-center gap-2`}>📜 {t.adminLog}</h3>
                            <span className={`text-xs font-black ${subtext}`}>{t.lastMoves(safeLogs.length)}</span>
                        </div>
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                            {safeLogs.length > 0 ? safeLogs.map((log) => (
                                <div key={log.id} className={`p-3.5 border rounded-xl transition-colors ${logRow}`}>
                                    <p className="text-[11px] font-black text-indigo-500 mb-1">{log.action}</p>
                                    <p className={`text-[13px] font-bold leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{log.details}</p>
                                    <p className={`text-[10px] font-black mt-1.5 ${subtext}`}>{log.user?.name || 'System'} • {new Date(log.created_at).toLocaleString()}</p>
                                </div>
                            )) : <p className={`text-sm font-bold py-8 text-center ${subtext}`}>{t.noLogEntries}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

/* ── Sub-components ── */

function StatCard({ title, value, icon, color, link = '#', trend, isDark, tLabel }) {
    const colors = {
        indigo: { gradient: 'from-indigo-500 to-blue-600', dot: 'text-indigo-500' },
        violet: { gradient: 'from-violet-500 to-purple-600', dot: 'text-violet-500' },
        emerald: { gradient: 'from-emerald-500 to-teal-600', dot: 'text-emerald-500' },
        rose: { gradient: 'from-rose-500 to-pink-600', dot: 'text-rose-500' },
        amber: { gradient: 'from-amber-500 to-orange-600', dot: 'text-amber-500' },
        slate: { gradient: 'from-slate-500 to-slate-700', dot: 'text-slate-500' },
    };
    const c = colors[color] || colors.slate;
    return (
        <Link href={link} className="block group">
            <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-all duration-300 group-hover:-translate-y-2 ${isDark ? 'bg-slate-800/60 border-slate-700 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]' : 'bg-white border-slate-100 hover:shadow-xl'}`}>
                <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${c.gradient} text-white shadow-lg transition-transform group-hover:rotate-6`}>{icon}</div>
                    <div className={`text-[8px] font-black uppercase tracking-widest mt-2 ${isDark ? 'text-slate-500' : 'text-slate-300'}`}>{tLabel}</div>
                </div>
                <h3 className={`text-4xl font-black tracking-tighter mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
                <p className={`text-[11px] font-black uppercase mb-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{title}</p>
                <div className={`flex items-center gap-1.5 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-50'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full bg-current ${c.dot}`}></span>
                    <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{trend}</span>
                </div>
            </div>
        </Link>
    );
}

function QuickLink({ title, icon, href, isDark }) {
    return (
        <Link href={href} className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${isDark ? 'bg-slate-800/50 border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
            <div className="flex items-center gap-3">
                <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
                <span className={`text-xs font-black ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</span>
            </div>
            <span className={`transition-colors text-lg ${isDark ? 'text-slate-600 group-hover:text-indigo-400' : 'text-slate-300 group-hover:text-indigo-500'}`}>←</span>
        </Link>
    );
}