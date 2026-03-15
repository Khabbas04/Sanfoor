import React from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

export default function AdminDashboard({ auth, stats, platform = {}, demandReport = [], issueSummary = {}, recentIssues = [], logs = [] }) {
    return (
        <AdminLayout user={auth.user}>
            <Head title="لوحة التحكم المركزية - سنفور" />

            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in { animation: slideInRight 0.5s ease-out forwards; }
                .delay-100 { animation-delay: 100ms; }
                .delay-200 { animation-delay: 200ms; }
            `}</style>

            <div className="space-y-8 pb-10" dir="rtl">
                
                {/* 1. الترحيب والبحث السريع */}
                <div className="relative overflow-hidden bg-[#0b0f19] rounded-[3rem] p-10 text-white shadow-2xl border border-white/5">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                    <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/20 blur-[100px] rounded-full"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="max-w-2xl text-center md:text-right">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black tracking-widest uppercase mb-6">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                                بنية تحتية نشطة • v2.1.4
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
                                أهلاً بك، <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">{auth.user.name}</span> 👋
                            </h1>
                            <p className="text-slate-400 font-bold text-sm md:text-base leading-relaxed">
                                نراقب الآن أداء <span className="text-white">{stats.students_count}</span> طالب، وإدارة <span className="text-white">{stats.admins_count || 0}</span> أدمن + <span className="text-white">{stats.owners_count || 0}</span> مالك نظام، مع تحليل <span className="text-white">{stats.courses_count}</span> مادة أكاديمية.
                            </p>
                        </div>
                        <div className="flex shrink-0 gap-3">
                            <Link href={route('admin.students.index')} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-xl shadow-white/10">إدارة الطلاب</Link>
                            <Link href={route('admin.reports.demand')} className="bg-white/5 border border-white/10 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-white/10 transition-all">التقارير الحية</Link>
                        </div>
                    </div>
                </div>

                {/* 2. الإحصائيات الرئيسية - Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                    <StatCard 
                        title="إجمالي الطلاب" 
                        value={stats.students_count} 
                        icon="👨‍🎓" 
                        color="indigo" 
                        trend="نشطين حالياً"
                        link={route('admin.students.index')}
                    />
                    <StatCard 
                        title="المواد الدراسية" 
                        value={stats.courses_count} 
                        icon="📚" 
                        color="violet" 
                        trend={`${stats.compulsory_count} مادة تخصص`}
                        link={route('admin.courses')}
                    />
                    <StatCard 
                        title="طلبات المحاكي" 
                        value={demandReport.reduce((acc, curr) => acc + parseInt(curr.cart_users_count), 0)} 
                        icon="🛒" 
                        color="emerald" 
                        trend="توقعات الفصل القادم"
                        link={route('admin.reports.demand')}
                    />
                    <StatCard 
                        title="حالة النظام" 
                        value="100%" 
                        icon="🛡️" 
                        color="rose" 
                        trend="حماية Postgre فعال"
                    />
                    <StatCard 
                        title="بلاغات مفتوحة" 
                        value={issueSummary.open || 0} 
                        icon="🛠️" 
                        color="amber" 
                        trend={`إجمالي البلاغات: ${issueSummary.total || 0}`}
                        link={route('admin.issues.index')}
                    />
                    <StatCard 
                        title="التغطية الأكاديمية" 
                        value={`${platform.colleges_count || 0}/${platform.majors_count || 0}`} 
                        icon="🏛️" 
                        color="indigo" 
                        trend="كليات / تخصصات"
                        link={route('admin.courses')}
                    />
                </div>

                {/* 3. التقارير والوصول السريع */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* خريطة طلب المواد المصغرة */}
                    <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <span className="text-indigo-600 text-2xl">🔥</span> المواد الأكثر طلباً (Top 5)
                            </h3>
                            <Link href={route('admin.reports.demand')} className="text-xs font-black text-indigo-600 hover:underline">عرض التقرير الكامل ←</Link>
                        </div>
                        <div className="space-y-6">
                            {demandReport.slice(0, 5).map((item, idx) => (
                                <div key={item.id} className="group">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-xs font-black text-slate-600 group-hover:text-indigo-600 transition-colors">{item.name}</span>
                                        <span className="text-[10px] font-bold text-slate-400">{item.cart_users_count} طالب</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000" 
                                            style={{ width: `${(item.cart_users_count / stats.students_count) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                            {demandReport.length === 0 && <p className="text-center py-10 text-slate-400 font-bold">لا يوجد بيانات محاكي مسجلة حالياً.</p>}
                        </div>
                    </div>

                    {/* وصول سريع لمهام المدير */}
                    <div className="bg-[#f8fafc] rounded-[2.5rem] p-8 border border-slate-200">
                        <h3 className="text-lg font-black text-slate-800 mb-6">إجراءات سريعة</h3>
                        <div className="space-y-4">
                            <QuickLink title="بلاغات الطلاب" icon="🛠️" route={route('admin.issues.index')} />
                            <QuickLink title="إضافة كلية جديدة" icon="🏛️" route={route('admin.courses')} />
                            <QuickLink title="تحديث خطة تخصص" icon="🌳" route={route('admin.courses')} />
                            <QuickLink title="سجل حركات الإدارة" icon="📜" route={route('admin.dashboard')} />
                            <QuickLink title="تفريغ كاش النظام" icon="🧹" route={route('admin.dashboard')} />
                        </div>
                        
                        <div className="mt-8 p-6 bg-indigo-600 rounded-3xl text-white relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 group-hover:scale-125 transition-transform">🧠</div>
                            <p className="text-[10px] font-black opacity-60 uppercase mb-1">AI Advisor Status</p>
                            <h4 className="text-sm font-black mb-3">ذكاء اصطناعي نشط</h4>
                            <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-[10px] font-black transition-all">تهيئة الخوارزميات</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="bg-white rounded-[2rem] p-6 sm:p-7 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">🛠️ آخر البلاغات</h3>
                            <Link href={route('admin.issues.index')} className="text-xs font-black text-indigo-600 hover:underline">عرض الكل</Link>
                        </div>
                        <div className="space-y-3">
                            {recentIssues.length > 0 ? recentIssues.map((issue) => (
                                <div key={issue.id} className="p-3.5 border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-[13px] font-black text-slate-800">#{issue.id} {issue.subject}</p>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${issue.status === 'open' ? 'bg-rose-100 text-rose-700' : issue.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                            {issue.status === 'open' ? 'مفتوح' : issue.status === 'in_progress' ? 'قيد المعالجة' : 'محلول'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-500">{issue.user?.name || 'غير معروف'} • {new Date(issue.created_at).toLocaleString()}</p>
                                </div>
                            )) : (
                                <p className="text-sm text-slate-400 font-bold py-8 text-center">لا توجد بلاغات جديدة.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] p-6 sm:p-7 shadow-sm border border-slate-200">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">📜 سجل حركات الإدارة</h3>
                            <span className="text-xs font-black text-slate-400">آخر {logs.length} حركة</span>
                        </div>
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                            {logs.length > 0 ? logs.map((log) => (
                                <div key={log.id} className="p-3.5 border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors">
                                    <p className="text-[11px] font-black text-indigo-600 mb-1">{log.action}</p>
                                    <p className="text-[13px] font-bold text-slate-700 leading-relaxed">{log.details}</p>
                                    <p className="text-[10px] font-black text-slate-400 mt-1.5">{log.user?.name || 'System'} • {new Date(log.created_at).toLocaleString()}</p>
                                </div>
                            )) : (
                                <p className="text-sm text-slate-400 font-bold py-8 text-center">لا توجد حركات مسجلة حالياً.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

/* ═══════════════════════════════════════════════════════════
   المكونات المساعدة (UI Logic)
   ═══════════════════════════════════════════════════════════ */

function StatCard({ title, value, icon, color, trend, link = "#" }) {
    const colors = {
        indigo: "from-indigo-500 to-blue-600 text-indigo-600 bg-indigo-50 shadow-indigo-100",
        violet: "from-violet-500 to-purple-600 text-violet-600 bg-violet-50 shadow-violet-100",
        emerald: "from-emerald-500 to-teal-600 text-emerald-600 bg-emerald-50 shadow-emerald-100",
        rose: "from-rose-500 to-pink-600 text-rose-600 bg-rose-50 shadow-rose-100"
    };

    return (
        <Link href={link} className="block group">
            <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-xl ${colors[color].split(' ').slice(-1)}`}>
                <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${colors[color].split(' ').slice(0,2).join(' ')} text-white shadow-lg transition-transform group-hover:rotate-6`}>
                        {icon}
                    </div>
                    <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-2 group-hover:text-slate-400 transition-colors">Stats Tracker</div>
                </div>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{value}</h3>
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4">{title}</p>
                <div className="flex items-center gap-1.5 pt-4 border-t border-slate-50">
                    <span className={`w-1.5 h-1.5 rounded-full bg-current ${colors[color].split(' ')[2]}`}></span>
                    <span className="text-[10px] font-bold text-slate-500">{trend}</span>
                </div>
            </div>
        </Link>
    );
}

function QuickLink({ title, icon, route }) {
    return (
        <Link href={route} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group">
            <div className="flex items-center gap-3">
                <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
                <span className="text-xs font-black text-slate-700">{title}</span>
            </div>
            <span className="text-slate-300 group-hover:text-indigo-500 transition-colors text-lg">←</span>
        </Link>
    );
}