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
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: `all 500ms ${spring} ${100 + i * 60}ms`,
    });

    return (
        <GuestLayout>
            <Head title="تسجيل الدخول - سنفور" />

            <div dir="rtl">
                {/* ── Header ── */}
                <div className="text-center mb-7" style={stagger(0)}>
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500 to-cyan-500 text-white text-xl rounded-xl shadow-lg shadow-indigo-200/40 mb-3.5">
                        👋
                    </div>
                    <h2 className="text-[1.4rem] font-[900] text-slate-800 mb-1">مرحباً بعودتك</h2>
                    <p className="text-[13px] font-bold text-slate-400 font-i">سجّل دخولك للمتابعة في رحلتك الأكاديمية</p>
                </div>

                {/* ── Status message ── */}
                {status && (
                    <div className="mb-5 text-[13px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-center" style={stagger(1)}>
                        {status}
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    {/* ── Email ── */}
                    <div style={stagger(1)}>
                        <label htmlFor="email" className="block text-[12px] font-[800] text-slate-600 mb-1.5">البريد الإلكتروني</label>
                        <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">✉️</span>
                            <input
                                id="email"
                                type="email"
                                value={data.email}
                                dir="ltr"
                                autoComplete="username"
                                autoFocus
                                placeholder="example@email.com"
                                onChange={(e) => setData('email', e.target.value)}
                                className="w-full pr-10 pl-4 py-3 rounded-xl border-2 border-slate-200/80 bg-slate-50/60 text-sm font-bold text-slate-700 text-left placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all duration-300"
                            />
                        </div>
                        <InputError message={errors.email} className="mt-1.5" />
                    </div>

                    {/* ── Password ── */}
                    <div style={stagger(2)}>
                        <label htmlFor="password" className="block text-[12px] font-[800] text-slate-600 mb-1.5">كلمة المرور</label>
                        <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔑</span>
                            <input
                                id="password"
                                type={showPw ? 'text' : 'password'}
                                value={data.password}
                                autoComplete="current-password"
                                placeholder="••••••••"
                                onChange={(e) => setData('password', e.target.value)}
                                className="w-full pr-10 pl-12 py-3 rounded-xl border-2 border-slate-200/80 bg-slate-50/60 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all duration-300"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 text-sm transition-colors p-0.5"
                                tabIndex={-1}
                            >
                                {showPw ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <InputError message={errors.password} className="mt-1.5" />
                    </div>

                    {/* ── Remember & Forgot ── */}
                    <div className="flex items-center justify-between pt-0.5" style={stagger(3)}>
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <Checkbox
                                name="remember"
                                checked={data.remember}
                                onChange={(e) => setData('remember', e.target.checked)}
                            />
                            <span className="text-[12px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors">
                                تذكرني
                            </span>
                        </label>

                        {canResetPassword && (
                            <Link
                                href={route('password.request')}
                                className="text-[12px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                            >
                                نسيت كلمة المرور؟
                            </Link>
                        )}
                    </div>

                    {/* ── Submit ── */}
                    <div style={stagger(4)}>
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white py-3.5 rounded-xl font-[800] text-[14px] transition-all duration-300 shadow-lg shadow-indigo-200/40 active:scale-[0.97] disabled:opacity-50 relative overflow-hidden group"
                        >
                            {/* hover shine */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {processing ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جاري الدخول...
                                    </>
                                ) : (
                                    <>
                                        تسجيل الدخول
                                        <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                    </>
                                )}
                            </span>
                        </button>
                    </div>

                    {/* ── Register link ── */}
                    <div className="text-center pt-4 border-t border-slate-100" style={stagger(5)}>
                        <span className="text-[13px] font-bold text-slate-400">ليس لديك حساب؟ </span>
                        <Link
                            href={route('register')}
                            className="text-[13px] font-[800] text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            أنشئ حساباً جديداً
                        </Link>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}
