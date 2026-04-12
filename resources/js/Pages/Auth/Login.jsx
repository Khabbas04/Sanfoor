import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { useState, useEffect } from 'react';

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const [showPw, setShowPw] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);

    const submit = (e) => {
        e.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    const spring = 'cubic-bezier(0.16,1,0.3,1)';
    const stagger = (i) => ({
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(15px)',
        transition: `all 600ms ${spring} ${100 + i * 60}ms`,
    });

    // Reusable styles consistent with Register page
    const inputCls = "w-full py-3.5 pr-12 pl-4 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all duration-300 outline-none";
    const labelCls = "block text-[12px] font-black text-slate-700 mb-2";
    const iconContainerCls = "absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 pointer-events-none";

    return (
        <GuestLayout>
            <Head title="تسجيل الدخول - سنفور" />

            <div dir="rtl" className="w-full max-w-md mx-auto pb-6">
                
                {/* ── Branding Header (Consistent with Register) ── */}
                <div className="flex items-center justify-center gap-5 mb-10 group" style={stagger(0)}>
                    {/* اللوجو العملاق */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3">
                        <div className="absolute inset-0 bg-indigo-500/15 rounded-full blur-2xl opacity-100 pointer-events-none"></div>
                        <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-xl relative z-10" />
                    </div>
                    {/* النص المزدوج المكدس */}
                    <div className="flex flex-col justify-center text-right leading-none">
                        <span className="text-3xl sm:text-[2.6rem] font-black bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 from-[50%] to-slate-900 to-[50%] tracking-tight py-1 transition-all duration-300">
                            سنفور
                        </span>
                        <span className="text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 from-[50%] to-slate-900 to-[50%] tracking-[0.15em] uppercase transition-all duration-300">
                            Sanfoor
                        </span>
                    </div>
                </div>

                {/* ── Status message ── */}
                {status && (
                    <div className="mb-6 text-[13px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center shadow-sm" style={stagger(1)}>
                        {status}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-5">
                    {/* ── Email ── */}
                    <div style={stagger(1)}>
                        <label htmlFor="email" className={labelCls}>البريد الإلكتروني</label>
                        <div className="relative">
                            <div className={iconContainerCls}>✉️</div>
                            <input
                                id="email"
                                type="email"
                                value={data.email}
                                dir="ltr"
                                autoComplete="username"
                                autoFocus
                                placeholder="example@email.com"
                                onChange={(e) => setData('email', e.target.value)}
                                className={`${inputCls} text-left`}
                                required
                            />
                        </div>
                        <InputError message={errors.email} className="mt-1.5" />
                    </div>

                    {/* ── Password ── */}
                    <div style={stagger(2)}>
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="password" className="text-[12px] font-black text-slate-700">كلمة المرور</label>
                            {canResetPassword && (
                                <Link
                                    href={route('password.request')}
                                    className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                                >
                                    نسيت كلمة المرور؟
                                </Link>
                            )}
                        </div>
                        <div className="relative">
                            <div className={iconContainerCls}>🔑</div>
                            <input
                                id="password"
                                type={showPw ? 'text' : 'password'}
                                value={data.password}
                                autoComplete="current-password"
                                placeholder="••••••••"
                                onChange={(e) => setData('password', e.target.value)}
                                className={`${inputCls} pl-12 pr-12`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors p-0.5"
                                tabIndex={-1}
                            >
                                {showPw ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <InputError message={errors.password} className="mt-1.5" />
                    </div>

                    {/* ── Remember Me ── */}
                    <div className="pt-1" style={stagger(3)}>
                        <label className="flex items-center gap-2.5 cursor-pointer group w-fit">
                            <div className="relative flex items-center">
                                <Checkbox
                                    name="remember"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="rounded-md border-slate-200 text-indigo-600 shadow-sm focus:ring-indigo-500"
                                />
                            </div>
                            <span className="text-[12px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors select-none">
                                تذكرني في المرات القادمة
                            </span>
                        </label>
                    </div>

                    {/* ── Submit Button ── */}
                    <div className="pt-4" style={stagger(4)}>
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-xl font-black text-[14px] transition-all duration-300 shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        >
                            {processing ? (
                                <>
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    جاري التحقق...
                                </>
                            ) : (
                                <>
                                    تسجيل الدخول
                                    <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="pt-3" style={stagger(5)}>
                        <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200" />
                            </div>
                            <div className="relative flex justify-center text-[11px] font-bold text-slate-400">
                                <span className="bg-white px-3">أو</span>
                            </div>
                        </div>

                        <a
                            href={route('auth.microsoft.redirect')}
                            className="w-full mt-3 border-2 border-slate-200 hover:border-sky-400 bg-white hover:bg-sky-50 text-slate-700 py-3.5 rounded-xl font-black text-[13px] transition-all duration-300 shadow-sm hover:shadow-md flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 23 23" aria-hidden="true">
                                <path fill="#f35325" d="M1 1h10v10H1z" />
                                <path fill="#81bc06" d="M12 1h10v10H12z" />
                                <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                <path fill="#ffba08" d="M12 12h10v10H12z" />
                            </svg>
                            متابعة باستخدام Microsoft
                        </a>
                    </div>

                    {/* ── Register Link ── */}
                    <div className="text-center pt-6 border-t border-slate-100" style={stagger(6)}>
                        <p className="text-[13px] font-bold text-slate-500">
                            لا تملك حساباً بعد؟{' '}
                            <Link
                                href={route('register')}
                                className="text-indigo-600 font-black hover:text-indigo-800 underline decoration-indigo-200 underline-offset-4 transition-colors ml-1"
                            >
                                أنشئ حساباً جديداً
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}