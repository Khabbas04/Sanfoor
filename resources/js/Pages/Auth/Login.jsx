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
        transition: `all 600ms ${spring} ${100 + i * 50}ms`,
    });

    const inputCls = "w-full py-3.5 pr-11 pl-11 rounded-2xl border border-slate-200 bg-slate-50/50 text-[14px] font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all duration-300 outline-none shadow-sm";
    const labelCls = "block text-[13px] font-black text-slate-700 mb-2 px-1";
    const iconContainerCls = "absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors duration-300 peer-focus:text-indigo-500 flex items-center justify-center";

    return (
        <GuestLayout>
            <Head title="تسجيل الدخول - سنفور" />

            <div dir="rtl" className="w-full max-w-sm mx-auto">
                
                {/* ── Branding Header ── */}
                <div className="flex flex-col items-center justify-center mb-8" style={stagger(0)}>
                    <div className="relative w-24 h-24 mb-4 group cursor-pointer">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-all duration-500"></div>
                        <img src="/images/sanfoor.png" alt="Sanfoor Logo" className="w-full h-full object-contain drop-shadow-2xl relative z-10 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 to-sky-500 tracking-tight mb-1">
                            سـنـفـور
                        </h1>
                        <p className="text-[12px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                            Sanfoor Portal
                        </p>
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
                        <div style={stagger(1)} className="text-center space-y-4">
                            <p className="text-[14px] font-semibold text-slate-500 leading-relaxed px-4">
                                مرحباً بك في المساعد الأكاديمي الذكي. سجل دخولك باستخدام حسابك الجامعي للبدء.
                            </p>
                        </div>
                        
                        <div style={stagger(2)} className="pt-2">
                            <a
                                href={route('auth.microsoft.redirect')}
                                className="relative group w-full flex items-center justify-center gap-4 bg-white border border-slate-200 hover:border-indigo-100 py-4 px-6 rounded-2xl font-black text-[15px] text-slate-700 transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 active:scale-[0.98] overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-sky-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <span className="relative z-10 flex items-center gap-4">
                                    <svg className="w-6 h-6 transition-transform duration-500 group-hover:scale-110" viewBox="0 0 23 23" aria-hidden="true">
                                        <path fill="#f35325" d="M1 1h10v10H1z" />
                                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                                    </svg>
                                    الدخول بحساب الجامعة
                                </span>
                            </a>
                        </div>
                        
                        <div className="flex items-center justify-center pt-8" style={stagger(3)}>
                            <button
                                type="button"
                                onClick={() => setShowExternalLogin(true)}
                                className="text-[12px] font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 group"
                            >
                                <span>دخول الإدارة (محلي)</span>
                                <svg className="w-4 h-4 rtl:rotate-180 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-5">
                        <div style={stagger(1)} className="flex items-center justify-between mb-2">
                            <h3 className="text-[16px] font-black text-slate-800">
                                تسجيل دخول الإدارة
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowExternalLogin(false)}
                                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                                title="العودة"
                            >
                                <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        </div>
                        
                        {/* ── Email ── */}
                        <div style={stagger(2)} className="relative group">
                            <label htmlFor="email" className={labelCls}>البريد الإلكتروني</label>
                            <div className="relative">
                                <input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    dir="ltr"
                                    autoComplete="username"
                                    autoFocus
                                    placeholder="admin@university.edu"
                                    onChange={(e) => setData('email', e.target.value)}
                                    className={`${inputCls} peer text-left`}
                                    required
                                />
                                <div className={iconContainerCls}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                                </div>
                            </div>
                            <InputError message={errors.email} className="mt-2" />
                        </div>

                        {/* ── Password ── */}
                        <div style={stagger(3)} className="relative group">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <label htmlFor="password" className="text-[13px] font-black text-slate-700 m-0">كلمة المرور</label>
                                {canResetPassword && (
                                    <Link
                                        href={route('password.request')}
                                        className="text-[12px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                                    >
                                        نسيت الكلمة؟
                                    </Link>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    value={data.password}
                                    autoComplete="current-password"
                                    placeholder="••••••••"
                                    onChange={(e) => setData('password', e.target.value)}
                                    className={`${inputCls} peer`}
                                    required
                                />
                                <div className={iconContainerCls}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPw ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                            <InputError message={errors.password} className="mt-2" />
                        </div>

                        {/* ── Remember Me ── */}
                        <div className="pt-2" style={stagger(4)}>
                            <label className="flex items-center gap-3 cursor-pointer group w-fit">
                                <div className="relative flex items-center">
                                    <Checkbox
                                        name="remember"
                                        checked={data.remember}
                                        onChange={(e) => setData('remember', e.target.checked)}
                                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 shadow-sm focus:ring-indigo-500 focus:ring-offset-0 transition-all"
                                    />
                                </div>
                                <span className="text-[13px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors select-none">
                                    تذكرني في المرات القادمة
                                </span>
                            </label>
                        </div>

                        {/* ── Submit Button ── */}
                        <div className="pt-6" style={stagger(5)}>
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-2xl font-black text-[15px] transition-all duration-300 shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 overflow-hidden relative group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-[sn-shimmer_1.5s_infinite]"></div>
                                {processing ? (
                                    <>
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جاري الدخول...
                                    </>
                                ) : (
                                    <>
                                        تسجيل الدخول
                                        <svg className="w-5 h-5 rtl:rotate-180 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </GuestLayout>
    );
}