import React from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

export default function AdminLogs({ auth, logs = [] }) {
    const [query, setQuery] = React.useState('');

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

    return (
        <AdminLayout user={auth?.user}>
            <Head title="سجل العمليات | سنفور" />

            <div className="space-y-8" dir="rtl">
                <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-slate-200">
                    <h1 className="text-2xl font-black text-slate-800 mb-2">📜 سجل عمليات الإدارة</h1>
                    <p className="text-sm font-bold text-slate-500">صفحة مستقلة لمتابعة كل عمليات الإضافة، التعديل، والحذف.</p>
                </div>

                <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-[900] text-slate-800 tracking-tight">🕵️ سجل نشاطات النظام</h2>
                            <p className="text-[11px] font-bold text-slate-400 mt-1">آخر {logs.length} عملية موثقة في النظام.</p>
                        </div>
                        <div className="w-64">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="بحث بالعملية أو المسؤول..."
                                className="w-full rounded-xl border-slate-200 bg-white text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right whitespace-nowrap">
                            <thead className="sticky top-0 bg-white text-slate-400 text-[11px] font-black uppercase tracking-widest border-b border-slate-100 z-10">
                                <tr>
                                    <th className="p-5">التاريخ والوقت</th>
                                    <th className="p-5">المسؤول (الأدمن)</th>
                                    <th className="p-5">تفاصيل العملية</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm">
                                {filteredLogs.length > 0 ? filteredLogs.map((log) => {
                                    const action = String(log.action || '').toLowerCase();
                                    const badgeClass = action.includes('add')
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : action.includes('delete')
                                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                                            : 'bg-blue-50 text-blue-600 border-blue-100';

                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-5 text-slate-400 font-mono text-[11px] font-bold" dir="ltr">
                                                {new Date(log.created_at).toLocaleString('en-GB')}
                                            </td>
                                            <td className="p-5 font-[900] text-slate-700 flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">
                                                    {log.user?.name?.charAt(0) || '?'}
                                                </div>
                                                {log.user?.name || 'مستخدم غير معروف'}
                                            </td>
                                            <td className="p-5 text-slate-500 font-bold whitespace-normal">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ml-2 border ${badgeClass}`}>
                                                    {log.action}
                                                </span>
                                                {log.details}
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="3" className="p-10 text-center text-slate-400 font-bold">لا توجد عمليات مطابقة للبحث.</td>
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
