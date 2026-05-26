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
    const [showExternalLogin, setShowExternalLogin] = useState(false);
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
    const inputCls = "w-full py-3.5 pr-12 pl-4 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 focus:bg-white transition-all duration-300 outline-none";
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
                        <div className="absolute inset-0 bg-blue-500/15 rounded-full blur-2xl opacity-100 pointer-events-none"></div>
                        <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-xl relative z-10" />
                    </div>
                    {/* النص المزدوج المكدس */}
                    <div className="flex flex-col justify-center text-right leading-none">
                        <span className="text-3xl sm:text-[2.6rem] font-black bg-clip-text text-transparent bg-gradient-to-l from-blue-600 from-[50%] to-slate-900 to-[50%] tracking-tight py-1 transition-all duration-300">
                            سنفور
                        </span>
                        <span className="text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-l from-blue-600 from-[50%] to-slate-900 to-[50%] tracking-[0.15em] uppercase transition-all duration-300">
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

                {!showExternalLogin ? (
                    <div className="space-y-6">
                        <div style={stagger(1)} className="p-8 sm:p-10 bg-white/80 backdrop-blur-xl border border-white/80 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative overflow-hidden text-center space-y-6">
                            {/* Background Glows */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/80 rounded-full blur-3xl opacity-60 -z-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-50/80 rounded-full blur-3xl opacity-60 -z-10 pointer-events-none"></div>

                            <div className="w-20 h-20 bg-white shadow-xl shadow-sky-100/50 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-sky-50 relative group">
                                <div className="absolute inset-0 bg-sky-400 opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500 rounded-2xl pointer-events-none"></div>
                                <svg className="w-10 h-10 relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3" viewBox="0 0 23 23" aria-hidden="true">
                                    <path fill="#f35325" d="M1 1h10v10H1z" />
                                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                                </svg>
                            </div>
                            
                            <div>
                                <h3 className="text-[18px] sm:text-[20px] font-black text-slate-800 tracking-tight mb-2">
                                    الدخول الموحد للجامعة
                                </h3>
                                <p className="text-[13px] font-bold text-slate-500 leading-relaxed px-2">
                                    استخدم حسابك الجامعي الرسمي من مايكروسوفت للدخول بأمان وسرعة إلى منصة سنفور.
                                </p>
                            </div>
                            
                            <a
                                href={route('auth.microsoft.redirect')}
                                className="relative group w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-4 px-6 rounded-2xl font-black text-[14px] transition-all duration-300 shadow-xl shadow-slate-900/20 active:scale-[0.98] overflow-hidden mt-8"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-blue-500 to-sky-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <span className="relative z-10 flex items-center gap-3">
                                    المتابعة باستخدام حساب الجامعة
                                    <svg className="w-5 h-5 rtl:rotate-180 group-hover:-translate-x-1.5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </span>
                            </a>
                        </div>
                        
                        <div className="text-center pt-2" style={stagger(2)}>
                            <button
                                type="button"
                                onClick={() => setShowExternalLogin(true)}
                                className="inline-flex items-center justify-center px-4 py-2 text-[12px] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                تسجيل الدخول للإدارة (حساب محلي)
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-5 bg-white p-6 border border-slate-100 rounded-2xl shadow-sm">
                        <h3 className="text-[15px] font-black text-slate-800 text-center mb-4" style={stagger(0)}>
                            دخول الحسابات الخارجية
                        </h3>
                        
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
                                        className="text-[11px] font-bold text-blue-500 hover:text-blue-700 transition-colors"
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
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors p-0.5"
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
                                        className="rounded-md border-slate-200 text-blue-600 shadow-sm focus:ring-blue-500"
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
                                className="w-full bg-slate-900 hover:bg-gradient-to-r hover:from-sky-400 hover:to-blue-500 text-white py-4 rounded-xl font-black text-[14px] transition-all duration-300 shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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

                        <div className="text-center pt-4 border-t border-slate-100" style={stagger(5)}>
                            <button
                                type="button"
                                onClick={() => setShowExternalLogin(false)}
                                className="text-[12px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                العودة إلى تسجيل دخول الطلاب (Microsoft)
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </GuestLayout>
    );
}