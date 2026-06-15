import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const updatedAt = '15 مارس 2026';

const sections = [
    {
        title: '1. قبول الشروط',
        body: 'باستخدامك منصة سنفور، فإنك توافق على الالتزام بهذه الشروط. إذا كنت لا توافق على أي جزء منها، يرجى التوقف عن استخدام المنصة.'
    },
    {
        title: '2. طبيعة الخدمة وأدواتها',
        body: 'سنفور منصة إرشاد أكاديمي رقمية توفر أدوات مساعدة مثل (الخطة الشجرية، التسجيل التجريبي، وحاسبة التفوق) بالإضافة إلى (المرشد الأكاديمي الذكي) المبني على تقنيات الذكاء الاصطناعي لتسهيل اتخاذ القرار.'
    },
    {
        title: '3. استخدام المرشد الذكي (AI Beta)',
        body: 'المرشد الذكي (سنفور AI) ميزة تجريبية (Beta). على الرغم من أننا نزوده ببيانات خطتك الدقيقة، إلا أن الذكاء الاصطناعي قد يخطئ أحياناً في الحسابات المعقدة. توصياته هي للاسترشاد فقط ويجب دائماً مراجعتها.'
    },
    {
        title: '4. التسجيل التجريبي والمسؤولية الأكاديمية',
        body: 'أداة التسجيل التجريبي هدفها المحاكاة والتخطيط ولا ترتبط فعلياً بنظام تسجيل جامعتك. جميع قرارات التسجيل النهائية عبر بوابة الجامعة هي مسؤوليتك الشخصية بالكامل.'
    },
    {
        title: '5. دقة البيانات',
        body: 'أنت مسؤول عن صحة البيانات المدخلة في حسابك (كالمعدل، التخصص، وساعات الإنجاز). النظام يعتمد كلياً على هذه المدخلات ليعطيك توجيهاً دقيقاً، وأي خطأ فيها سيؤدي لاقتراحات غير دقيقة.'
    },
    {
        title: '6. حدود الاستخدام (Rate Limits)',
        body: 'حفاظاً على جودة الخدمة واستقرارها، قد نفرض حداً أقصى يومي لعدد الرسائل المسموح بها مع المرشد الذكي. يمنع التحايل على هذه الحدود بأي شكل.'
    },
    {
        title: '7. الاستخدام المسموح',
        body: 'يُسمح باستخدام سنفور للأغراض الأكاديمية والشخصية فقط. يمنع الاستخدام الآلي (البوتات) للمنصة أو محاولة استخراج بياناتها (Scraping) أو الإضرار بالأنظمة.'
    },
    {
        title: '8. المحتوى والملكية الفكرية',
        body: 'تصميم المنصة، الواجهات، وتجربة المستخدم (UI/UX) هي حقوق محفوظة لفريق عمل سنفور. لا يجوز نسخها أو إعادة توزيعها دون إذن مسبق.'
    },
    {
        title: '9. تعليق أو إنهاء الخدمة',
        body: 'يحق لإدارة سنفور تعليق أو إنهاء حساب أي مستخدم ينتهك هذه الشروط، أو يسيء استخدام الموارد، أو يشكل خطراً أمنياً على المنصة.'
    },
    {
        title: '10. التعديلات والتواصل',
        body: 'قد نحدث هذه الشروط لاحقاً. لاستمرارك في استخدام المنصة يعتبر موافقة عليها. لأي استفسار يمكن التواصل معنا عبر noreply@sanfoor.me.'
    }
];

export default function Terms() {
    return (
        <MainLayout>
            <Head>
                <title>شروط الاستخدام | سنفور</title>
                <meta name="description" content="اقرأ شروط استخدام منصة سنفور لمعرفة ضوابط الخدمة، الصلاحيات، والمسؤوليات القانونية للمستخدم." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/terms-of-use`} />
                <meta property="og:type" content="article" />
                <meta property="og:title" content="شروط الاستخدام | سنفور" />
                <meta property="og:description" content="الشروط القانونية المنظمة لاستخدام منصة سنفور." />
                <meta property="og:url" content={`${siteUrl}/terms-of-use`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content="شروط الاستخدام | سنفور" />
                <meta name="twitter:description" content="تعرف على الشروط القانونية لاستخدام منصة سنفور." />
            </Head>

            <div className="min-h-screen py-10 sm:py-14" dir="rtl">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6 sm:p-10 mb-8">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none select-none z-0 overflow-hidden flex justify-center items-center">
                            <span className="block leading-none text-[6rem] sm:text-[10rem] md:text-[14rem] font-black text-slate-900/[0.03] dark:text-white/[0.03] whitespace-nowrap tracking-tighter">TERMS OF USE</span>
                        </div>
                        <div className="absolute -top-14 -left-10 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl" />
                        <div className="absolute -bottom-16 -right-12 w-48 h-48 bg-cyan-400/10 rounded-full blur-3xl" />

                        <div className="relative z-10">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-black">
                                📜 مستند قانوني
                            </span>
                            <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 leading-tight">شروط الاستخدام</h1>
                            <p className="mt-3 text-slate-600 font-bold leading-relaxed text-sm sm:text-base">
                                توضح هذه الصفحة قواعد استخدام منصة سنفور لضمان تجربة آمنة، واضحة، وعادلة لجميع المستخدمين.
                            </p>
                            <p className="mt-4 text-[12px] font-black text-slate-400">آخر تحديث: {updatedAt}</p>
                        </div>
                    </div>

                    <div className="space-y-4 sm:space-y-5">
                        {sections.map((section) => (
                            <article
                                key={section.title}
                                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <h2 className="text-slate-900 text-lg sm:text-xl font-black mb-2.5">{section.title}</h2>
                                <p className="text-slate-600 font-bold leading-relaxed text-sm sm:text-[15px]">{section.body}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
