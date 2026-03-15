import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const updatedAt = '15 مارس 2026';

const sections = [
    {
        title: '1. البيانات التي نجمعها',
        points: [
            'بيانات الحساب: الاسم، البريد الإلكتروني، كلمة المرور المشفرة.',
            'البيانات الأكاديمية: التخصص، المواد المنجزة، مواد المحاكي، علامات المواد (عند استخدامها داخل النظام).',
            'بيانات تشغيلية: عنوان IP وآخر وقت تسجيل دخول لتحسين الأمان ومتابعة النشاط.',
            'بيانات استخدام الذكاء الاصطناعي: محتوى محادثاتك داخل المساعد الأكاديمي لتحسين التجربة داخل حسابك.'
        ]
    },
    {
        title: '2. كيف نستخدم البيانات',
        points: [
            'تشغيل الحساب وتقديم خدمات سنفور الأساسية.',
            'عرض الخطة الشجرية والتوصيات الأكاديمية بشكل شخصي.',
            'إرسال رسائل مهمة مثل التحقق من البريد وإعادة تعيين كلمة المرور.',
            'حماية المنصة من إساءة الاستخدام وتحسين الأداء والاستقرار.'
        ]
    },
    {
        title: '3. مشاركة البيانات',
        points: [
            'لا يتم بيع بياناتك الشخصية لأي طرف خارجي.',
            'قد تتم مشاركة البيانات مع مزودي خدمات تقنيين فقط عند الحاجة لتشغيل المنصة (مثل خدمات البريد الإلكتروني).',
            'أي مشاركة تكون بالحد الأدنى اللازم لتقديم الخدمة.'
        ]
    },
    {
        title: '4. البريد الإلكتروني والإشعارات',
        points: [
            'تستخدم المنصة مزود بريد لإرسال التحقق من البريد وروابط إعادة تعيين كلمة المرور.',
            'تُرسل الرسائل فقط للأغراض الأمنية والتشغيلية المرتبطة بحسابك.'
        ]
    },
    {
        title: '5. ملفات الجلسة والأمان',
        points: [
            'نستخدم جلسات آمنة لتسجيل الدخول واستمرارية الاستخدام.',
            'نقوم بتطبيق ضوابط صلاحيات (طالب/أدمن/مالك) لحماية البيانات والوظائف الحساسة.'
        ]
    },
    {
        title: '6. مدة الاحتفاظ بالبيانات',
        points: [
            'يتم الاحتفاظ بالبيانات طالما الحساب نشط أو عند الحاجة التشغيلية والأمنية.',
            'يمكن حذف الحساب وفق سياسات النظام، مع بقاء ما يلزم قانونياً أو أمنياً عند الضرورة.'
        ]
    },
    {
        title: '7. حقوقك',
        points: [
            'الاطلاع على بيانات حسابك وتحديثها من إعدادات الحساب.',
            'طلب تعديل أو حذف البيانات المرتبطة بحسابك ضمن حدود التشغيل والأمان.',
            'التواصل معنا لأي استفسار يتعلق بالخصوصية.'
        ]
    },
    {
        title: '8. تحديثات سياسة الخصوصية',
        points: [
            'قد نقوم بتحديث هذه السياسة عند تطوير الخدمات أو تحسين الممارسات الأمنية.',
            'استمرار الاستخدام بعد التحديث يعني اطلاعك على النسخة الجديدة.'
        ]
    },
    {
        title: '9. التواصل بخصوص الخصوصية',
        points: [
            'لأي استفسارات متعلقة ببياناتك أو الخصوصية، يمكنك التواصل عبر: noreply@sanfoor.me.'
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
