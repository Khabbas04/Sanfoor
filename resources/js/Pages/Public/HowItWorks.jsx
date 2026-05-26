import { Head, Link, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const steps = [
    {
        id: '01',
        title: 'أنشئ حسابك وحدد تخصصك',
        text: 'ابدأ بتسجيل حسابك وربط ملفك الأكاديمي بالتخصص والخطة الدراسية المناسبة حتى تظهر لك الأدوات بدقة أعلى.',
        icon: '🪪',
    },
    {
        id: '02',
        title: 'استكشف المسار الشجري',
        text: 'اعرف المتطلبات السابقة لكل مادة وتابع المواد المنجزة والمتبقية بطريقة مرئية واضحة.',
        icon: '🌳',
    },
    {
        id: '03',
        title: 'خطط موادك للفصل القادم',
        text: 'استخدم التسجيل التجريبي لتجربة خطط مختلفة قبل القرار النهائي، مع تتبع الأثر على تقدمك.',
        icon: '🧩',
    },
    {
        id: '04',
        title: 'احسب الأداء الأكاديمي',
        text: 'حاسبة التفوق تساعدك تفهم وضعك الحالي وتتوقع النتيجة حسب الدرجات المدخلة.',
        icon: '📈',
    },
    {
        id: '05',
        title: 'استفد من المرشد الذكي',
        text: 'احصل على توصيات عملية من AI Advisor لتحديد المواد المناسبة وتقليل المخاطر الأكاديمية.',
        icon: '🤖',
    },
];

export default function HowItWorks() {
    const { auth } = usePage().props;

    return (
        <MainLayout>
            <Head>
                <title>كيف يعمل سنفور | Sanfoor - جامعة الزرقاء ZU</title>
                <meta name="description" content="تعرف على طريقة استخدام سنفور لطلاب جامعة الزرقاء ZU خطوة بخطوة: من إنشاء الحساب حتى التخطيط الذكي للفصل الدراسي." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/how-it-works`} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="كيف يعمل سنفور | Sanfoor - جامعة الزرقاء ZU" />
                <meta property="og:description" content="دليل سريع لطلاب جامعة الزرقاء ZU داخل سنفور من البداية حتى قرار تسجيل المواد." />
                <meta property="og:url" content={`${siteUrl}/how-it-works`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
            </Head>

            <div className="min-h-screen py-10 sm:py-14" dir="rtl">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-10 shadow-[0_20px_60px_rgba(15,23,42,0.09)]">
                        <div className="absolute -top-16 -left-10 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl" />
                        <div className="absolute -bottom-16 -right-10 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl" />

                        <div className="relative z-10">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-black">
                                🧭 Start Here
                            </span>
                            <h1 className="mt-4 text-3xl sm:text-5xl font-black text-slate-900 leading-tight">كيف يعمل سنفور؟</h1>
                            <p className="mt-3 text-slate-600 font-bold leading-relaxed text-sm sm:text-base max-w-3xl">
                                سنفور مصمم ليحوّل التخطيط الأكاديمي من عملية متعبة إلى خطوات واضحة يمكن تنفيذها بثقة.
                                ابدأ من هنا واتبع المسار التالي.
                            </p>
                        </div>
                    </section>

                    <section className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {steps.map((step) => (
                            <article key={step.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between">
                                    <span className="text-3xl">{step.icon}</span>
                                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">Step {step.id}</span>
                                </div>
                                <h2 className="mt-4 text-xl font-black text-slate-900">{step.title}</h2>
                                <p className="mt-2 text-slate-600 font-bold text-sm leading-relaxed">{step.text}</p>
                            </article>
                        ))}
                    </section>

                    <section className="mt-8 rounded-3xl border border-slate-200 bg-[#0d1327] text-white p-6 sm:p-9 text-center">
                        <h2 className="text-2xl sm:text-3xl font-black">جاهز تبدأ؟</h2>
                        <p className="mt-3 text-indigo-100 font-bold max-w-2xl mx-auto text-sm sm:text-base">
                            {auth?.user
                                ? 'حسابك جاهز. كمل تنظيم مسارك من أدوات سنفور مباشرة.'
                                : 'أنشئ حسابك الآن وابدأ بتنظيم مسارك الدراسي من أول فصل حتى التخرج.'}
                        </p>
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            {auth?.user ? (
                                <>
                                    <Link href={route('dashboard')} className="px-6 py-3 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-slate-100 transition-colors">
                                        لوحة التحكم
                                    </Link>
                                    <Link href={route('tree.index')} className="px-6 py-3 rounded-xl border border-white/25 text-white font-black text-sm hover:bg-white/10 transition-colors">
                                        المسار الشجري
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link href={route('login')} className="px-6 py-3 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-slate-100 transition-colors">
                                        ابدأ الآن
                                    </Link>
                                    <Link href={route('login')} className="px-6 py-3 rounded-xl border border-white/25 text-white font-black text-sm hover:bg-white/10 transition-colors">
                                        تسجيل الدخول
                                    </Link>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
