import { Head, Link, usePage } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { CheckCircle, Network, Bot, ShoppingCart, Sparkles } from 'lucide-react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const features = [
    {
        id: 'tree',
        title: 'الخطة الشجرية وإنجاز المواد',
        description: 'تخلى عن الجداول الورقية المعقدة! الخطة الشجرية تعرض مسارك الأكاديمي بشكل مرئي بالكامل. كل مادة ممثلة بعقدة (Node)، والمواد مترابطة لتوضيح المتطلبات السابقة.',
        details: [
            'اللون الأخضر: مادة منجزة (نجحت بها).',
            'اللون الأزرق: مادة متاحة للتسجيل حالياً.',
            'اللون الرمادي: مادة مغلقة (بسبب متطلب سابق أو نقص الساعات).',
            'إنجاز بضغطة: انقر على أي مادة (إعدادات المادة) لتعديل حالتها لـ "منجزة" وتحديث معدلك.'
        ],
        icon: Network,
        color: 'from-emerald-400 to-emerald-600',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700'
    },
    {
        id: 'cart',
        title: 'التسجيل التجريبي الذكي',
        description: 'مكانك الآمن لتجربة وتخطيط جدولك قبل بدء التسجيل الفعلي في الجامعة. ابدأ بإضافة المواد المتاحة إلى "سلتك التجريبية" وشاهد كيف يتأثر عبئك الدراسي ومسارك.',
        details: [
            'تتبع الساعات: مؤشر يوضح مجموع ساعاتك وهل تخطيت الحد المسموح بناءً على معدلك (تنبيه إنذار).',
            'تأكيد المتطلبات: يمنعك النظام بذكاء من التسجيل الوهمي لمواد لا يحق لك أخذها.',
            'مرونة تامة: احذف وأضف وجرّب خططاً مختلفة لتصل للجدول المثالي بكل بساطة.'
        ],
        icon: ShoppingCart,
        color: 'from-blue-400 to-blue-600',
        bg: 'bg-blue-50',
        text: 'text-blue-700'
    },
    {
        id: 'ai',
        title: 'المرشد الأكاديمي الذكي (AI)',
        description: 'مساعدك الشخصي المتاح 24/7، يقرأ بياناتك الأكاديمية بدقة (المعدل، المواد المنجزة، والتسجيل التجريبي) ليرشدك بقرارات مبنية على حالتك الفعلية 100%.',
        details: [
            'تحليل الجدول: اطلب منه مراجعة وتقييم تسجيلك التجريبي الحالي لاكتشاف أي خلل أو ثقل في الجدول.',
            'الأوامر السحرية (/): اكتب سلاش لفتح أوامر جاهزة (مثل /تقويم، /جدول، /رفع-معدل) للحصول على أجوبة دقيقة فوراً.',
            'أدوات تفاعلية: يرسل لك مواد على شكل بطاقات يمكنك إضافتها لتسجيلك التجريبي بضغطة زر دون مغادرة المحادثة.'
        ],
        icon: Bot,
        color: 'from-indigo-400 to-indigo-600',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700'
    }
];

