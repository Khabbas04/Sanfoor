import React from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Bug, AlertCircle, FileText, Link as LinkIcon, Send, ArrowRight, ShieldAlert } from 'lucide-react';

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
            <Head>
                <title>الإبلاغ عن مشكلة | سنفور</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>

            <div className="min-h-screen pb-16 font-t bg-[#f8f9fb] dark:bg-[#050b14] transition-colors duration-500" dir="rtl">
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-white dark:bg-[#0a0f18] border-b border-slate-200 dark:border-white/5 transition-colors duration-500">
                    <div className="absolute inset-0 bg-center opacity-40 dark:opacity-10" style={{ backgroundImage: "url('/images/grid.svg')" }} />
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[300px] h-[300px] bg-rose-50/60 dark:bg-rose-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[300px] h-[300px] bg-orange-50/50 dark:bg-orange-500/10 rounded-full blur-3xl" />
                    
                    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 text-[11px] font-black tracking-wide mb-6 shadow-sm">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            مركز الدعم الفني
                        </span>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
                            الإبلاغ عن <span className="text-transparent bg-clip-text bg-gradient-to-l from-rose-500 to-orange-400">مشكلة تقنية</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                            هل واجهت خطأ برمجي أو مشكلة في النظام؟ يرجى كتابة التفاصيل بوضوح لنتمكن من حلها في أسرع وقت. سيصل بلاغك مباشرة لفريق التطوير.
                        </p>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
                    <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-10 shadow-xl shadow-slate-200/20 dark:shadow-none transition-colors duration-500">
                        
                        {flash?.message && (
                            <div className={`mb-8 flex items-start gap-3 p-4 rounded-2xl border ${flash?.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-800 dark:text-amber-400'}`}>
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="font-black text-sm">{flash.message}</p>
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">نوع المشكلة (القسم)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 dark:text-slate-500">
                                            <Bug className="w-4 h-4" />
                                        </div>
                                        <select
                                            value={data.category}
                                            onChange={(e) => setData('category', e.target.value)}
                                            className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] pr-11 pl-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-rose-400 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all appearance-none"
                                        >
                                            {Object.entries(categories).map(([key, label]) => (
                                                <option key={key} value={key} className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {errors.category && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.category}</p>}
                                </div>

                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">أولوية المعالجة</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 dark:text-slate-500">
                                            <AlertCircle className="w-4 h-4" />
                                        </div>
                                        <select
                                            value={data.priority}
                                            onChange={(e) => setData('priority', e.target.value)}
                                            className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] pr-11 pl-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-rose-400 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all appearance-none"
                                        >
                                            {Object.entries(priorities).map(([key, label]) => (
                                                <option key={key} value={key} className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {errors.priority && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.priority}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">عنوان المشكلة باختصار</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 dark:text-slate-500">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="text"
                                        value={data.subject}
                                        onChange={(e) => setData('subject', e.target.value)}
                                        placeholder="مثال: الشجرة لا تفتح على الموبايل، أو خطأ عند تسجيل الدخول..."
                                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] pr-11 pl-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-rose-400 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all"
                                    />
                                </div>
                                {errors.subject && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.subject}</p>}
                            </div>

                            <div>
                                <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">تفاصيل المشكلة والخطوات التي أدت لها</label>
                                <textarea
                                    rows={6}
                                    value={data.message}
                                    onChange={(e) => setData('message', e.target.value)}
                                    placeholder="اكتب بالتفصيل: ما الذي كنت تحاول فعله؟ وما الذي حدث بدلاً منه؟ وهل تظهر أي رسالة خطأ؟"
                                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-4 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-rose-400 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all resize-y"
                                />
                                {errors.message && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.message}</p>}
                            </div>

                            <div>
                                <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">رابط الصفحة المتأثرة <span className="text-slate-400 dark:text-slate-500 font-normal">(اختياري ولكن يساعدنا جداً)</span></label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 dark:text-slate-500">
                                        <LinkIcon className="w-4 h-4" />
                                    </div>
                                    <input
                                        type="url"
                                        value={data.page_url}
                                        onChange={(e) => setData('page_url', e.target.value)}
                                        placeholder="https://sanfoor.me/..."
                                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] pr-11 pl-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-rose-400 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all text-left dir-ltr"
                                    />
                                </div>
                                {errors.page_url && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.page_url}</p>}
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-white/5">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white font-black text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-rose-500/30 disabled:opacity-50"
                                >
                                    {processing ? 'جاري الإرسال...' : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            إرسال البلاغ للفريق
                                        </>
                                    )}
                                </button>

                                <Link
                                    href={route('dashboard')}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 font-black text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    رجوع للوحة التحكم
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
