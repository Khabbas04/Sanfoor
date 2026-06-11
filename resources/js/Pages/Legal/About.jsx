import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Compass, Bot, Target, Info, Sparkles, Code2, Users, ShieldCheck } from 'lucide-react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');
const founderName = 'Asem Alkhabbas';
const founderLinkedIn = 'https://www.linkedin.com/in/asem-alkhabbas-667471371/';

const pillars = [
    {
        icon: Compass,
        title: 'وضوح المسار',
        text: 'سنفور يحول الخطة الأكاديمية من ملفات ورقية معقدة إلى مسار شجري مرئي وواضح، لتعرف تماماً ماذا أنجزت وماذا تبقى لك بضغطة زر.',
        color: 'from-emerald-400 to-emerald-600',
        bg: 'bg-emerald-50',
        textColor: 'text-emerald-700'
    },
    {
        icon: Bot,
        title: 'ذكاء عملي',
        text: 'نستخدم الذكاء الاصطناعي ليس للدردشة فقط، بل كمرشد حقيقي يقرأ بياناتك الأكاديمية بدقة ليقدم لك اقتراحات مواد وتقييم لجداولك التجريبية.',
        color: 'from-indigo-400 to-indigo-600',
        bg: 'bg-indigo-50',
        textColor: 'text-indigo-700'
    },
    {
        icon: Target,
        title: 'تجربة موجهة للطالب',
        text: 'بنينا سنفور ليخفف عنك التشتت والضغط النفسي وقت التسجيل. كل واجهة مصممة لتسريع اتخاذك للقرار الصحيح دون عناء.',
        color: 'from-blue-400 to-blue-600',
        bg: 'bg-blue-50',
        textColor: 'text-blue-700'
    },
];

const storyPoints = [
    'بدأت فكرة سنفور من مشكلة حقيقية واجهناها كطلاب: ضياع الوقت في محاولة فهم المتطلبات السابقة وتعارض المواد.',
    'كان الهدف بناء منصة توفر تجربة مستخدم تليق بالطالب الجامعي، تجمع بين التخطيط الشجري وتتبع الإنجاز.',
    'اليوم، بفضل المرشد الذكي (AI) والتسجيل التجريبي، تحول سنفور إلى مساعد رقمي كامل يدعمك من فصلك الأول وحتى التخرج.'
];

const valueCards = [
    {
        icon: ShieldCheck,
        title: 'الشفافية',
        desc: 'نشرح لك دائماً المنطق وراء كل اقتراح أكاديمي يقدمه لك المرشد الذكي، لتفهم القرار وتكون واثقاً منه.'
    },
    {
        icon: Code2,
        title: 'الاعتمادية',
        desc: 'نضمن لك استقرار الأداء ودقة ربط المتطلبات الجامعية، لأننا نعلم أن قرارات التسجيل لا تحتمل الأخطاء.'
    },
    {
        icon: Users,
        title: 'التحسين المستمر',
        desc: 'كل تحديث جديد في سنفور مبني على الاستخدام الواقعي ومقترحات الطلاب المستمرة لتطوير المنصة.'
    },
];