export default function HowItWorks() {
    const { auth } = usePage().props;

    return (
        <MainLayout>
            <Head>
                <title>كيف يعمل سنفور | Sanfoor</title>
                <meta name="description" content="تعرف على آلية عمل منصة سنفور: الخطة الشجرية، التسجيل التجريبي، والمرشد الذكي." />
                <meta name="robots" content="index,follow" />
                <link rel="canonical" href={`${siteUrl}/how-it-works`} />
            </Head>

            <div className="min-h-screen pb-16 font-t bg-[#f8f9fb]" dir="rtl">
                {/* Hero Section */}
                <div className="relative overflow-hidden bg-white border-b border-slate-200">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none select-none z-0 overflow-hidden flex justify-center items-center">
                        <span className="block leading-none text-[5rem] sm:text-[8rem] md:text-[12rem] font-black text-slate-900/[0.03] dark:text-white/[0.03] whitespace-nowrap tracking-tighter">كيف يعمل سنفور</span>
                    </div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[300px] h-[300px] bg-indigo-50/50 rounded-full blur-3xl" />
                    
                    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-black tracking-wide mb-6 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5" />
                            دليلك الشامل
                        </span>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
                            كيف يعمل <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-sky-400">سنفور</span>؟
                        </h1>
                        <p className="text-slate-500 font-bold text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
                            سنفور ليس مجرد أداة لعرض الخطة، بل هو نظام متكامل يربط مسارك الأكاديمي، تسجيلك التجريبي، والذكاء الاصطناعي لضمان اتخاذك لأفضل القرارات الجامعية.
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 space-y-8 sm:space-y-12">
                    {features.map((feature, idx) => (
                        <div key={feature.id} className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden group">
                            <div className={`p-6 sm:p-10 flex flex-col md:flex-row gap-8 sm:gap-12 items-center ${idx % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}>
                                
                                {/* Text Content */}
                                <div className="flex-1 space-y-6">
                                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr ${feature.color} text-white shadow-lg`}>
                                        <feature.icon className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3">{feature.title}</h2>
                                        <p className="text-slate-500 font-bold leading-relaxed text-sm sm:text-base">{feature.description}</p>
                                    </div>
                                    <ul className="space-y-3">
                                        {feature.details.map((detail, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <CheckCircle className={`w-5 h-5 mt-0.5 shrink-0 ${feature.text}`} />
                                                <span className="text-slate-700 font-bold text-[13px] sm:text-sm leading-relaxed">{detail}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                
                                {/* Visual Presentation (Abstract Representation) */}
                                <div className="flex-1 w-full relative">
                                    <div className={`aspect-square sm:aspect-[4/3] rounded-2xl ${feature.bg} border border-slate-100 flex items-center justify-center p-8 relative overflow-hidden`}>
                                        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
                                        <feature.icon className={`w-32 h-32 ${feature.text} opacity-20 relative z-10 transform group-hover:scale-110 transition-transform duration-700`} />
                                        
                                        {/* Floating decorative elements based on feature */}
                                        {feature.id === 'tree' && (
                                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                                                <div className="w-16 h-16 bg-emerald-500 rounded-full shadow-lg border-4 border-white absolute -ml-20 -mt-10 animate-bounce" style={{animationDuration: '3s'}} />
                                                <div className="w-12 h-12 bg-blue-500 rounded-full shadow-lg border-4 border-white absolute animate-bounce" style={{animationDuration: '4s', animationDelay: '1s'}} />
                                                <div className="w-14 h-14 bg-slate-300 rounded-full shadow-lg border-4 border-white absolute ml-24 mt-12 animate-bounce" style={{animationDuration: '5s', animationDelay: '0.5s'}} />
                                                <div className="w-1 h-20 bg-slate-200 absolute -rotate-45 -ml-8 -mt-4 -z-10" />
                                            </div>
                                        )}
                                        {feature.id === 'cart' && (
                                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3">
                                                <div className="w-48 bg-white p-3 rounded-xl shadow-lg border border-slate-100 transform -rotate-2 hover:rotate-0 transition-transform">
                                                    <div className="w-full h-2 bg-slate-100 rounded-full mb-2" />
                                                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400">مقدمة في البرمجة</span><span className="text-[10px] font-black text-blue-600">3س</span></div>
                                                </div>
                                                <div className="w-48 bg-white p-3 rounded-xl shadow-lg border border-slate-100 transform rotate-2 hover:rotate-0 transition-transform">
                                                    <div className="w-full h-2 bg-slate-100 rounded-full mb-2" />
                                                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400">تفاضل وتكامل 1</span><span className="text-[10px] font-black text-blue-600">3س</span></div>
                                                </div>
                                            </div>
                                        )}
                                        {feature.id === 'ai' && (
                                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                                                <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 max-w-[200px] w-full">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">🤖</div>
                                                        <div className="w-20 h-2 bg-slate-100 rounded-full" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="w-full h-2 bg-slate-50 rounded-full" />
                                                        <div className="w-3/4 h-2 bg-slate-50 rounded-full" />
                                                    </div>
                                                    <div className="mt-3 bg-indigo-50 rounded-lg p-2 border border-indigo-100 flex items-center justify-between">
                                                        <div className="w-16 h-2 bg-indigo-200 rounded-full" />
                                                        <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-bold">+</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>
                    ))}

                    {/* CTA Section */}
                    <div className="bg-[#0f172a] rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 bg-center opacity-10" style={{ backgroundImage: "url('/images/grid.svg')" }} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/20 rounded-full blur-[80px] pointer-events-none" />
                        
                        <div className="relative z-10">
                            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">جاهز للبدء؟</h2>
                            <p className="text-slate-300 font-bold max-w-xl mx-auto text-sm sm:text-base mb-8 leading-relaxed">
                                {auth?.user
                                    ? 'حسابك جاهز وتم تجهيز بياناتك! انتقل الآن لتنظيم خطتك الشجرية واستكشاف أدوات سنفور.'
                                    : 'انضم لآلاف الطلاب الذين غيروا طريقة تخطيطهم الأكاديمي. أنشئ حسابك الآن مجاناً.'}
                            </p>
                            
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                {auth?.user ? (
                                    <>
                                        <Link href={route('dashboard')} className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-slate-900 font-black text-sm hover:bg-slate-50 active:scale-95 transition-all shadow-lg">
                                            لوحة التحكم
                                        </Link>
                                        <Link href={route('tree.index')} className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 text-white font-black text-sm border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all">
                                            المسار الشجري
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link href={route('register')} className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-sky-400 text-white font-black text-sm hover:from-blue-600 hover:to-sky-500 active:scale-95 transition-all shadow-lg shadow-blue-500/25">
                                            سجل مجاناً
                                        </Link>
                                        <Link href={route('login')} className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 text-white font-black text-sm border border-slate-700 hover:bg-slate-700 active:scale-95 transition-all">
                                            تسجيل الدخول
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}
