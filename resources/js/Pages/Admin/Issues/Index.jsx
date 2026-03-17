import React, { useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';

const statusLabels = {
    open: 'مفتوح',
    in_progress: 'قيد المعالجة',
    resolved: 'محلول',
};

const statusClass = {
    open: 'bg-rose-50 text-rose-700 border-rose-100',
    in_progress: 'bg-amber-50 text-amber-700 border-amber-100',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const priorityClass = {
    low: 'bg-slate-100 text-slate-600 border-slate-200',
    medium: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    high: 'bg-rose-50 text-rose-700 border-rose-100',
};

const priorityLabel = {
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عاجلة',
};

export default function AdminIssuesIndex({ auth, issues = [], filters = {}, summary = {} }) {
    const [query, setQuery] = useState('');

    const setStatus = (issueId, status) => {
        router.put(route('admin.issues.update_status', issueId), { status }, { preserveScroll: true });
    };

    const removeIssue = async (issueId) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'تأكيد الحذف',
            text: 'هل أنت متأكد من حذف هذا البلاغ نهائياً؟',
            showCancelButton: true,
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء',
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

    return (
        <AdminLayout user={auth.user}>
            <Head title="بلاغات الطلاب - لوحة الإدارة" />

            <div className="space-y-6" dir="rtl">
                <div className="rounded-[2rem] bg-[#0b0f19] border border-white/5 text-white p-6 sm:p-8">
                    <h1 className="text-2xl sm:text-3xl font-black">بلاغات الطلاب</h1>
                    <p className="mt-2 text-sm font-bold text-indigo-200/70">
                        جميع بلاغات المشاكل المرسلة من الطلاب تظهر هنا للمتابعة والتحديث.
                    </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <SummaryCard title="الكل" value={summary.total || 0} color="slate" />
                    <SummaryCard title="مفتوحة" value={summary.open || 0} color="rose" />
                    <SummaryCard title="قيد المعالجة" value={summary.in_progress || 0} color="amber" />
                    <SummaryCard title="محلولة" value={summary.resolved || 0} color="emerald" />
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-2 sticky top-24 z-10">
                    <button onClick={() => applyFilter('')} className={`px-4 py-2 rounded-xl text-xs font-black border ${!filters.status ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>كل البلاغات</button>
                    <button onClick={() => applyFilter('open')} className={`px-4 py-2 rounded-xl text-xs font-black border ${filters.status === 'open' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>مفتوحة</button>
                    <button onClick={() => applyFilter('in_progress')} className={`px-4 py-2 rounded-xl text-xs font-black border ${filters.status === 'in_progress' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>قيد المعالجة</button>
                    <button onClick={() => applyFilter('resolved')} className={`px-4 py-2 rounded-xl text-xs font-black border ${filters.status === 'resolved' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>محلولة</button>
                    <div className="mr-auto w-full sm:w-72">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="بحث بالعنوان أو الوصف..."
                            className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    {visibleIssues.map((issue) => (
                        <article key={issue.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-black border bg-slate-100 text-slate-700 border-slate-200">#{issue.id}</span>
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${statusClass[issue.status] || statusClass.open}`}>{statusLabels[issue.status] || issue.status}</span>
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border ${priorityClass[issue.priority] || priorityClass.medium}`}>{priorityLabel[issue.priority] || issue.priority}</span>
                                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-black border bg-indigo-50 text-indigo-700 border-indigo-100">{issue.category}</span>
                                    </div>

                                    <h2 className="text-lg font-black text-slate-900">{issue.subject}</h2>
                                    <p className="text-sm font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">{issue.message}</p>

                                    <div className="text-xs font-bold text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>الطالب: {issue.user?.name || 'غير معروف'}</span>
                                        <span>البريد: {issue.user?.email || '-'}</span>
                                        <span>التاريخ: {new Date(issue.created_at).toLocaleString()}</span>
                                    </div>

                                    {issue.page_url && (
                                        <a href={issue.page_url} target="_blank" rel="noreferrer" className="inline-flex text-xs font-black text-indigo-600 hover:text-indigo-700">
                                            فتح الصفحة المتأثرة ↗
                                        </a>
                                    )}
                                </div>

                                <div className="flex lg:flex-col gap-2 lg:min-w-[170px]">
                                    <button onClick={() => setStatus(issue.id, 'open')} className="px-3 py-2 rounded-lg text-xs font-black border bg-white text-slate-600 border-slate-200 hover:bg-slate-50">مفتوح</button>
                                    <button onClick={() => setStatus(issue.id, 'in_progress')} className="px-3 py-2 rounded-lg text-xs font-black border bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100">قيد المعالجة</button>
                                    <button onClick={() => setStatus(issue.id, 'resolved')} className="px-3 py-2 rounded-lg text-xs font-black border bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100">محلول</button>
                                    <button onClick={() => removeIssue(issue.id)} className="px-3 py-2 rounded-lg text-xs font-black border bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100">حذف البلاغ</button>
                                </div>
                            </div>
                        </article>
                    ))}

                    {visibleIssues.length === 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
                            <p className="text-slate-400 font-black">لا توجد بلاغات مطابقة للفلتر الحالي.</p>
                            <Link href={route('admin.dashboard')} className="mt-4 inline-flex text-sm font-black text-indigo-600 hover:text-indigo-700">
                                الرجوع للوحة الرئيسية
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

function SummaryCard({ title, value, color }) {
    const colors = {
        slate: 'from-slate-500 to-slate-700',
        rose: 'from-rose-500 to-rose-700',
        amber: 'from-amber-500 to-orange-600',
        emerald: 'from-emerald-500 to-emerald-700',
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color] || colors.slate} mb-3`}></div>
            <p className="text-xs font-black text-slate-500 mb-1">{title}</p>
            <p className="text-2xl font-black text-slate-900">{value}</p>
        </div>
    );
}