export default function About() {
    return (
        <MainLayout>
            <Head>
                <title>من نحن | سنفور</title>
                <meta name="description" content="تعرف على سنفور: منصة الإرشاد الأكاديمي الذكي التي تساعد الطالب على فهم خطته، اختيار مواده، واتخاذ قرارات أدق بثقة." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/about-us`} />
            </Head>

            <div className="min-h-screen pb-16 font-t bg-[#f8f9fb]" dir="rtl">
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-white border-b border-slate-200">
                    <div className="absolute inset-0 bg-[url('/images/grid.svg')] bg-center opacity-40" />
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[300px] h-[300px] bg-indigo-50/60 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[300px] h-[300px] bg-sky-50/50 rounded-full blur-3xl" />
                    
                    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-black tracking-wide mb-6 shadow-sm">
                            <Info className="w-3.5 h-3.5" />
                            قصة سنفور
                        </span>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
                            من نحن في <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-sky-400">سنفور</span>؟
                        </h1>
                        <p className="text-slate-500 font-bold text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                            سنفور ليس مجرد موقع لعرض الخطط الجامعية؛ إنه مساعدك الأكاديمي الذكي الذي يرافقك طوال مسيرتك الجامعية، ويحوّل التخطيط والتسجيل إلى تجربة ممتعة ومضمونة.
                        </p>
                    </div>
                </div>

                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 space-y-8 sm:space-y-12">
                    
                    {/* Pillars Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {pillars.map((item, idx) => (
                            <div key={idx} className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow">
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${item.color} text-white flex items-center justify-center mb-6 shadow-md`}>
                                    <item.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-3">{item.title}</h3>
                                <p className="text-[13px] sm:text-sm font-bold text-slate-500 leading-relaxed">
                                    {item.text}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Story & Vision Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
                        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm">
                            <h3 className="text-2xl font-black text-slate-900 mb-2">كيف بدأت الفكرة؟</h3>
                            <p className="text-[13px] font-bold text-slate-400 mb-6 uppercase tracking-wider">Our Story</p>
                            <div className="space-y-5">
                                {storyPoints.map((point, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-black text-sm flex items-center justify-center shrink-0 border border-indigo-100">
                                            {i + 1}
                                        </div>
                                        <p className="text-slate-600 font-bold leading-relaxed text-[14px] mt-1">
                                            {point}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-3xl border border-indigo-400 p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                            <h3 className="text-2xl font-black mb-4 relative z-10">رؤيتنا</h3>
                            <p className="text-indigo-50 font-bold leading-relaxed text-[14px] relative z-10 mb-8">
                                أن يصبح لكل طالب مساعد أكاديمي رقمي يفهم مساره ويختصر عليه الوقت والقلق، ويحوّل قراراته من التخمين العشوائي إلى الوضوح التام.
                            </p>
                            
                            <div className="bg-white/10 border border-white/20 rounded-2xl p-5 relative z-10 backdrop-blur-sm">
                                <p className="text-[11px] text-indigo-100 font-black mb-1">المبدأ الرئيسي للتطوير</p>
                                <p className="text-white font-black text-[15px]">القرار الأكاديمي الأفضل، يبدأ بمعلومة أوضح.</p>
                            </div>
                        </div>
                    </div>

                    {/* Values Section */}
                    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm">
                        <div className="text-center mb-8">
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">القيم التي نبني عليها</h3>
                            <p className="text-slate-500 font-bold text-sm">مبادئنا الأساسية في تطوير المنصة</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {valueCards.map((card, i) => (
                                <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-700 mb-4 border border-slate-200">
                                        <card.icon className="w-5 h-5" />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-900 mb-2">{card.title}</h4>
                                    <p className="text-[13px] font-bold text-slate-500 leading-relaxed">{card.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Founder & CTA Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-sm flex flex-col justify-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Founder & Developer</span>
                            <h3 className="text-2xl font-black text-slate-900 mb-3">{founderName}</h3>
                            <p className="text-slate-600 font-bold text-[14px] leading-relaxed mb-6">
                                تم تأسيس سنفور وتطويره برؤية تركز على الطالب أولاً: تبسيط القرار الأكاديمي وتحويل التخطيط الجامعي إلى تجربة واضحة، تفاعلية، وعملية.
                            </p>
                            <div>
                                <a
                                    href={founderLinkedIn}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 transition-colors shadow-md"
                                >
                                    LinkedIn Profile
                                </a>
                            </div>
                        </div>

                        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-6 sm:p-10 text-center relative overflow-hidden shadow-xl flex flex-col justify-center items-center">
                            <div className="absolute inset-0 bg-[url('/images/grid.svg')] bg-center opacity-10" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/20 rounded-full blur-[60px] pointer-events-none" />
                            
                            <h3 className="relative z-10 text-2xl sm:text-3xl font-black text-white mb-3">ابدأ رحلتك الآن</h3>
                            <p className="relative z-10 text-slate-400 font-bold text-[14px] mb-6 leading-relaxed max-w-sm mx-auto">
                                انضم لآلاف الطلاب الذين نظموا خططهم الأكاديمية بنجاح عبر سنفور.
                            </p>
                            <Link href={route('register')} className="relative z-10 w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-sky-400 text-white font-black text-sm hover:from-blue-600 hover:to-sky-500 transition-all shadow-lg active:scale-95">
                                إنشاء حساب مجاني
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}
