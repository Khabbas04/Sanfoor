import { Link, Head } from '@inertiajs/react';

export default function Welcome({ auth }) {
    return (
        <>
            <Head>
                <title>مرشد سنفور - بوابتك الأكاديمية الذكية</title>
                <meta name="description" content="سنفور - المساعد الذكي لطلاب الجامعات الأردنية لتخطيط المسار الأكاديمي واختيار المواد بسهولة." />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet" />
            </Head>

            {/* الحاوية الرئيسية مع تعيين الخط العربي */}
            <div className="min-h-screen bg-slate-50 text-right selection:bg-indigo-500 selection:text-white overflow-x-hidden font-cairo" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
                
                {/* =========================================
                    1. شريط التنقل العلوي (Navbar)
                ========================================= */}
                <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all duration-300">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-20 items-center">
                            
                            {/* الشعار (Logo) */}
                            <div className="flex items-center gap-3 group cursor-pointer">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-300">
                                    🎓
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-slate-800 tracking-tight leading-none">سنفور</span>
                                    <span className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase">Smart Guide</span>
                                </div>
                            </div>

                            {/* روابط التنقل (تظهر فقط في الشاشات الكبيرة) */}
                            <div className="hidden md:flex items-center gap-8 text-slate-600 font-bold text-sm">
                                <a href="#features" className="hover:text-indigo-600 transition-colors">كيف نساعدك؟</a>
                                <a href="#" className="hover:text-indigo-600 transition-colors">عن المشروع</a>
                                
                                {/* رابط الخطة يظهر فقط للطلاب المسجلين */}
                                {auth.user && (
                                    <Link 
                                        href={route('tree.index')} 
                                        className="flex items-center gap-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-100 transition-all"
                                    >
                                        <span className="text-lg">🌳</span>
                                        <span>خريطتك الشجرية</span>
                                    </Link>
                                )}
                            </div>

                            {/* منطقة الأزرار (تسجيل / لوحة تحكم) */}
                            <div className="flex items-center gap-3">
                                {auth.user ? (
                                    <Link
                                        href={route('dashboard')}
                                        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-black transition-all font-bold text-sm shadow-md hover:shadow-xl hover:-translate-y-0.5"
                                    >
                                        لوحة التحكم
                                    </Link>
                                ) : (
                                    <>
                                        <Link href={route('login')} className="text-slate-600 hover:text-indigo-600 font-bold px-4 transition-colors hidden sm:block">تسجيل الدخول</Link>
                                        <Link 
                                            href={route('register')} 
                                            className="bg-gradient-to-l from-indigo-600 to-blue-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all font-bold text-sm hover:-translate-y-0.5"
                                        >
                                            حساب جديد
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </nav>

                {/* =========================================
                    2. القسم الرئيسي (Hero Section)
                ========================================= */}
                <main className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden flex items-center min-h-[90vh]">
                    
                    {/* تأثيرات خلفية بصرية (Blobs) */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[500px] h-[500px] bg-indigo-200 rounded-full blur-[100px] opacity-40 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[400px] h-[400px] bg-blue-200 rounded-full blur-[100px] opacity-40 pointer-events-none"></div>

                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                        {/* شارة الإصدار */}
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-8 border border-indigo-100 shadow-sm animate-bounce">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            الإصدار التجريبي للجامعات 2026
                        </div>

                        {/* العنوان الرئيسي */}
                        <h1 className="text-5xl md:text-7xl lg:text-[5rem] font-black text-slate-900 mb-6 leading-[1.1]">
                            نظم مسارك الجامعي، <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-blue-500">
                                بذكاء وبدون تعقيد.
                            </span>
                        </h1>

                        <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-slate-500 mb-12 leading-relaxed font-semibold">
                            منصة "سنفور" هي مرشدك الأكاديمي التفاعلي. تتبع إنجازك، واكتشف المواد المتاحة لك، وابنِ جدولك الدراسي بثقة عبر خريطتنا الشجرية الذكية.
                        </p>
                        
                        {/* أزرار الدعوة للإجراء (CTA) */}
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            {auth.user ? (
                                <Link 
                                    href={route('tree.index')} 
                                    className="group flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 text-white text-lg font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 hover:-translate-y-1"
                                >
                                    <span>اذهب لخطتك الآن</span>
                                    <span className="group-hover:translate-x-1 transition-transform">←</span>
                                </Link>
                            ) : (
                                <>
                                    <Link 
                                        href={route('register')} 
                                        className="flex items-center justify-center px-8 py-4 bg-slate-900 text-white text-lg font-bold rounded-2xl hover:bg-black transition-all shadow-xl hover:-translate-y-1"
                                    >
                                        ابدأ رحلتك مجاناً
                                    </Link>
                                    <a 
                                        href="#features" 
                                        className="flex items-center justify-center px-8 py-4 bg-white text-slate-700 text-lg font-bold rounded-2xl hover:bg-slate-50 border border-slate-200 transition-all hover:-translate-y-1"
                                    >
                                        اكتشف المزيد
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </main>

                {/* =========================================
                    3. قسم المميزات (Features)
                ========================================= */}
                <section id="features" className="py-24 bg-white relative border-t border-slate-100">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">كيف يسهل "سنفور" حياتك الجامعية؟</h2>
                            <p className="text-slate-500 font-semibold max-w-2xl mx-auto">أدوات مصممة خصيصاً لتجنب الأخطاء الأكاديمية وضمان تخرجك في الوقت المحدد.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* ميزة 1 */}
                            <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all duration-300 hover:-translate-y-2 group cursor-default">
                                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-3xl mb-6 text-blue-600 group-hover:scale-110 transition-transform">🌳</div>
                                <h3 className="text-2xl font-black text-slate-800 mb-3">خطة شجرية تفاعلية</h3>
                                <p className="text-slate-500 font-semibold leading-relaxed">وداعاً للجداول الورقية المعقدة. شاهد مواد تخصصك تفتح أمامك تلقائياً بمجرد إنهائك للمتطلبات السابقة.</p>
                            </div>
                            
                            {/* ميزة 2 */}
                            <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-300 hover:-translate-y-2 group cursor-default">
                                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl mb-6 text-emerald-600 group-hover:scale-110 transition-transform">📊</div>
                                <h3 className="text-2xl font-black text-slate-800 mb-3">تتبع الإنجاز الدقيق</h3>
                                <p className="text-slate-500 font-semibold leading-relaxed">اعرف بالضبط كم ساعة قطعت، وكم تبقى لك للتخرج، مع شريط تقدم يرافقك خطوة بخطوة.</p>
                            </div>
                            
                            {/* ميزة 3 */}
                            <div className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:shadow-2xl hover:shadow-purple-100/50 transition-all duration-300 hover:-translate-y-2 group cursor-default">
                                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl mb-6 text-purple-600 group-hover:scale-110 transition-transform">🤖</div>
                                <h3 className="text-2xl font-black text-slate-800 mb-3">المساعد الذكي (قريباً)</h3>
                                <p className="text-slate-500 font-semibold leading-relaxed">مرشد يعتمد على الذكاء الاصطناعي لاقتراح أفضل المواد لك في كل فصل لتجنب التعارضات وضغط الدراسة.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* =========================================
                    4. التذييل (Footer)
                ========================================= */}
                <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🎓</span>
                            <span className="text-xl font-black text-white tracking-wider">سنفور</span>
                        </div>
                        <p className="text-sm font-semibold">© 2026 تم التطوير بكل حب لخدمة طلاب الجامعات الأردنية.</p>
                        <div className="flex gap-4 text-sm font-bold">
                            <a href="#" className="hover:text-white transition-colors">الشروط والأحكام</a>
                            <a href="#" className="hover:text-white transition-colors">سياسة الخصوصية</a>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}