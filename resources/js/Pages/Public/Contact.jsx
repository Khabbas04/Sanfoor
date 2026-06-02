import { Head, Link, useForm, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const channels = [
    {
        title: 'البريد الإلكتروني',
        value: 'noreply@sanfoor.me',
        href: 'mailto:noreply@sanfoor.me',
        note: 'لطلبات الانضمام للفريق، الاستفسارات العامة، والشراكات.',
        icon: '✉️',
    },
    {
        title: 'فرص الانضمام',
        value: 'التطوع والتدريب',
        href: null,
        note: 'نحن نرحب دائماً بالطلاب الشغوفين للانضمام لفريق التطوير وإدارة المحتوى.',
        icon: '🚀',
    },
    {
        title: 'ساعات الاستجابة',
        value: 'عادة خلال 24-48 ساعة',
        href: null,
        note: 'نقوم بمراجعة جميع الطلبات والرسائل بدقة واهتمام.',
        icon: '⏱️',
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
                <title>انضم إلينا | سنفور</title>
                <meta name="description" content="تواصل مع فريق سنفور وكن جزءاً من مسيرتنا، سواء للانضمام للفريق، الشراكات، أو الاستفسارات العامة." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/contact-us`} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="انضم إلينا | سنفور" />
                <meta property="og:description" content="تواصل وانضم لفريق سنفور." />
                <meta property="og:url" content={`${siteUrl}/contact-us`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
            </Head>

            <div className="min-h-screen py-10 sm:py-14" dir="rtl">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <section className="relative overflow-hidden rounded-[2rem] bg-[#0b1224] text-white p-6 sm:p-10 border border-indigo-500/20 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
                        <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full blur-3xl bg-indigo-500/30" />
                        <div className="absolute -bottom-16 -right-10 w-56 h-56 rounded-full blur-3xl bg-cyan-400/20" />

                        <div className="relative z-10">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black">
                                🚀 Join Us
                            </span>
                            <h1 className="mt-4 text-3xl sm:text-5xl font-black">انضم إلينا وتواصل معنا</h1>
                            <p className="mt-3 text-indigo-100 font-bold text-sm sm:text-base max-w-3xl leading-relaxed">
                                هل ترغب في الانضمام لفريق سنفور؟ أو لديك فكرة للتعاون والشراكة؟ نحن نبحث دائماً عن العقول المبدعة التي تسعى لتطوير تجربة الطالب الجامعي.
                            </p>
                        </div>
                    </section>

                    <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
                        {channels.map((channel) => (
                            <article key={channel.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-2xl">{channel.icon}</div>
                                <h2 className="mt-4 text-xl font-black text-slate-900">{channel.title}</h2>
                                {channel.href ? (
                                    <a href={channel.href} className="mt-2 inline-block text-indigo-700 font-black text-sm hover:text-indigo-800 transition-colors">
                                        {channel.value}
                                    </a>
                                ) : (
                                    <p className="mt-2 text-slate-800 font-black text-sm">{channel.value}</p>
                                )}
                                <p className="mt-2 text-slate-600 font-bold text-sm leading-relaxed">{channel.note}</p>
                            </article>
                        ))}
                    </section>

                    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
                        <h3 className="text-2xl font-black text-slate-900">نموذج الانضمام والتواصل</h3>
                        <p className="mt-2 text-slate-600 font-bold text-sm sm:text-base">
                            املأ النموذج التالي ببياناتك وسنقوم بالتواصل معك في أقرب فرصة.
                        </p>

                        {flash?.message && (
                            <div className={`mt-5 rounded-xl border px-4 py-3 text-sm font-bold ${flash?.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {flash.message}
                            </div>
                        )}

                        <form onSubmit={submit} className="mt-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2">الاسم</label>
                                    <input
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        placeholder="اسمك الكامل"
                                    />
                                    {errors.name && <p className="mt-1 text-xs font-bold text-rose-600">{errors.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        placeholder="you@example.com"
                                    />
                                    {errors.email && <p className="mt-1 text-xs font-bold text-rose-600">{errors.email}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2">رقم الهاتف (اختياري)</label>
                                    <input
                                        type="text"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        placeholder="079xxxxxxx"
                                    />
                                    {errors.phone && <p className="mt-1 text-xs font-bold text-rose-600">{errors.phone}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2">موضوع الرسالة</label>
                                    <input
                                        type="text"
                                        value={data.subject}
                                        onChange={(e) => setData('subject', e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        placeholder="طلب انضمام لفريق المطورين، اقتراح شراكة، ..."
                                    />
                                    {errors.subject && <p className="mt-1 text-xs font-bold text-rose-600">{errors.subject}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">نص الرسالة</label>
                                <textarea
                                    rows={6}
                                    value={data.message}
                                    onChange={(e) => setData('message', e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-y"
                                    placeholder="اكتب تفاصيل طلبك أو خبراتك هنا إن كنت ترغب بالانضمام..."
                                />
                                {errors.message && <p className="mt-1 text-xs font-bold text-rose-600">{errors.message}</p>}
                            </div>

                            <div className="flex flex-wrap gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
                                >
                                    {processing ? 'جاري الإرسال...' : 'إرسال الرسالة'}
                                </button>
                                
                                <p className="text-xs text-slate-500 font-bold self-center mr-4">
                                    إذا كنت تواجه مشكلة فنية، يرجى استخدام <Link href={route('support.issue.create')} className="text-indigo-600 underline">صفحة البلاغات</Link> بدلاً من هذا النموذج.
                                </p>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
