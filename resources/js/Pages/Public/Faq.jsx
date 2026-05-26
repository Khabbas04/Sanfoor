import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const faqItems = [
    {
        question: 'هل سنفور بديل عن تعليمات الجامعة الرسمية؟',
        answer: 'لا. سنفور أداة مساعدة للقرار الأكاديمي، لكن المرجع النهائي دائمًا هو خطتك الرسمية وتعليمات الجامعة.',
    },
    {
        question: 'كيف أحدد المواد المناسبة للفصل القادم؟',
        answer: 'ابدأ من المسار الشجري لمعرفة المتطلبات السابقة، ثم استخدم التسجيل التجريبي والمرشد الذكي للمقارنة قبل القرار النهائي.',
    },
    {
        question: 'هل يمكنني تعديل درجاتي بعد إدخالها؟',
        answer: 'نعم، يمكنك تحديث بياناتك من حاسبة التفوق في أي وقت ليتم احتساب التقدم بشكل محدث.',
    },
    {
        question: 'هل المساعد الذكي يحفظ المحادثات؟',
        answer: 'يتم حفظ المحادثات داخل حسابك لتحسين التجربة والمتابعة، ويمكنك حذفها لاحقًا من شاشة المرشد الذكي.',
    },
    {
        question: 'ماذا أفعل إذا واجهت مشكلة تقنية؟',
        answer: 'يمكنك استخدام صفحة تواصل معنا للطلبات العامة أو صفحة الإبلاغ عن مشكلة من داخل حسابك للدعم الفني التفصيلي.',
    },
    {
        question: 'هل سنفور مجاني؟',
        answer: 'الخدمات الحالية متاحة داخل المنصة وفق إعدادات النظام الحالية، وسيتم الإعلان عن أي تحديثات متعلقة بالباقات داخل المنصة.',
    },
];

export default function Faq() {
    return (
        <MainLayout>
            <Head>
                <title>الأسئلة الشائعة | سنفور - جامعة الزرقاء ZU</title>
                <meta name="description" content="إجابات سريعة عن أكثر الأسئلة شيوعًا حول استخدام منصة سنفور وخدماتها الأكاديمية لطلاب جامعة الزرقاء ZU." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/faq`} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="الأسئلة الشائعة | سنفور - جامعة الزرقاء ZU" />
                <meta property="og:description" content="اعرف أهم الإجابات حول استخدام سنفور، المسار الشجري، والمرشد الذكي لطلاب جامعة الزرقاء ZU." />
                <meta property="og:url" content={`${siteUrl}/faq`} />
                <meta property="og:image" content={`${siteUrl}/images/sanfoor.png`} />
            </Head>

            <div className="min-h-screen py-10 sm:py-14" dir="rtl">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-10 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-xs font-black">
                            ❓ FAQ
                        </span>
                        <h1 className="mt-4 text-3xl sm:text-5xl font-black text-slate-900">الأسئلة الشائعة</h1>
                        <p className="mt-3 text-slate-600 font-bold text-sm sm:text-base leading-relaxed">
                            جمعنا أهم الأسئلة المتكررة لتبدأ استخدام سنفور بسرعة ووضوح.
                        </p>
                    </section>

                    <section className="mt-7 space-y-4">
                        {faqItems.map((item, index) => (
                            <article key={item.question} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black inline-flex items-center justify-center">{index + 1}</span>
                                    {item.question}
                                </h2>
                                <p className="mt-3 text-slate-600 font-bold text-sm sm:text-[15px] leading-relaxed">{item.answer}</p>
                            </article>
                        ))}
                    </section>

                    <section className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8 text-center">
                        <h3 className="text-2xl font-black text-slate-900">ما لقيت سؤالك؟</h3>
                        <p className="mt-2 text-slate-600 font-bold text-sm sm:text-base">فريقنا جاهز يساعدك عبر صفحة التواصل.</p>
                        <Link href={route('public.contact')} className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-colors">
                            📬 تواصل معنا
                        </Link>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
