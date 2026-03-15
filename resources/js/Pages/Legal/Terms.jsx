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
        title: '2. طبيعة الخدمة',
        body: 'سنفور منصة إرشاد أكاديمي رقمية تساعد الطالب على قراءة الخطة الدراسية، متابعة المواد المنجزة، استخدام المحاكي الذكي، والحصول على توصيات أكاديمية مدعومة بالذكاء الاصطناعي.'
    },
    {
        title: '3. حساب المستخدم',
        body: 'أنت مسؤول عن صحة بيانات حسابك والمحافظة على سرية بيانات تسجيل الدخول. أي نشاط يتم عبر حسابك يُعتبر مسؤوليتك ما لم تثبت وجود استخدام غير مصرح به.'
    },
    {
        title: '4. الاستخدام المسموح',
        body: 'يُسمح باستخدام سنفور للأغراض الأكاديمية والشخصية فقط. يمنع استخدام المنصة بأي شكل يضر بالخدمة أو يحاول الوصول غير المصرح به للأنظمة أو بيانات المستخدمين.'
    },
    {
        title: '5. دقة التوصيات',
        body: 'توصيات سنفور هي أدوات دعم قرار وليست بديلاً نهائياً عن تعليمات الجامعة الرسمية. يتحمل المستخدم مسؤولية التأكد من قرارات التسجيل النهائية.'
    },
    {
        title: '6. المحتوى والملكية الفكرية',
        body: 'تصميم المنصة، الواجهات، والشعارات وطرق العرض الخاصة بسنفور هي حقوق محفوظة. لا يجوز نسخها أو إعادة توزيعها دون إذن مسبق.'
    },
    {
        title: '7. إدارة الأدوار والصلاحيات',
        body: 'تحتوي المنصة على أدوار تشغيلية مثل طالب، أدمن، ومالك نظام. أي إساءة استخدام للصلاحيات قد تؤدي إلى تقييد الحساب أو إيقافه.'
    },
    {
        title: '8. تعليق أو إنهاء الخدمة',
        body: 'يحق لإدارة سنفور تعليق أي حساب أو إنهائه عند مخالفة هذه الشروط أو عند وجود مخاطر أمنية أو تشغيلية.'
    },
    {
        title: '9. التعديلات على الشروط',
        body: 'قد يتم تحديث هذه الشروط من وقت لآخر. استمرار استخدامك للمنصة بعد التحديث يعني موافقتك على النسخة الجديدة.'
    },
    {
        title: '10. التواصل',
        body: 'لأي استفسار قانوني أو تشغيلي متعلق بهذه الشروط يمكنك التواصل عبر البريد: noreply@sanfoor.me.'
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
