import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { HelpCircle, Network, Calculator, Bot, Shield, Mail } from 'lucide-react';
import { useState } from 'react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const faqItems = [
    {
        id: 'q1',
        question: 'هل سنفور بديل عن تعليمات الجامعة الرسمية والخطة؟',
        answer: 'لا، سنفور هو أداة مساعدة ذكية لدعم قرارك الأكاديمي. المرجع النهائي دائماً هو خطتك الرسمية الصادرة عن عمادة القبول والتسجيل، وتعليمات الجامعة المعمول بها.',
        icon: Shield,
        color: 'from-amber-400 to-amber-600',
        text: 'text-amber-700',
        bg: 'bg-amber-50'
    },
    {
        id: 'q2',
        question: 'كيف أستخدم الخطة الشجرية؟',
        answer: 'الخطة الشجرية تعرض مسارك الأكاديمي من أول فصل وحتى التخرج. المواد الخضراء منجزة، الزرقاء متاحة للتسجيل، والرمادية مغلقة. انقر على أي مادة لتحديث حالتها أو إضافتها لتسجيلك التجريبي.',
        icon: Network,
        color: 'from-emerald-400 to-emerald-600',
        text: 'text-emerald-700',
        bg: 'bg-emerald-50'
    },
    {
        id: 'q3',
        question: 'هل يحسب النظام معدلي تلقائياً؟',
        answer: 'نعم! بمجرد إدخال ساعاتك التراكمية ومعدلك الحالي في الإعدادات، سيقوم النظام بتحديث معدلك تلقائياً عند إضافة مواد جديدة أو اجتيازها عبر حاسبة التفوق المدمجة.',
        icon: Calculator,
        color: 'from-blue-400 to-blue-600',
        text: 'text-blue-700',
        bg: 'bg-blue-50'
    },
    {
        id: 'q4',
        question: 'كيف يساعدني المرشد الذكي (AI)؟',
        answer: 'المرشد يقرأ معدلك وساعاتك وموادك المنجزة والمطروحة حالياً ليقترح لك أفضل المواد للتسجيل، يراجع تسجيلك التجريبي، ويجيب على أسئلتك حول الخطة والتقويم الجامعي.',
        icon: Bot,
        color: 'from-indigo-400 to-indigo-600',
        text: 'text-indigo-700',
        bg: 'bg-indigo-50'
    },
    {
        id: 'q5',
        question: 'هل المساعد الذكي يخزن محادثاتي؟',
        answer: 'يتم حفظ محادثاتك لضمان استمرارية السياق وتقديم تجربة أفضل عند عودتك، لكن خصوصيتك أولوية؛ يمكنك دائماً مسح أي محادثة، أو حتى "مسح الكل" بضغطة زر.',
        icon: Shield,
        color: 'from-rose-400 to-rose-600',
        text: 'text-rose-700',
        bg: 'bg-rose-50'
    },
    {
        id: 'q6',
        question: 'ماذا أفعل إذا واجهت مشكلة تقنية في الموقع؟',
        answer: 'فريقنا التقني جاهز للمساعدة! استخدم نموذج "الإبلاغ عن مشكلة" من داخل حسابك، أو تواصل معنا عبر صفحة "اتصل بنا" وسنرد عليك في أقرب وقت ممكن.',
        icon: HelpCircle,
        color: 'from-sky-400 to-sky-600',
        text: 'text-sky-700',
        bg: 'bg-sky-50'
    }
];

export default function Faq() {
    const [openId, setOpenId] = useState('q1');

    return (
        <MainLayout>
            <Head>
                <title>الأسئلة الشائعة | سنفور</title>
                <meta name="description" content="إجابات سريعة عن أهم الأسئلة حول التسجيل التجريبي، المرشد الذكي، والخطة الشجرية في سنفور." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/faq`} />
            </Head>

            <div className="min-h-screen pb-16 font-t bg-[#f8f9fb]" dir="rtl">
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-white border-b border-slate-200">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none select-none z-0 overflow-hidden flex justify-center items-center">
                        <span className="block leading-none text-[6rem] sm:text-[10rem] md:text-[14rem] font-black text-slate-900/[0.03] dark:text-white/[0.03] whitespace-nowrap tracking-tighter">FAQ</span>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[300px] h-[300px] bg-amber-50/60 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[300px] h-[300px] bg-indigo-50/50 rounded-full blur-3xl" />
                    
                    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-black tracking-wide mb-6 shadow-sm">
                            <HelpCircle className="w-3.5 h-3.5" />
                            مركز المساعدة
                        </span>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
                            الأسئلة <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-500 to-orange-400">الشائعة</span>
                        </h1>
                        <p className="text-slate-500 font-bold text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                            كل ما تحتاج لمعرفته حول طريقة استخدام سنفور، وكيفية الاستفادة القصوى من أدواته الذكية والتسجيل التجريبي.
                        </p>
                    </div>
                </div>

                {/* FAQ Content */}
                <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-8 relative z-10 space-y-4">
                    {faqItems.map((item) => {
                        const isOpen = openId === item.id;
                        return (
                            <div 
                                key={item.id} 
                                className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md cursor-pointer ${isOpen ? 'border-indigo-200 ring-2 ring-indigo-50' : 'border-slate-200/80'}`}
                                onClick={() => setOpenId(isOpen ? null : item.id)}
                            >
                                <div className="p-5 sm:p-6 flex items-center gap-4 sm:gap-6">
                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr ${item.color} text-white flex items-center justify-center shrink-0 shadow-md transition-transform duration-300 ${isOpen ? 'scale-110' : ''}`}>
                                        <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-[15px] sm:text-lg font-black transition-colors ${isOpen ? item.text : 'text-slate-800'}`}>
                                            {item.question}
                                        </h3>
                                    </div>
                                    <div className="shrink-0 w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full text-slate-400">
                                        <svg className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <div className={`px-5 sm:px-6 overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 pb-0 opacity-0'}`}>
                                    <div className={`pl-0 sm:pr-16`}>
                                        <div className={`p-4 rounded-xl ${item.bg} border border-white/50`}>
                                            <p className="text-slate-600 font-bold text-[13px] sm:text-[14px] leading-relaxed">
                                                {item.answer}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Contact CTA */}
                <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-12">
                    <div className="bg-[#0f172a] rounded-3xl p-8 sm:p-10 text-center relative overflow-hidden shadow-2xl flex flex-col items-center">
                        <div className="absolute inset-0 bg-center opacity-10" style={{ backgroundImage: "url('/images/grid.svg')" }} />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none" />
                        
                        <div className="relative z-10 w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-5 backdrop-blur-md border border-white/10">
                            <Mail className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="relative z-10 text-2xl sm:text-3xl font-black text-white mb-3">لم تجد إجابة لسؤالك؟</h3>
                        <p className="relative z-10 text-slate-400 font-bold text-sm mb-6 max-w-md mx-auto leading-relaxed">
                            فريق الدعم الفني لدينا متواجد دائماً للإجابة على استفساراتك وحل أي مشكلة تواجهك.
                        </p>
                        <Link href={route('public.contact')} className="relative z-10 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-sky-400 text-white font-black text-sm hover:from-blue-600 hover:to-sky-500 transition-all shadow-lg shadow-blue-500/25 active:scale-95">
                            تواصل معنا الآن
                        </Link>
                    </div>
                </div>

            </div>
        </MainLayout>
    );
}
