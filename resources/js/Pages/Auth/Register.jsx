import { useEffect, useState, useMemo } from 'react';
import GuestLayout from '@/Layouts/GuestLayout';
import InputError from '@/Components/InputError';
import Checkbox from '@/Components/Checkbox';
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
        if (score <= 3) return { level: 3, label: 'جيدة', color: 'bg-blue-400' };
        return { level: 4, label: 'قوية', color: 'bg-emerald-400' };
    }, [data.password]);

    const spring = 'cubic-bezier(0.16,1,0.3,1)';
    const stagger = (i) => ({
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: `all 500ms ${spring} ${100 + i * 55}ms`,
    });

    const inputCls = "w-full py-3 rounded-xl border-2 border-slate-200/80 bg-slate-50/60 text-sm font-bold text-slate-700 placeholder:text-slate-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all duration-300";
    const selectCls = "w-full py-3 rounded-xl border-2 border-slate-200/80 bg-slate-50/60 text-sm font-bold text-slate-700 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all duration-300 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200";
    const labelCls = "block text-[12px] font-[800] text-slate-600 mb-1.5";

    return (
        <GuestLayout>
            <Head title="حساب جديد - سنفور" />

            <div dir="rtl">
                {/* ── Header ── */}
                <div className="text-center mb-6" style={stagger(0)}>
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500 to-cyan-500 text-white text-xl rounded-xl shadow-lg shadow-indigo-200/40 mb-3.5">
                        🚀
                    </div>
                    <h2 className="text-[1.3rem] font-[900] text-slate-800 mb-1">أنشئ حسابك الأكاديمي</h2>
                    <p className="text-[13px] font-bold text-slate-400 font-i">سجّل الآن وابدأ رحلتك مع سنفور</p>
                </div>

                <form onSubmit={submit} className="space-y-3.5">
                    {/* ── Name ── */}
                    <div style={stagger(1)}>
                        <label htmlFor="name" className={labelCls}>الاسم الرباعي</label>
                        <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">👤</span>
                            <input
                                id="name"
                                value={data.name}
                                autoComplete="name"
                                autoFocus
                                placeholder="أحمد محمد ..."
                                onChange={e => setData('name', e.target.value)}
                                className={`${inputCls} pr-10 pl-4`}
                                required
                            />
                        </div>
                        <InputError message={errors.name} className="mt-1.5" />
                    </div>

                    {/* ── Email ── */}
                    <div style={stagger(2)}>
                        <label htmlFor="email" className={labelCls}>البريد الإلكتروني</label>
                        <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">✉️</span>
                            <input
                                id="email"
                                type="email"
                                value={data.email}
                                dir="ltr"
                                autoComplete="username"
                                placeholder="example@email.com"
                                onChange={e => setData('email', e.target.value)}
                                className={`${inputCls} pr-10 pl-4 text-left`}
                                required
                            />
                        </div>
                        <InputError message={errors.email} className="mt-1.5" />
                    </div>

                    {/* ── Academic Structure ── */}
                    <div className="p-4 bg-slate-50/70 rounded-[1rem] border border-slate-100 space-y-3.5" style={stagger(3)}>
                        <p className="text-[11px] font-[800] text-slate-500 flex items-center gap-1.5">🏛️ البيانات الأكاديمية</p>

                        {/* College */}
                        <div>
                            <label className={labelCls}>الكلية</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🎓</span>
                                <select
                                    value={data.college_id}
                                    onChange={e => setData({ ...data, college_id: e.target.value, major_id: '' })}
                                    className={`${selectCls} pr-10 pl-4 appearance-none`}
                                    required
                                >
                                    <option value="">— اختر كليتك —</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                </span>
                            </div>
                        </div>

                        {/* Major */}
                        <div>
                            <label className={labelCls}>التخصص</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">📚</span>
                                <select
                                    value={data.major_id}
                                    onChange={e => setData('major_id', e.target.value)}
                                    disabled={!data.college_id}
                                    className={`${selectCls} pr-10 pl-4 appearance-none`}
                                    required
                                >
                                    <option value="">— {data.college_id ? 'اختر تخصصك' : 'اختر الكلية أولاً'} —</option>
                                    {filteredMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                </span>
                            </div>
                            <InputError message={errors.major_id} className="mt-1.5" />

                            {/* feedback when college selected but no majors */}
                            {data.college_id && filteredMajors.length === 0 && (
                                <p className="text-[11px] text-amber-600 font-bold mt-1.5 font-i">⚠️ لا يوجد تخصصات لهذه الكلية بعد.</p>
                            )}
                        </div>
                    </div>

                    {/* ── Passwords ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={stagger(4)}>
                        <div>
                            <label htmlFor="password" className={labelCls}>كلمة المرور</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔑</span>
                                <input
                                    id="password"
                                    type={showPw ? 'text' : 'password'}
                                    value={data.password}
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    onChange={e => setData('password', e.target.value)}
                                    className={`${inputCls} pr-10 pl-10`}
                                    required
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
                            {/* Password strength */}
                            {data.password && (
                                <div className="mt-1.5 flex items-center gap-2">
                                    <div className="flex-1 flex gap-0.5">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${pwStrength.level >= i ? pwStrength.color : 'bg-slate-200'}`} />
                                        ))}
                                    </div>
                                    <span className={`text-[10px] font-[700] ${pwStrength.level <= 1 ? 'text-rose-500' : pwStrength.level <= 2 ? 'text-amber-500' : pwStrength.level <= 3 ? 'text-blue-500' : 'text-emerald-500'}`}>
                                        {pwStrength.label}
                                    </span>
                                </div>
                            )}
                            <InputError message={errors.password} className="mt-1.5" />
                        </div>

                        <div>
                            <label htmlFor="pw_confirm" className={labelCls}>تأكيد كلمة المرور</label>
                            <div className="relative">
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔐</span>
                                <input
                                    id="pw_confirm"
                                    type={showPw ? 'text' : 'password'}
                                    value={data.password_confirmation}
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    onChange={e => setData('password_confirmation', e.target.value)}
                                    className={`${inputCls} pr-10 pl-4 ${data.password_confirmation && data.password_confirmation === data.password ? 'border-emerald-300 focus:border-emerald-400' : ''}`}
                                    required
                                />
                                {/* match indicator */}
                                {data.password_confirmation && (
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                                        {data.password_confirmation === data.password ? '✅' : '❌'}
                                    </span>
                                )}
                            </div>
                            <InputError message={errors.password_confirmation} className="mt-1.5" />
                        </div>
                    </div>

                    {/* ── Submit ── */}
                    <div className="pt-2" style={stagger(5)}>
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white py-3.5 rounded-xl font-[800] text-[14px] transition-all duration-300 shadow-lg shadow-indigo-200/40 active:scale-[0.97] disabled:opacity-50 relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {processing ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جاري إنشاء الحساب...
                                    </>
                                ) : (
                                    <>
                                        إنشاء الحساب
                                        <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                    </>
                                )}
                            </span>
                        </button>
                    </div>

                    {/* ── Login link ── */}
                    <div className="text-center pt-3.5 border-t border-slate-100" style={stagger(6)}>
                        <span className="text-[13px] font-bold text-slate-400">لديك حساب بالفعل؟ </span>
                        <Link
                            href={route('login')}
                            className="text-[13px] font-[800] text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            سجّل دخولك
                        </Link>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}
