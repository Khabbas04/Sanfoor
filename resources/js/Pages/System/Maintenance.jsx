import { Head, Link, usePage } from '@inertiajs/react';

export default function Maintenance() {
    const { maintenance_mode: maintenance = null } = usePage().props || {};
    const title = maintenance?.title || 'الموقع تحت الصيانة';
    const message = maintenance?.message || 'نعمل الآن على تحسين الخدمة وإصلاح بعض الأمور. ستعود المنصة قريبًا.';
    const expectedMinutes = maintenance?.expected_minutes;
    const activatedAt = maintenance?.activated_at ? new Date(maintenance.activated_at) : null;

    return (
        <div dir="rtl" className="min-h-screen bg-[#08111f] text-white flex items-center justify-center px-4 py-12">
            <Head title={title} />

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
            </div>

            <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl p-8 sm:p-10 text-center">
                <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30">
                    🛠️
                </div>

                <span className="inline-flex mt-6 items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-4 py-1.5 text-xs font-black text-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                    وضع الصيانة مفعّل حالياً
                </span>

                <h1 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight">{title}</h1>
                <p className="mt-4 text-sm sm:text-base leading-7 text-slate-300 font-medium">{message}</p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] font-black text-slate-400">الحالة</p>
                        <p className="mt-1 text-sm font-black text-emerald-300">قيد التحسين</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] font-black text-slate-400">المدة المتوقعة</p>
                        <p className="mt-1 text-sm font-black text-cyan-300">{expectedMinutes ? `${expectedMinutes} دقيقة` : 'غير محددة'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <p className="text-[11px] font-black text-slate-400">بدأت</p>
                        <p className="mt-1 text-sm font-black text-slate-200">{activatedAt ? activatedAt.toLocaleString() : 'قبل قليل'}</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link href={route('login')} className="inline-flex items-center justify-center rounded-2xl bg-white text-slate-900 px-5 py-3 text-sm font-black shadow-lg hover:scale-[1.01] transition-transform">
                        تسجيل الدخول
                    </Link>
                    <button onClick={() => window.location.reload()} className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black text-white hover:bg-white/10 transition-colors">
                        إعادة المحاولة
                    </button>
                </div>
            </div>
        </div>
    );
}