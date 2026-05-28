import { Head, Link, usePage } from '@inertiajs/react';

export default function Error({ status }) {
    const { auth = {} } = usePage().props || {};
    const isLoggedIn = !!auth.user;

    const titleMap = {
        404: 'الصفحة غير موجودة',
        403: 'غير مصرح بالوصول',
        500: 'خطأ في الخادم الداخلي',
        503: 'الخدمة غير متوفرة حالياً',
    };

    const errorTitle = titleMap[status] || 'حدث خطأ ما';

    return (
        <div dir="rtl" className="min-h-screen bg-[#08111f] text-white flex items-center justify-center px-4 relative overflow-hidden font-sans">
            <Head title={`${status} - ${errorTitle}`} />

            {/* Glowing background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/15 blur-3xl animate-pulse duration-10000" />
                <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl animate-pulse duration-[8000ms]" />
            </div>

            <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.02] backdrop-blur-2xl shadow-2xl p-8 sm:p-12 text-center" style={{ animation: 'sn-scale 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                
                {/* Big status code with a gradient */}
                <h1 className="text-8xl sm:text-9xl font-[1000] tracking-tighter bg-gradient-to-b from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent select-none">
                    {status}
                </h1>

                {/* Short title */}
                <h2 className="mt-4 text-xl sm:text-2xl font-black text-slate-200">
                    {errorTitle}
                </h2>

                {/* Back button */}
                <div className="mt-10">
                    <Link
                        href={isLoggedIn ? route('dashboard') : '/'}
                        className="inline-flex items-center justify-center rounded-2xl bg-white text-[#08111f] px-8 py-3.5 text-sm font-black shadow-lg shadow-white/5 hover:scale-[1.02] hover:bg-slate-100 active:scale-[0.98] transition-all"
                    >
                        العودة للرئيسية
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
