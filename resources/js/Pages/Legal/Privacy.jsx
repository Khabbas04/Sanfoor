import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const updatedAt = '15 مارس 2026';

const sections = [
    {
        title: '1. البيانات التي نجمعها',
        points: [
            'بيانات الحساب الأساسية: الاسم، البريد الإلكتروني، وكلمة المرور المشفرة بأمان.',
            'البيانات الأكاديمية: تخصصك، خطتك الدراسية، المواد التي أنجزتها، وسجل مواد التسجيل التجريبي (سلة المواد).',
            'بيانات تشغيلية: عنوان IP وأوقات الاستخدام لتحسين الأمان واستقرار المنصة.',
            'بيانات المرشد الذكي: محتوى أسئلتك ومحادثاتك داخل واجهة (سنفور AI) لتحليلها والرد عليها.'
        ]
    },
    {
        title: '2. كيف نستخدم البيانات',
        points: [
            'تشغيل خدمات سنفور الأساسية مثل الخطة الشجرية التفاعلية وحاسبة التفوق.',
            'استخدام بياناتك الأكاديمية (مثل معدلك وموادك المنجزة) كمدخلات للمرشد الذكي لتوليد نصائح دقيقة 100% مخصصة لحالتك.',
            'إرسال إشعارات أمنية أو تشغيلية مهمة تتعلق بحسابك.',
            'منع إساءة الاستخدام وحماية المنصة من أي محاولات تخريبية.'
        ]
    },
    {
        title: '3. مشاركة البيانات مع مزودي الخدمة (API)',
        points: [
            'نحن لا نبيع بياناتك الشخصية مطلقاً لأي طرف خارجي.',
            'لتشغيل المرشد الذكي، نقوم بإرسال (سياق أكاديمي) مشفر وآمن عبر واجهة برمجة تطبيقات Gemini API التابعة لشركة Google.',
            'وفقاً لسياسات واجهات برمجة التطبيقات (API) الخاصة بـ Google، فإن بياناتك التي نرسلها لا تُستخدم لتدريب نماذج الذكاء الاصطناعي الخاصة بهم، وتبقى آمنة وخاصة.'
        ]
    },
    {
        title: '4. التسجيل التجريبي والأمان',
        points: [
            'بيانات التسجيل التجريبي يتم حفظها في قاعدة بياناتنا مؤقتاً لتسهيل عودتك وتعديلها في جلسات لاحقة.',
            'جميع هذه البيانات تخزن في خوادم آمنة ولا يمكن الاطلاع عليها إلا من خلال حسابك.'
        ]
    },
    {
        title: '5. البريد الإلكتروني والإشعارات',
        points: [
            'تستخدم المنصة مزود بريد موثوق لإرسال روابط التحقق وإعادة تعيين كلمة المرور.',
            'تقتصر المراسلات على الأغراض التشغيلية والأمنية ولا يتم إرسال رسائل مزعجة (Spam).'
        ]
    },
    {
        title: '6. مدة الاحتفاظ بالبيانات وحذف الحساب',
        points: [
            'نحتفظ ببياناتك الأكاديمية طوال فترة نشاط حسابك لضمان تقديم خدمة مستمرة (مثل حفظ محادثات المرشد).',
            'يمكنك تصفير محادثاتك مع الذكاء الاصطناعي في أي وقت عبر زر "مسح الكل".',
            'في حال طلب حذف الحساب، سيتم مسح بياناتك نهائياً باستثناء ما يتطلبه القانون أو الأمان للحد من الاستخدام الاحتيالي.'
        ]
    },
    {
        title: '7. حقوقك كمستخدم',
        points: [
            'الاطلاع الكامل على بيانات حسابك وتحديث بياناتك الأكاديمية في أي وقت عبر الإعدادات.',
            'طلب تعديل أو مسح بيانات معينة إن لزم الأمر عبر التواصل مع الدعم الفني.',
            'حق مسح المحادثات وتاريخ الاستخدام المرتبط بالذكاء الاصطناعي من داخل واجهة التطبيق.'
        ]
    },
    {
        title: '8. التحديثات على سياسة الخصوصية',
        points: [
            'قد تطرأ تحديثات على هذه السياسة لمواكبة تطورات ميزات سنفور (مثل إطلاق أدوات ذكاء اصطناعي جديدة).',
            'استمرار استخدامك للمنصة يعتبر إقراراً واطلاعاً على السياسات المحدثة.'
        ]
    },
    {
        title: '9. التواصل معنا',
        points: [
            'لأي استفسار يخص أمان بياناتك أو هذه السياسة، يمكنك إرسال بريد إلكتروني إلى: noreply@sanfoor.me.'
        ]
    }
];

export default function Privacy() {
    return (
        <MainLayout>
            <Head>
                <title>سياسة الخصوصية | سنفور</title>
                <meta name="description" content="سياسة خصوصية سنفور توضح كيفية جمع البيانات، استخدامها، وحمايتها أثناء استخدام المنصة." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/privacy-policy`} />
                <meta property="og:type" content="article" />
                <meta property="og:title" content="سياسة الخصوصية | سنفور" />
                <meta property="og:description" content="تفاصيل الخصوصية وحماية البيانات في منصة سنفور." />
                <meta property="og:url" content={`${siteUrl}/privacy-policy`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content="سياسة الخصوصية | سنفور" />
                <meta name="twitter:description" content="كيف يتعامل سنفور مع بياناتك وخصوصيتك." />
            </Head>

            <div className="min-h-screen py-10 sm:py-14" dir="rtl">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-6 sm:p-10 mb-8">
                        <div className="absolute -top-14 -left-10 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl" />
                        <div className="absolute -bottom-16 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

                        <div className="relative z-10">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100 text-xs font-black">
                                🔐 خصوصية وأمان
                            </span>
                            <h1 className="mt-4 text-3xl sm:text-4xl font-black text-slate-900 leading-tight">سياسة الخصوصية</h1>
                            <p className="mt-3 text-slate-600 font-bold leading-relaxed text-sm sm:text-base">
                                تشرح هذه السياسة كيفية جمع بياناتك داخل سنفور، وكيفية استخدامها وحمايتها أثناء استخدام المنصة.
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
                                <h2 className="text-slate-900 text-lg sm:text-xl font-black mb-3">{section.title}</h2>
                                <ul className="space-y-2.5">
                                    {section.points.map((point) => (
                                        <li key={point} className="flex items-start gap-2.5 text-slate-600 font-bold text-sm sm:text-[15px] leading-relaxed">
                                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                            <span>{point}</span>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
