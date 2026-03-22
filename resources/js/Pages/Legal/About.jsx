import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');
const founderName = 'Asem Alkhabbas';
const founderLinkedIn = 'https://www.linkedin.com/in/asem-alkhabbas-667471371/';

const pillars = [
    {
        icon: '🧭',
        title: 'وضوح المسار',
        text: 'سنفور يحول الخطة الأكاديمية من ملف جامد إلى مسار واضح خطوة بخطوة، حتى يعرف الطالب ماذا أنجز وماذا تبقى.'
    },
    {
        icon: '🤖',
        title: 'ذكاء عملي',
        text: 'نستخدم الذكاء الاصطناعي كأداة مساعدة للقرار، ليقدم اقتراحات قابلة للتنفيذ بدل النصائح العامة.'
    },
    {
        icon: '🎯',
        title: 'تجربة موجهة للطالب',
        text: 'كل شاشة في سنفور مصممة لتقليل التشتت وزيادة الثقة أثناء اختيار المواد وتتبع الأداء الأكاديمي.'
    },
];

const storyPoints = [
    'بدأت فكرة سنفور من مشكلة حقيقية: الطالب يقضي وقتا طويلا في محاولة فهم الخطة والتعارضات والمتطلبات.',
    'الهدف كان بناء منصة عربية واضحة، تجمع التخطيط والتتبع والتوصية الذكية في تجربة واحدة.',
    'اليوم سنفور ليس مجرد واجهة، بل مساعد أكاديمي رقمي يدعم رحلة الطالب من الفصل الأول حتى التخرج.',
];

const valueCards = [
    {
        title: 'الشفافية',
        desc: 'نشرح المنطق وراء التوصيات حتى يفهم الطالب القرار، لا أن ينفذه فقط.'
    },
    {
        title: 'الاعتمادية',
        desc: 'الأداء والاستقرار أولوية لأن الطالب يعتمد على المنصة في قرارات تسجيل حاسمة.'
    },
    {
        title: 'التحسين المستمر',
        desc: 'نبني بشكل دوري بناء على الاستخدام الواقعي وليس الافتراضات.'
    },
];

