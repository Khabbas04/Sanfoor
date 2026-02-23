import { useEffect, useState, useMemo } from 'react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputError from '@/Components/InputError';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Register({ colleges, majors }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        college_id: '',
        major_id: '',
    });

    const [showPw, setShowPw] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setTimeout(() => setMounted(true), 80); }, []);
    useEffect(() => () => reset('password', 'password_confirmation'), []);

    const submit = (e) => { e.preventDefault(); post(route('register')); };

    const filteredMajors = useMemo(
        () => majors.filter(m => String(m.college_id) === String(data.college_id)),
        [majors, data.college_id]
    );

    // Password strength
    const pwStrength = useMemo(() => {
        const pw = data.password;
        if (!pw) return { level: 0, label: '', color: '' };
        let score = 0;
        if (pw.length >= 6) score++;
        if (pw.length >= 10) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { level: 1, label: 'ضعيفة', color: 'bg-rose-400' };
        if (score <= 2) return { level: 2, label: 'متوسطة', color: 'bg-amber-400' };
        if (score <= 3) return { level: 3, label: 'جيدة', color: 'bg-indigo-400' };
        return { level: 4, label: 'قوية', color: 'bg-emerald-400' };
    }, [data.password]);

    const spring = 'cubic-bezier(0.16,1,0.3,1)';
    const stagger = (i) => ({
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(15px)',
        transition: `all 600ms ${spring} ${100 + i * 60}ms`,
    });

    // Styles
    const inputCls = "w-full py-3.5 pr-12 pl-4 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all duration-300 outline-none";
    const selectCls = "w-full py-3.5 pr-12 pl-4 rounded-xl border-2 border-slate-100 bg-slate-50/50 text-[13px] font-bold text-slate-700 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 focus:bg-white transition-all duration-300 outline-none disabled:bg-slate-100/50 disabled:text-slate-400 disabled:border-slate-100 appearance-none";
    const labelCls = "block text-[12px] font-black text-slate-700 mb-2";
    const iconContainerCls = "absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 pointer-events-none";

    return (
        <GuestLayout>
            <Head title="إنشاء حساب - سنفور" />

            <div dir="rtl" className="w-full max-w-md mx-auto pb-6">
                
                {/* ── Branding Header (Giant Logo & Dual Text) ── */}
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

                <form onSubmit={submit} className="space-y-5">
                    
                    {/* ── Personal Info ── */}
                    <div className="space-y-4">
                        {/* Name */}
                        <div style={stagger(1)}>
                            <label htmlFor="name" className={labelCls}>الاسم الرباعي</label>
                            <div className="relative">
                                <div className={iconContainerCls}>👤</div>
                                <input
                                    id="name"
                                    value={data.name}
                                    autoComplete="name"
                                    autoFocus
                                    placeholder="أحمد محمد علي..."
                                    onChange={e => setData('name', e.target.value)}
                                    className={inputCls}
                                    required
                                />
                            </div>
                            <InputError message={errors.name} className="mt-1.5" />
                        </div>

                        {/* Email */}
                        <div style={stagger(2)}>
                            <label htmlFor="email" className={labelCls}>البريد الجامعي أو الشخصي</label>
                            <div className="relative">
                                <div className={iconContainerCls}>✉️</div>
                                <input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    dir="ltr"
                                    autoComplete="username"
                                    placeholder="student@university.edu"
                                    onChange={e => setData('email', e.target.value)}
                                    className={`${inputCls} text-left`}
                                    required
                                />
                            </div>
                            <InputError message={errors.email} className="mt-1.5" />
                        </div>
                    </div>

                    {/* ── Academic Structure ── */}
                    <div className="p-5 bg-indigo-50/30 rounded-[1.25rem] border border-indigo-100/50 space-y-4" style={stagger(3)}>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">🎓</span>
                            <p className="text-[12px] font-black text-indigo-900">بياناتك الأكاديمية</p>
                        </div>

                        {/* College */}
                        <div>
                            <div className="relative">
                                <div className={iconContainerCls}>🏛️</div>
                                <select
                                    value={data.college_id}
                                    onChange={e => setData({ ...data, college_id: e.target.value, major_id: '' })}
                                    className={selectCls}
                                    required
                                >
                                    <option value="">— اختر الكلية —</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                </span>
                            </div>
                        </div>

                        {/* Major */}
                        <div>
                            <div className="relative">
                                <div className={iconContainerCls}>📚</div>
                                <select
                                    value={data.major_id}
                                    onChange={e => setData('major_id', e.target.value)}
                                    disabled={!data.college_id}
                                    className={selectCls}
                                    required
                                >
                                    <option value="">— {data.college_id ? 'اختر التخصص' : 'اختر الكلية أولاً'} —</option>
                                    {filteredMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                </span>
                            </div>
                            <InputError message={errors.major_id} className="mt-1.5" />
                        </div>
                    </div>

                    {/* ── Passwords ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={stagger(4)}>
                        <div>
                            <label htmlFor="password" className={labelCls}>كلمة المرور</label>
                            <div className="relative">
                                <div className={iconContainerCls}>🔑</div>
                                <input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    value={data.password}
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    onChange={e => setData('password', e.target.value)}
                                    className={inputCls}
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

                        <div>
                            <label htmlFor="pw_confirm" className={labelCls}>تأكيد كلمة المرور</label>
                            <div className="relative">
                                <div className={iconContainerCls}>🔐</div>
                                <input
                                    id="pw_confirm"
                                    type={showPw ? 'text' : 'password'}
                                    value={data.password_confirmation}
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    onChange={e => setData('password_confirmation', e.target.value)}
                                    className={`${inputCls} ${data.password_confirmation && data.password_confirmation === data.password ? 'border-emerald-200 ring-emerald-50' : ''}`}
                                    required
                                />
                                {data.password_confirmation && (
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm">
                                        {data.password_confirmation === data.password ? '✅' : '❌'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Submit Button ── */}
                    <div className="pt-4" style={stagger(5)}>
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-xl font-black text-[14px] transition-all duration-300 shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3"
                        >
                            {processing ? "جاري الإنشاء..." : "إنشاء حساب جديد"}
                            {!processing && <svg className="w-5 h-5 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>}
                        </button>
                    </div>

                    {/* ── Footer Link ── */}
                    <div className="text-center pt-4" style={stagger(6)}>
                        <p className="text-[13px] font-bold text-slate-500">
                            لديك حساب بالفعل؟{' '}
                            <Link href={route('login')} className="text-indigo-600 font-black hover:underline ml-1">
                                سجل دخولك
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}