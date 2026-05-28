import { Head, Link, usePage } from '@inertiajs/react';

export default function Error({ status }) {
    const { auth = {} } = usePage().props || {};
    const isLoggedIn = !!auth.user;

    const titleMap = {
        404: 'ضعت في الشجرة الأكاديمية يا سنفور؟ 🧭',
        403: 'ممر مغلق! ليس لديك صلاحية 🔐',
        500: 'حدث عطل في مصنع السنافير 🛠️',
        503: 'سنافيرنا يأخذون استراحة قصيرة 💤',
    };

    const descMap = {
        404: 'يبدو أنك ضللت الطريق وتخطيت متطلبات المواد! الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى فصل آخر.',
        403: 'عذراً يا سنفور، لا تمتلك الصلاحيات الكافية للوصول إلى هذه الصفحة. يرجى التأكد من حسابك.',
        500: 'خطأ داخلي في الخادم! يبدو أن هناك مشكلة برمجية غير متوقعة، نحن نعمل على إصلاحها بأسرع وقت.',
        503: 'الخدمة غير متوفرة حالياً بسبب بعض التحديثات السريعة. سنعود للعمل مجدداً خلال دقائق.',
    };

    const emojiMap = {
        404: '🔍🍄🧭',
        403: '🚫🛡️🔑',
        500: '💥⚙️👨‍💻',
        503: '🚧🚜☕',
    };

    const errorTitle = titleMap[status] || 'حدث خطأ غير متوقع!';
    const errorDesc = descMap[status] || 'نعتذر عن الإزعاج، حدث خطأ ما في النظام. يرجى المحاولة لاحقاً.';
    const errorEmoji = emojiMap[status] || '⚠️';

    return (
        <div dir="rtl" className="min-h-screen bg-[#08111f] text-white flex items-center justify-center px-4 py-12 relative overflow-hidden font-sans">
            <Head title={`${status} - ${errorTitle}`} />

            {/* Glowing background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/15 blur-3xl animate-pulse duration-10000" />
                <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse duration-[8000ms]" />
            </div>

            <div className="relative w-full max-w-2xl rounded-[2.5rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl shadow-2xl p-8 sm:p-12 text-center" style={{ animation: 'sn-scale 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                
                {/* Large 3D-like Icon Badge */}
                <div className="mx-auto w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-4xl shadow-xl shadow-indigo-500/25 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10">{errorEmoji}</span>
                </div>

                {/* Error Status Code Pill */}
                <span className="inline-flex mt-8 items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-5 py-1.5 text-xs font-[900] text-rose-300 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                    خطأ {status}
                </span>

                {/* Main Headings */}
                <h1 className="mt-6 text-2xl sm:text-4xl font-[950] tracking-tight leading-tight bg-gradient-to-r from-white via-indigo-100 to-cyan-200 bg-clip-text text-transparent">
                    {errorTitle}
                </h1>
                <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-300/90 font-medium max-w-md mx-auto">
                    {errorDesc}
                </p>

                {/* Decorative layout for 404 */}
                {status === 404 && (
                    <div className="mt-8 p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-right space-y-2 max-w-md mx-auto">
                        <h3 className="text-xs font-black text-indigo-300">💡 نصيحة سريعة للسنفور الضائع:</h3>
                        <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                            لتجنب الضياع، تأكد من استكمال المتطلبات السابقة للمادة قبل محاولة فتح روابطها! يمكنك استخدام الشجرة الأكاديمية لمراجعة المواد المتاحة لك للتسجيل حالياً.
                        </p>
                    </div>
                )}

                {/* Navigation Actions */}
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
                    <Link
                        href={isLoggedIn ? route('dashboard') : '/'}
                        className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-white text-[#08111f] px-7 py-3.5 text-sm font-[900] shadow-lg shadow-white/5 hover:scale-[1.02] hover:bg-slate-100 active:scale-[0.98] transition-all"
                    >
                        {isLoggedIn ? '🏠 لوحة التحكم' : '🏠 الصفحة الرئيسية'}
                    </Link>

                    {isLoggedIn && (
                        <Link
                            href={route('tree.index')}
                            className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-[900] text-white hover:bg-white/10 active:scale-[0.98] transition-all"
                        >
                            🌳 الشجرة الأكاديمية
                        </Link>
                    )}

                    <Link
                        href={isLoggedIn ? route('support.issue.create') : route('public.contact')}
                        className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-[900] text-slate-300 hover:text-white hover:bg-white/10 active:scale-[0.98] transition-all"
                    >
                        {isLoggedIn ? '🚨 أبلغ عن مشكلة' : '✉️ اتصل بنا'}
                    </Link>
                </div>
            </div>

            {/* Scale Animation Style */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sn-scale {
                    from { transform: scale(0.96); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}} />
        </div>
    );
}