export default function About() {
    return (
        <MainLayout>
            <Head>
                <title>من نحن | سنفور</title>
                <meta name="description" content="تعرف على سنفور: منصة الإرشاد الأكاديمي الذكي التي تساعد الطالب على فهم خطته، اختيار مواده، واتخاذ قرارات أدق بثقة." />
                <meta name="author" content={founderName} />
                <meta name="creator" content={founderName} />
                <meta name="publisher" content={founderName} />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/about-us`} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="من نحن | سنفور" />
                <meta property="og:description" content="قصة سنفور ورؤيته لبناء تجربة أكاديمية أوضح وأذكى لطلاب الجامعات." />
                <meta property="og:url" content={`${siteUrl}/about-us`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
                <meta property="article:author" content={founderName} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="من نحن | سنفور" />
                <meta name="twitter:description" content="تعرف على رؤية سنفور لبناء مساعد أكاديمي رقمي للطلاب." />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@graph': [
                                {
                                    '@type': 'AboutPage',
                                    name: 'من نحن | سنفور',
                                    url: `${siteUrl}/about-us`,
                                    description:
                                        'قصة سنفور ورؤيته لبناء تجربة أكاديمية أوضح وأذكى لطلاب الجامعات.',
                                    author: {
                                        '@type': 'Person',
                                        name: founderName,
                                        url: founderLinkedIn,
                                    },
                                },
                                {
                                    '@type': 'Organization',
                                    name: 'Sanfoor',
                                    url: `${siteUrl}/`,
                                    logo: `${siteUrl}/images/sanfoor.png`,
                                    founder: {
                                        '@type': 'Person',
                                        name: founderName,
                                        url: founderLinkedIn,
                                    },
                                },
                            ],
                        }),
                    }}
                />
            </Head>

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                        @keyframes aboutFadeUp {
                            from { opacity: 0; transform: translateY(22px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        @keyframes aboutGlow {
                            0%, 100% { transform: scale(1); opacity: 0.35; }
                            50% { transform: scale(1.08); opacity: 0.55; }
                        }
                        .about-reveal {
                            opacity: 0;
                            animation: aboutFadeUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        }
                        .about-card {
                            transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.45s ease;
                        }
                        .about-card:hover {
                            transform: translateY(-8px);
                            box-shadow: 0 25px 50px -18px rgba(15, 23, 42, 0.22);
                        }
                    `,
                }}
            />

            <div className="min-h-screen py-10 sm:py-16" dir="rtl">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <section className="relative overflow-hidden rounded-[2.2rem] bg-[#0b1224] text-white p-7 sm:p-10 md:p-14 border border-indigo-500/20 shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
                        <div
                            className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl"
                            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.45) 0%, transparent 72%)', animation: 'aboutGlow 7s ease-in-out infinite' }}
                        />
                        <div
                            className="absolute -bottom-24 -right-20 w-72 h-72 rounded-full blur-3xl"
                            style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.35) 0%, transparent 72%)', animation: 'aboutGlow 8s ease-in-out 1.2s infinite' }}
                        />

                        <div className="relative z-10">
                            <span className="about-reveal inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-black tracking-wide" style={{ animationDelay: '80ms' }}>
                                ✨ About Sanfoor
                            </span>

                            <h1 className="about-reveal mt-5 text-3xl sm:text-5xl md:text-6xl font-black leading-[1.1] tracking-tight" style={{ animationDelay: '160ms' }}>
                                من نحن في سنفور؟
                            </h1>

                            <p className="about-reveal mt-5 max-w-3xl text-sm sm:text-lg text-indigo-100/90 font-bold leading-relaxed" style={{ animationDelay: '240ms' }}>
                                سنفور منصة إرشاد أكاديمي ذكية تساعد طلاب الجامعات على فهم خطتهم الدراسية، اختيار المواد بثقة، وتجنب العشوائية في قرارات التسجيل.
                                نبني أدوات عملية تجعل الطالب أقرب للتخرج بخطة أوضح وقرارات أدق.
                            </p>

                            <div className="about-reveal mt-7 flex flex-wrap gap-3" style={{ animationDelay: '320ms' }}>
                                <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-black">Smart Planning</span>
                                <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-black">AI Advisor</span>
                                <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-black">Student First</span>
                            </div>
                        </div>
                    </section>

                    <section className="mt-8 sm:mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
                        {pillars.map((item, index) => (
                            <article
                                key={item.title}
                                className="about-card about-reveal rounded-3xl border border-slate-200 bg-white p-6 sm:p-7"
                                style={{ animationDelay: `${380 + index * 100}ms` }}
                            >
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center text-2xl shadow-lg">
                                    {item.icon}
                                </div>
                                <h2 className="mt-4 text-xl font-black text-slate-900">{item.title}</h2>
                                <p className="mt-3 text-slate-600 font-bold leading-relaxed text-sm sm:text-[15px]">{item.text}</p>
                            </article>
                        ))}
                    </section>

                    <section className="mt-8 sm:mt-10 about-reveal rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" style={{ animationDelay: '600ms' }}>
                        <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.12em]">Founder</p>
                        <h3 className="mt-2 text-2xl font-black text-slate-900">{founderName}</h3>
                        <p className="mt-2 text-slate-600 font-bold text-sm sm:text-[15px] leading-relaxed">
                            تم تأسيس سنفور وتطويره برؤية تركز على الطالب أولا: تبسيط القرار الأكاديمي وتحويل التخطيط الجامعي إلى تجربة واضحة وعملية.
                        </p>
                        <a
                            href={founderLinkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-black text-xs hover:bg-indigo-100 transition-colors"
                        >
                            LinkedIn Profile
                        </a>
                    </section>

                    <section className="mt-8 sm:mt-10 grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
                        <div className="lg:col-span-3 about-reveal rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" style={{ animationDelay: '650ms' }}>
                            <h3 className="text-2xl font-black text-slate-900">قصة سنفور</h3>
                            <p className="mt-2 text-slate-500 font-bold text-sm">كيف بدأت الفكرة؟</p>
                            <div className="mt-6 space-y-4">
                                {storyPoints.map((point, i) => (
                                    <div key={point} className="flex items-start gap-3">
                                        <span className="mt-1 w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                                        <p className="text-slate-700 font-bold leading-relaxed text-sm sm:text-[15px]">{point}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-2 about-reveal rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6 sm:p-8" style={{ animationDelay: '760ms' }}>
                            <h3 className="text-2xl font-black text-slate-900">رؤيتنا</h3>
                            <p className="mt-3 text-slate-700 font-bold leading-relaxed text-sm sm:text-[15px]">
                                أن يصبح لكل طالب مساعد أكاديمي رقمي يفهم مساره ويختصر عليه الوقت والقلق، ويحوّل قراراته من التخمين إلى الوضوح.
                            </p>

                            <div className="mt-6 rounded-2xl border border-indigo-100 bg-white/80 p-4">
                                <p className="text-[12px] text-slate-500 font-black">المبدأ الرئيسي</p>
                                <p className="mt-1 text-indigo-700 font-black text-sm">القرار الأكاديمي الأفضل يبدأ بمعلومة أوضح.</p>
                            </div>
                        </div>
                    </section>

                    <section className="mt-8 sm:mt-10 about-reveal rounded-3xl border border-slate-200 bg-white p-6 sm:p-8" style={{ animationDelay: '880ms' }}>
                        <h3 className="text-2xl font-black text-slate-900">القيم التي نبني عليها</h3>
                        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {valueCards.map((card) => (
                                <article key={card.title} className="rounded-2xl border border-slate-200 p-4 bg-slate-50/60">
                                    <h4 className="text-lg font-black text-slate-900">{card.title}</h4>
                                    <p className="mt-2 text-slate-600 font-bold text-sm leading-relaxed">{card.desc}</p>
                                </article>
                            ))}
                        </div>
                    </section>

                    <section className="mt-8 sm:mt-10 about-reveal rounded-3xl border border-slate-200 bg-[#0d1327] text-white p-6 sm:p-10 text-center" style={{ animationDelay: '980ms' }}>
                        <h3 className="text-2xl sm:text-3xl font-black">جاهز تبدأ رحلتك مع سنفور؟</h3>
                        <p className="mt-3 text-indigo-100 font-bold max-w-2xl mx-auto leading-relaxed text-sm sm:text-base">
                            سجّل الآن وابدأ ببناء خطتك الدراسية بطريقة أوضح، أسرع، وأكثر ذكاء.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <Link href={route('register')} className="px-6 py-3 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-slate-100 transition-colors">
                                إنشاء حساب جديد
                            </Link>
                            <Link href={route('login')} className="px-6 py-3 rounded-xl border border-white/25 text-white font-black text-sm hover:bg-white/10 transition-colors">
                                تسجيل الدخول
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
