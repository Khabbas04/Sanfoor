import { Head, Link, useForm, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Mail, Briefcase, Clock, Send, AlertCircle, MessageSquare } from 'lucide-react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const channels = [
    {
        title: 'البريد الإلكتروني',
        value: 'noreply@sanfoor.me',
        href: 'mailto:noreply@sanfoor.me',
        note: 'لطلبات الشراكات والاستفسارات العامة.',
        icon: Mail,
        color: 'from-blue-400 to-blue-600',
        bg: 'bg-blue-50',
        text: 'text-blue-700'
    },
    {
        title: 'فرص الانضمام',
        value: 'فريق التطوير والمحتوى',
        href: null,
        note: 'نرحب دائماً بالطلاب الشغوفين للانضمام والمساهمة في سنفور.',
        icon: Briefcase,
        color: 'from-indigo-400 to-indigo-600',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700'
    },
    {
        title: 'ساعات الاستجابة',
        value: 'خلال 24-48 ساعة',
        href: null,
        note: 'نقوم بمراجعة جميع الطلبات بعناية للرد بشكل دقيق.',
        icon: Clock,
        color: 'from-emerald-400 to-emerald-600',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700'
    },
];

export default function Contact() {
    const { auth, flash } = usePage().props;

    const { data, setData, post, processing, errors, reset } = useForm({
        name: auth?.user?.name || '',
        email: auth?.user?.email || '',
        phone: '',
        subject: '',
        message: '',
        source_page: `${siteUrl}/contact-us`,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('public.contact.store'), {
            onSuccess: () => {
                reset('phone', 'subject', 'message');
            },
        });
    };

    return (
        <MainLayout>
            <Head>
                <title>تواصل معنا | سنفور</title>
                <meta name="description" content="تواصل مع فريق سنفور وكن جزءاً من مسيرتنا، سواء للانضمام للفريق، الشراكات، أو الاستفسارات العامة." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/contact-us`} />
            </Head>

            <div className="min-h-screen pb-16 font-t bg-[#f8f9fb]" dir="rtl">
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-white border-b border-slate-200">
                    <div className="absolute inset-0 bg-[url('/images/grid.svg')] bg-center opacity-40" />
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[300px] h-[300px] bg-blue-50/60 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[300px] h-[300px] bg-indigo-50/50 rounded-full blur-3xl" />
                    
                    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-black tracking-wide mb-6 shadow-sm">
                            <MessageSquare className="w-3.5 h-3.5" />
                            نحن هنا للاستماع
                        </span>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
                            انضم إلينا <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-indigo-400">وتواصل معنا</span>
                        </h1>
                        <p className="text-slate-500 font-bold text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                            هل ترغب في الانضمام لفريق مطوري وداعمي سنفور؟ أو لديك فكرة رائعة للشراكة والتعاون؟ نحن نبحث دائماً عن العقول المبدعة.
                        </p>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                        {channels.map((channel, idx) => (
                            <div key={idx} className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${channel.color} text-white flex items-center justify-center mb-5 shadow-sm`}>
                                    <channel.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 mb-1">{channel.title}</h3>
                                {channel.href ? (
                                    <a href={channel.href} className={`text-[13px] font-black ${channel.text} hover:underline block mb-2`}>
                                        {channel.value}
                                    </a>
                                ) : (
                                    <p className={`text-[13px] font-black ${channel.text} mb-2`}>{channel.value}</p>
                                )}
                                <p className="text-[13px] font-bold text-slate-500 leading-relaxed">
                                    {channel.note}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-xl shadow-slate-200/20">
                        <div className="mb-8 border-b border-slate-100 pb-6">
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">نموذج التواصل السريع</h2>
                            <p className="text-slate-500 font-bold text-sm">أخبرنا كيف يمكننا التعاون أو تقديم المساعدة، وسنرد عليك قريباً.</p>
                        </div>

                        {flash?.message && (
                            <div className={`mb-8 flex items-start gap-3 p-4 rounded-2xl border ${flash?.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="font-black text-sm">{flash.message}</p>
                            </div>
                        )}

                        <form onSubmit={submit} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 mb-2">الاسم الكامل</label>
                                    <input
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="محمد عبدالله"
                                    />
                                    {errors.name && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 mb-2">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="you@example.com"
                                    />
                                    {errors.email && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.email}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 mb-2">رقم الهاتف <span className="text-slate-400 font-normal">(اختياري)</span></label>
                                    <input
                                        type="text"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="079xxxxxxx"
                                    />
                                    {errors.phone && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.phone}</p>}
                                </div>
                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 mb-2">موضوع الرسالة</label>
                                    <input
                                        type="text"
                                        value={data.subject}
                                        onChange={(e) => setData('subject', e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="مثال: طلب انضمام لفريق التطوير..."
                                    />
                                    {errors.subject && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.subject}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[13px] font-black text-slate-700 mb-2">نص الرسالة</label>
                                <textarea
                                    rows={5}
                                    value={data.message}
                                    onChange={(e) => setData('message', e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all resize-y"
                                    placeholder="اكتب تفاصيل فكرتك، خبراتك، أو استفسارك هنا..."
                                />
                                {errors.message && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.message}</p>}
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                                >
                                    {processing ? 'جاري الإرسال...' : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            إرسال الرسالة
                                        </>
                                    )}
                                </button>
                                
                                <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                    <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                                    للدعم الفني والأعطال، يرجى <Link href={route('support.issue.create')} className="text-blue-600 hover:underline">فتح تذكرة بلاغ</Link> مخصصة بدلاً من هنا.
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
