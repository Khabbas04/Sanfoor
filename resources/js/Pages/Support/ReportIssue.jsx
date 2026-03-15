import React from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

export default function ReportIssue({ current_url = '', categories = {} }) {
    const { flash } = usePage().props;

    const { data, setData, post, processing, errors, reset } = useForm({
        category: 'other',
        subject: '',
        message: '',
        priority: 'medium',
        page_url: current_url || '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('support.issue.store'), {
            onSuccess: () => {
                reset('subject', 'message');
            },
        });
    };

    const priorities = {
        low: 'منخفضة',
        medium: 'متوسطة',
        high: 'عاجلة',
    };

    return (
        <MainLayout>
            <Head title="الإبلاغ عن مشكلة - سنفور" />

            <div className="min-h-screen py-10 sm:py-14" dir="rtl">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] overflow-hidden">
                        <div className="relative px-6 sm:px-10 py-8 sm:py-10 bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white">
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                            <div className="relative z-10">
                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black">🛠️ مركز الدعم</span>
                                <h1 className="mt-4 text-2xl sm:text-4xl font-black leading-tight">الإبلاغ عن مشكلة</h1>
                                <p className="mt-3 text-indigo-100/80 font-bold text-sm sm:text-base leading-relaxed">
                                    واجهت مشكلة في النظام؟ اكتب التفاصيل بوضوح، وسيظهر البلاغ مباشرة في لوحة الأدمن للمتابعة.
                                </p>
                            </div>
                        </div>

                        <div className="p-6 sm:p-10">
                            {flash?.message && (
                                <div className={`mb-6 rounded-xl border px-4 py-3 text-sm font-bold ${flash?.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                    {flash.message}
                                </div>
                            )}

                            <form onSubmit={submit} className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-black text-slate-700 mb-2">القسم</label>
                                        <select
                                            value={data.category}
                                            onChange={(e) => setData('category', e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        >
                                            {Object.entries(categories).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                        {errors.category && <p className="mt-1 text-xs font-bold text-rose-600">{errors.category}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-black text-slate-700 mb-2">الأولوية</label>
                                        <select
                                            value={data.priority}
                                            onChange={(e) => setData('priority', e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        >
                                            {Object.entries(priorities).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                        {errors.priority && <p className="mt-1 text-xs font-bold text-rose-600">{errors.priority}</p>}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2">عنوان المشكلة</label>
                                    <input
                                        type="text"
                                        value={data.subject}
                                        onChange={(e) => setData('subject', e.target.value)}
                                        placeholder="مثال: الشجرة لا تفتح على الجوال"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                    {errors.subject && <p className="mt-1 text-xs font-bold text-rose-600">{errors.subject}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2">تفاصيل المشكلة</label>
                                    <textarea
                                        rows={7}
                                        value={data.message}
                                        onChange={(e) => setData('message', e.target.value)}
                                        placeholder="اكتب الخطوات التي سببت المشكلة، وما المتوقع وما الذي حدث فعليًا..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-y"
                                    />
                                    {errors.message && <p className="mt-1 text-xs font-bold text-rose-600">{errors.message}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2">رابط الصفحة (اختياري)</label>
                                    <input
                                        type="url"
                                        value={data.page_url}
                                        onChange={(e) => setData('page_url', e.target.value)}
                                        placeholder="https://..."
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                    {errors.page_url && <p className="mt-1 text-xs font-bold text-rose-600">{errors.page_url}</p>}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
                                    >
                                        {processing ? 'جاري الإرسال...' : 'إرسال البلاغ'}
                                    </button>

                                    <Link
                                        href={route('dashboard')}
                                        className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-colors text-center"
                                    >
                                        رجوع للوحة التحكم
                                    </Link>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
