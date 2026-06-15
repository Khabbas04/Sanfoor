import { useState } from 'react';
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
    const [formType, setFormType] = useState('contact'); // 'contact' or 'join'

    const { data, setData, post, processing, errors, reset, transform } = useForm({
        name: auth?.user?.name || '',
        email: auth?.user?.email || '',
        phone: '',
        subject: '',
        message: '',
        
        university_id: '',
        academic_year: '',
        gpa: '',
        major: auth?.user?.major?.name || '',
        experience: '',

        source_page: `${siteUrl}/contact-us`,
    });

    transform((formData) => {
        if (formType === 'join') {
            return {
                ...formData,
                subject: 'طلب انضمام لفريق سنفور',
                message: `الرقم الجامعي: ${formData.university_id}\nالسنة الدراسية: ${formData.academic_year}\nالمعدل التراكمي: ${formData.gpa}\nالتخصص: ${formData.major}\n\nالخبرات والإضافات:\n${formData.experience}`
            };
        }
        return formData;
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('public.contact.store'), {
            onSuccess: () => {
                reset('phone', 'subject', 'message', 'university_id', 'academic_year', 'gpa', 'experience');
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

            <div className="min-h-screen pb-16 font-t bg-[#f8f9fb] dark:bg-[#050b14] transition-colors duration-500" dir="rtl">
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-white dark:bg-[#0a0f18] border-b border-slate-200 dark:border-white/5 transition-colors duration-500">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none select-none z-0 overflow-hidden flex justify-center items-center">
                        <span className="block leading-none text-[5rem] sm:text-[8rem] md:text-[12rem] font-black text-slate-900/[0.03] dark:text-white/[0.03] whitespace-nowrap tracking-tighter">تواصل معنا</span>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[300px] h-[300px] bg-blue-50/60 dark:bg-blue-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[300px] h-[300px] bg-indigo-50/50 dark:bg-indigo-500/10 rounded-full blur-3xl" />
                    
                    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 text-[11px] font-black tracking-wide mb-6 shadow-sm">
                            <MessageSquare className="w-3.5 h-3.5" />
                            نحن هنا للاستماع
                        </span>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
                            انضم إلينا <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-indigo-400">وتواصل معنا</span>
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                            هل ترغب في الانضمام لفريق مطوري وداعمي سنفور؟ أو لديك فكرة رائعة للشراكة والتعاون؟ نحن نبحث دائماً عن العقول المبدعة.
                        </p>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                        {channels.map((channel, idx) => (
                            <div key={idx} className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 shadow-sm hover:shadow-md transition-all duration-300">
                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${channel.color} text-white flex items-center justify-center mb-5 shadow-sm`}>
                                    <channel.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">{channel.title}</h3>
                                {channel.href ? (
                                    <a href={channel.href} className={`text-[13px] font-black ${channel.text} dark:text-blue-400 hover:underline block mb-2`}>
                                        {channel.value}
                                    </a>
                                ) : (
                                    <p className={`text-[13px] font-black ${channel.text} dark:text-blue-400 mb-2`}>{channel.value}</p>
                                )}
                                <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {channel.note}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200/80 dark:border-white/10 p-6 sm:p-10 shadow-xl shadow-slate-200/20 dark:shadow-none transition-colors duration-500">
                        <div className="mb-8 border-b border-slate-100 dark:border-white/5 pb-6">
                            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2">نموذج التواصل السريع</h2>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">أخبرنا كيف يمكننا التعاون أو تقديم المساعدة، وسنرد عليك قريباً.</p>
                        </div>

                        {flash?.message && (
                            <div className={`mb-8 flex items-start gap-3 p-4 rounded-2xl border ${flash?.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-800 dark:text-amber-400'}`}>
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="font-black text-sm">{flash.message}</p>
                            </div>
                        )}

                        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl mb-8 w-full max-w-sm mx-auto shadow-inner border border-slate-200/50 dark:border-white/5">
                            <button
                                type="button"
                                onClick={() => setFormType('contact')}
                                className={`flex-1 py-2.5 text-[13px] font-black rounded-xl transition-all duration-300 ${formType === 'contact' ? 'bg-white dark:bg-[#1e293b] text-blue-700 dark:text-blue-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                            >
                                استفسار وتواصل
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormType('join')}
                                className={`flex-1 py-2.5 text-[13px] font-black rounded-xl transition-all duration-300 ${formType === 'join' ? 'bg-white dark:bg-[#1e293b] text-indigo-700 dark:text-indigo-400 shadow-sm ring-1 ring-slate-200/50 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                            >
                                طلب انضمام للفريق
                            </button>
                        </div>

                        <form onSubmit={submit} className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">الاسم الكامل</label>
                                    <input
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="محمد عبدالله"
                                        required
                                    />
                                    {errors.name && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">البريد الإلكتروني</label>
                                    <input
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                        placeholder="you@example.com"
                                        required
                                    />
                                    {errors.email && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.email}</p>}
                                </div>
                            </div>

                            {formType === 'contact' ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">رقم الهاتف <span className="text-slate-400 dark:text-slate-500 font-normal">(اختياري)</span></label>
                                            <input
                                                type="text"
                                                value={data.phone}
                                                onChange={(e) => setData('phone', e.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                                placeholder="079xxxxxxx"
                                            />
                                            {errors.phone && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.phone}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">موضوع الرسالة</label>
                                            <input
                                                type="text"
                                                value={data.subject}
                                                onChange={(e) => setData('subject', e.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                                                placeholder="مثال: استفسار عن الكورسات..."
                                                required={formType === 'contact'}
                                            />
                                            {errors.subject && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.subject}</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">نص الرسالة</label>
                                        <textarea
                                            rows={5}
                                            value={data.message}
                                            onChange={(e) => setData('message', e.target.value)}
                                            className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-y"
                                            placeholder="اكتب تفاصيل استفسارك أو مشكلتك هنا..."
                                            required={formType === 'contact'}
                                        />
                                        {errors.message && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.message}</p>}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">الرقم الجامعي</label>
                                            <input
                                                type="text"
                                                value={data.university_id}
                                                onChange={(e) => setData('university_id', e.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                                placeholder="مثال: 202110200"
                                                required={formType === 'join'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">السنة الدراسية</label>
                                            <select
                                                value={data.academic_year}
                                                onChange={(e) => setData('academic_year', e.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                                required={formType === 'join'}
                                            >
                                                <option value="" disabled className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">اختر السنة الدراسية</option>
                                                <option value="السنة الأولى" className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">السنة الأولى</option>
                                                <option value="السنة الثانية" className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">السنة الثانية</option>
                                                <option value="السنة الثالثة" className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">السنة الثالثة</option>
                                                <option value="السنة الرابعة" className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">السنة الرابعة</option>
                                                <option value="السنة الخامسة" className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">السنة الخامسة</option>
                                                <option value="خريج" className="bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white">خريج</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">المعدل التراكمي (أو التقدير)</label>
                                            <input
                                                type="text"
                                                value={data.gpa}
                                                onChange={(e) => setData('gpa', e.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                                placeholder="مثال: 85.5 أو جيد جداً"
                                                required={formType === 'join'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">التخصص</label>
                                            <input
                                                type="text"
                                                value={data.major}
                                                onChange={(e) => setData('major', e.target.value)}
                                                className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                                placeholder="هندسة البرمجيات..."
                                                required={formType === 'join'}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[13px] font-black text-slate-700 dark:text-slate-300 mb-2">خبراتك، مهاراتك، ولماذا تود الانضمام إلينا؟</label>
                                        <textarea
                                            rows={6}
                                            value={data.experience}
                                            onChange={(e) => setData('experience', e.target.value)}
                                            className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#1e293b] px-4 py-3.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#1e293b] focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-y"
                                            placeholder="تحدث عن نفسك بشكل عام، أي لغات برمجة تتقن، أعمال سابقة، أفكار إبداعية، أو أي شغف تمتلكه ويفيد المشروع..."
                                            required={formType === 'join'}
                                        />
                                        {/* Show error if backend rejects the constructed message */}
                                        {errors.message && <p className="mt-1.5 text-[11px] font-black text-rose-500">{errors.message}</p>}
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white font-black text-sm hover:bg-slate-800 dark:hover:bg-blue-700 active:scale-95 transition-all shadow-lg disabled:opacity-50"
                                >
                                    {processing ? 'جاري الإرسال...' : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            إرسال الرسالة
                                        </>
                                    )}
                                </button>
                                
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-100 dark:border-white/5">
                                    <AlertCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                    للدعم الفني والأعطال، يرجى <Link href={route('support.issue.create')} className="text-blue-600 dark:text-blue-400 hover:underline">فتح تذكرة بلاغ</Link> مخصصة بدلاً من هنا.
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
