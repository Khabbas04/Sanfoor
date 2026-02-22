import MainLayout from '@/Layouts/MainLayout';
import { Head, Link } from '@inertiajs/react';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */
function useReveal(threshold = 0.12) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.unobserve(el);
                }
            },
            { threshold }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return [ref, visible];
}

function AnimatedCounter({ target, duration = 1400, decimals = 0 }) {
    const [value, setValue] = useState(0);
    const [ref, isVisible] = useReveal(0.3);
    const num = typeof target === 'string' ? parseFloat(target) : target;

    useEffect(() => {
        if (!isVisible || isNaN(num) || num === 0) return;

        let current = 0;
        const step = num / (duration / 16);

        const timer = setInterval(() => {
            current += step;
            if (current >= num) {
                setValue(num);
                clearInterval(timer);
            } else {
                setValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [isVisible, num, duration, decimals]);

    return <span ref={ref}>{decimals > 0 ? value.toFixed(decimals) : value}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function Dashboard({
    auth,
    passed_hours = 0,
    total_hours = 132,
    gpa = "0.00",
    passed_courses = [] 
}) {

    const progressPct = useMemo(() => Math.min(Math.round((passed_hours / total_hours) * 100), 100), [passed_hours, total_hours]);

    const academicYear = useMemo(() => {
        if (passed_hours < 33) return 'السنة الأولى (سنفور)';
        if (passed_hours < 66) return 'السنة الثانية';
        if (passed_hours < 99) return 'السنة الثالثة';
        return 'السنة الرابعة (خريج)';
    }, [passed_hours]);

    const standing = useMemo(() => {
        const n = parseFloat(gpa);
        if (isNaN(n) || n === 0) return { label: 'غير محدد بعد', cls: 'text-slate-500 bg-slate-50 border-slate-200', icon: '⏳' };
        if (n >= 3.6) return { label: 'امتياز مع مرتبة الشرف', cls: 'text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200', icon: '🏆' };
        if (n >= 3.0) return { label: 'جيد جداً', cls: 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200', icon: '✨' };
        if (n >= 2.5) return { label: 'جيد', cls: 'text-blue-700 bg-blue-50 border-blue-200', icon: '👍' };
        if (n >= 2.0) return { label: 'مقبول', cls: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: '🎯' };
        return { label: 'تحت الملاحظة', cls: 'text-rose-700 bg-rose-50 border-rose-200', icon: '⚠️' };
    }, [gpa]);

    const remaining = total_hours - passed_hours;
    const circumference = 2 * Math.PI * 38;

    const motivation = useMemo(() => {
        const n = parseFloat(gpa);
        if (isNaN(n) || n === 0) return 'ابدأ رحلتك الأكاديمية وأدخل علاماتك!';
        if (n >= 3.6) return 'أداء استثنائي! حافظ على هذا المستوى المتميز 🌟';
        if (n >= 3.0) return 'مستوى ممتاز! بقيت خطوة واحدة للقمة 🚀';
        if (n >= 2.5) return 'في الطريق الصحيح! ركّز أكثر وستصل 💪';
        if (n >= 2.0) return 'لا تستسلم! كل فصل فرصة جديدة للتحسن 🎯';
        return 'استعن بالمرشد الذكي لوضع خطة تحسين فورية ⚡';
    }, [gpa]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(t);
    }, []);

    const [metricsRef, metricsVis] = useReveal(0.08);
    const [aiRef, aiVis] = useReveal(0.15);
    const [actionsRef, actionsVis] = useReveal(0.08);
    const [recordRef, recordVis] = useReveal(0.10); 

    const heroRef = useRef(null);
    const [mx, setMx] = useState(0);
    const [my, setMy] = useState(0);

    const onHeroMouse = useCallback((e) => {
        if (!heroRef.current) return;
        const rect = heroRef.current.getBoundingClientRect();
        setMx((e.clientX - rect.left - rect.width / 2) / rect.width);
        setMy((e.clientY - rect.top - rect.height / 2) / rect.height);
    }, []);

    const onHeroLeave = useCallback(() => { setMx(0); setMy(0); }, []);
    const spring = 'cubic-bezier(0.16,1,0.3,1)';

    /* ── السجل الأكاديمي والتبويبات الذكية (Smart Tabs Logic) ── */
    const processedCourses = useMemo(() => {
        return passed_courses.map(c => ({
            ...c,
            localSemester: c.pivot?.studied_semester || c.semester || 1 
        }));
    }, [passed_courses]);

    // 🔥 تصحيح الخطأ: تعريف cumulativeStats لحساب المعدل التراكمي للتبويب الرئيسي 🔥
    const cumulativeStats = useMemo(() => {
        let totalCredits = 0;
        let weightedSum = 0;
        processedCourses.forEach(c => {
            const grade = parseFloat(c.pivot?.grade);
            if (!isNaN(grade) && grade > 0) {
                totalCredits += c.credit_hours;
                weightedSum += (grade * c.credit_hours);
            }
        });
        const percentage = totalCredits > 0 ? (weightedSum / totalCredits) : 0;
        return {
            percentage: percentage.toFixed(1),
            credits: totalCredits,
            count: processedCourses.length
        };
    }, [processedCourses]);

    const semesterStats = useMemo(() => {
        const stats = {};
        processedCourses.forEach(c => {
            const sem = c.localSemester;
            if (!stats[sem]) {
                stats[sem] = { totalCredits: 0, weightedSum: 0, courseCount: 0 };
            }
            stats[sem].courseCount++;
            
            const grade = parseFloat(c.pivot?.grade);
            if (!isNaN(grade) && grade > 0) {
                stats[sem].totalCredits += c.credit_hours;
                stats[sem].weightedSum += (grade * c.credit_hours);
            }
        });

        const finalStats = {};
        Object.keys(stats).forEach(sem => {
            const data = stats[sem];
            const percentage = data.totalCredits > 0 ? (data.weightedSum / data.totalCredits) : 0;
            const gpa4 = data.totalCredits > 0 ? (percentage / 25).toFixed(2) : '0.00';
            
            finalStats[sem] = {
                percentage: percentage.toFixed(1),
                gpa4,
                credits: data.totalCredits,
                count: data.courseCount
            };
        });
        return finalStats;
    }, [processedCourses]);

    const recordSemesters = useMemo(() => {
        return Object.keys(semesterStats).map(Number).sort((a, b) => a - b);
    }, [semesterStats]);

    const [recordActiveTab, setRecordActiveTab] = useState(recordSemesters.length > 0 ? recordSemesters[0] : 'all');

    const recordDisplayedCourses = useMemo(() => {
        if (recordActiveTab === 'all') return processedCourses;
        return processedCourses.filter(c => c.localSemester === recordActiveTab);
    }, [processedCourses, recordActiveTab]);

    const getBadgeColor = (grade) => {
        const val = parseFloat(grade);
        if (isNaN(val)) return 'bg-slate-100 text-slate-500 border-slate-200';
        if (val >= 84) return 'bg-emerald-100 text-emerald-700 border-emerald-200'; 
        if (val >= 76) return 'bg-blue-100 text-blue-700 border-blue-200'; 
        if (val >= 68) return 'bg-indigo-100 text-indigo-700 border-indigo-200'; 
        if (val >= 60) return 'bg-amber-100 text-amber-700 border-amber-200'; 
        return 'bg-rose-100 text-rose-700 border-rose-200'; 
    };

    return (
        <MainLayout user={auth.user}>
            <Head title="لوحة التحكم - سنفور" />

            <style>{`
                @keyframes sn-up { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes sn-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
                @keyframes sn-shimmer { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
                @keyframes sn-glow { 0%, 100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.28; transform: scale(1.06); } }
                @keyframes sn-rotate-border { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes sn-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
                @keyframes sn-ring-pulse { 0% { transform: scale(1); opacity: 0.35; } 100% { transform: scale(1.6); opacity: 0; } }
                @keyframes sn-gradient-drift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            <div className="py-6 sm:py-8 min-h-screen selection:bg-indigo-100 selection:text-indigo-900" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">

                    {/* 1. STUDENT ID — HERO CARD */}
                    <div
                        ref={heroRef}
                        onMouseMove={onHeroMouse}
                        onMouseLeave={onHeroLeave}
                        className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-2xl border border-white/[0.06]"
                        style={{
                            background: 'linear-gradient(to bottom left, #0f172a, #0f172a, #1e1b4b)',
                            opacity: mounted ? 1 : 0,
                            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.985)',
                            transition: `all 1000ms ${spring}`,
                        }}
                    >
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="absolute top-0 right-0 w-[70%] h-full bg-gradient-to-l from-indigo-600/25 via-indigo-600/8 to-transparent" />
                            <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * -22}px, ${my * -22}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * 18}px, ${my * 18}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute top-1/2 left-1/3 w-32 h-32 rounded-full hidden md:block" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', filter: 'blur(50px)', transform: `translate(${mx * -10}px, ${my * 10}px)`, transition: `transform 900ms ${spring}` }} />
                            <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }} />
                            <div className="absolute top-0 left-0 w-full h-[1px] overflow-hidden"><div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'sn-shimmer 4.5s ease-in-out infinite' }} /></div>
                        </div>

                        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-2 rounded-[1.4rem] opacity-0 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', filter: 'blur(18px)', animation: 'sn-glow 3s ease-in-out infinite', transition: 'opacity 700ms ease' }} />
                                    <div className="relative w-[78px] h-[78px] sm:w-[90px] sm:h-[90px] rounded-[1.3rem] p-[3px] overflow-hidden">
                                        <div className="absolute inset-0" style={{ background: 'conic-gradient(from 0deg, #6366f1, #06b6d4, #8b5cf6, #6366f1)', animation: 'sn-rotate-border 5s linear infinite' }} />
                                        <div className="relative w-full h-full bg-[#0f172a] rounded-[calc(1.3rem-3px)] flex items-center justify-center text-2xl sm:text-3xl font-[900] z-10 select-none">
                                            {auth.user?.name?.charAt(0) || 'S'}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1 min-w-0 text-center sm:text-right">
                                    <div>
                                        <h1 className="text-[1.55rem] sm:text-[1.9rem] font-[900] tracking-tight truncate leading-tight">{auth.user?.name || 'طالب مجهول'}</h1>
                                        <p className="text-indigo-300/50 text-sm mt-1 truncate">{auth.user?.email || 'لا يوجد بريد إلكتروني'}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        {[{ text: auth.user?.major?.name || 'تخصص غير محدد', icon: '🎓', d: 200 }, { text: academicYear, icon: '📅', d: 320 }].map((badge, i) => (
                                            <span key={i} className="bg-white/[0.07] backdrop-blur-md border border-white/[0.1] px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 hover:bg-white/[0.13] transition-colors cursor-default" style={{ animation: mounted ? `sn-pop 0.55s ${spring} ${badge.d}ms both` : 'none' }}>
                                                {badge.icon} {badge.text}
                                            </span>
                                        ))}
                                        <span className={`px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 border cursor-default ${standing.cls}`} style={{ animation: mounted ? `sn-pop 0.55s ${spring} 440ms both` : 'none' }}>
                                            {standing.icon} {standing.label}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-indigo-200/35 mt-1 hidden sm:block" style={{ animation: mounted ? `sn-up 0.65s ${spring} 550ms both` : 'none' }}>
                                        💡 {motivation}
                                    </p>
                                </div>
                                <div className="hidden lg:flex flex-col items-center justify-center opacity-[0.08] hover:opacity-60 transition-opacity duration-700 select-none cursor-default shrink-0 ml-4">
                                    <span className="text-5xl mb-1.5">🏛️</span>
                                    <span className="text-[9px] font-[900] uppercase tracking-[0.3em]">Zarqa University</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. METRICS GRID */}
                    <div ref={metricsRef} className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white p-6 rounded-[1.6rem] border border-slate-100 relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: metricsVis ? 1 : 0, transform: metricsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: '0ms' }}>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-[3rem] -z-0 transition-transform group-hover:scale-[3] duration-[800ms] ease-out" />
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-100 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">الساعات المنجزة</p>
                                    <h3 className="text-[2.15rem] font-[900] text-slate-800 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}><AnimatedCounter target={passed_hours} /><span className="text-sm font-bold text-slate-300 mr-1">/ {total_hours}</span></h3>
                                    <div className="mt-3 w-full bg-slate-100 h-[5px] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-l from-emerald-400 to-emerald-500 rounded-full" style={{ width: metricsVis ? `${progressPct}%` : '0%', transition: `width 2000ms ${spring} 350ms` }} /></div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl border border-emerald-100 group-hover:rotate-[20deg] group-hover:scale-110 transition-all duration-500 shrink-0">⏳</div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[1.6rem] border border-slate-100 relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: metricsVis ? 1 : 0, transform: metricsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: '130ms' }}>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-[3rem] -z-0 transition-transform group-hover:scale-[3] duration-[800ms] ease-out" />
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-100 rounded-full blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">المعدل التراكمي (GPA)</p>
                                    <h3 className="text-[2.15rem] font-[900] text-slate-800 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}><AnimatedCounter target={gpa} decimals={2} duration={1800} /><span className="text-sm font-bold text-slate-300 mr-1">/ 4.00</span></h3>
                                    <div className="mt-3 w-full bg-slate-100 h-[5px] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-l from-indigo-400 to-indigo-500 rounded-full" style={{ width: metricsVis ? `${Math.min((parseFloat(gpa) / 4) * 100, 100)}%` : '0%', transition: `width 2000ms ${spring} 450ms` }} /></div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-xl border border-indigo-100 group-hover:rotate-[20deg] group-hover:scale-110 transition-all duration-500 shrink-0">🎯</div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-[1.6rem] border border-slate-100 flex items-center gap-5 relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: metricsVis ? 1 : 0, transform: metricsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: '260ms' }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-cyan-50/0 group-hover:from-indigo-50/40 group-hover:to-cyan-50/40 transition-all duration-700" />
                            <div className="relative shrink-0 z-10">
                                <svg className="w-[86px] h-[86px] transform -rotate-90" viewBox="0 0 86 86">
                                    <circle cx="43" cy="43" r="38" stroke="#f1f5f9" strokeWidth="7" fill="transparent" />
                                    <circle cx="43" cy="43" r="38" stroke="url(#progressGrad)" strokeWidth="7" fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={metricsVis ? circumference - (circumference * progressPct) / 100 : circumference} style={{ transition: `stroke-dashoffset 2200ms ${spring} 500ms` }} />
                                    <defs>
                                        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#4f46e5" /><stop offset="50%" stopColor="#6366f1" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col"><span className="text-[1.15rem] font-[900] text-slate-800 leading-none">{progressPct}%</span><span className="text-[8px] font-bold text-slate-400 mt-0.5">مكتمل</span></div>
                            </div>
                            <div className="relative z-10 flex-1 min-w-0">
                                <h4 className="text-[1rem] font-[800] text-slate-800 mb-1">رحلة التخرج 🎓</h4>
                                <p className="text-[12px] text-slate-500 leading-relaxed">{remaining > 0 ? <>بقيت <span className="text-indigo-600 font-bold">{remaining} ساعة</span> لترتدي روب التخرج!</> : <span className="text-emerald-600 font-bold">مبروك! أنت جاهز للتخرج 🎉</span>}</p>
                                {remaining > 0 && <p className="text-[10px] text-slate-400 mt-1.5">≈ {Math.ceil(remaining / 15)} فصول متبقية <span className="text-slate-300">(15 ساعة/فصل)</span></p>}
                            </div>
                        </div>
                    </div>

                    {/* 3. AI INSIGHT BANNER */}
                    <div ref={aiRef} className="relative overflow-hidden rounded-[1.4rem]" style={{ opacity: aiVis ? 1 : 0, transform: aiVis ? 'translateY(0)' : 'translateY(14px)', transition: `all 700ms ${spring} 80ms` }}>
                        <div className="absolute inset-0 rounded-[1.4rem] p-[1.5px]" style={{ background: 'linear-gradient(135deg, #c7d2fe, #a5f3fc, #c7d2fe, #a5f3fc)', backgroundSize: '300% 300%', animation: 'sn-gradient-drift 6s ease infinite' }}>
                            <div className="w-full h-full rounded-[calc(1.4rem-1.5px)] bg-gradient-to-l from-indigo-50/95 to-cyan-50/70 backdrop-blur-sm" />
                        </div>
                        <div className="relative z-10 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-[1.4rem] shadow-lg shadow-indigo-300/40" style={{ animation: 'sn-float 3.5s ease-in-out infinite' }}>🤖</div>
                                    <div className="absolute -inset-1 rounded-xl border-2 border-indigo-400/30" style={{ animation: 'sn-ring-pulse 2.5s ease-out infinite' }} />
                                </div>
                                <div>
                                    <h4 className="text-[14px] font-[800] text-indigo-900 mb-0.5">نصيحة المرشد الذكي</h4>
                                    <p className="text-[12px] text-indigo-700/55 leading-relaxed max-w-lg">زُر الخريطة الشجرية لتوليد خطة الفصل القادم باستخدام الذكاء الاصطناعي وتجنب التعارضات، أو تحدث معي مباشرة لأي استفسار.</p>
                                </div>
                            </div>
                            <Link href={route('ai.advisor')} className="bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-indigo-200/50 active:scale-[0.96] whitespace-nowrap shrink-0 flex items-center gap-2">
                                تحدث مع المرشد <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════
                        4. السجل الأكاديمي المطور (SMART TABS RECORD)
                    ═══════════════════════════════════════════════ */}
                    {processedCourses.length > 0 && (
                        <div 
                            ref={recordRef}
                            className="bg-white rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden"
                            style={{
                                opacity: recordVis ? 1 : 0,
                                transform: recordVis ? 'translateY(0)' : 'translateY(20px)',
                                transition: `all 800ms ${spring} 100ms`,
                            }}
                        >
                            <div className="bg-slate-50/80 border-b border-slate-100 p-6 sm:px-8">
                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                            <span className="text-2xl">📋</span> السجل الأكاديمي
                                        </h3>
                                        <p className="text-xs font-bold text-slate-400 mt-1">اضغط على أي فصل لرؤية مواده وإحصائياته المباشرة</p>
                                    </div>
                                    <Link href={route('calculator.index')} className="text-[11px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors shrink-0 text-center border border-indigo-100">
                                        إدارة السجل وحساب المعدل ⚙️
                                    </Link>
                                </div>

                                {/* 🔥 Smart Tabs Row 🔥 */}
                                <div className="flex items-stretch gap-3 overflow-x-auto hide-scrollbar pb-4 pt-1">
                                    {/* تبويب التراكمي العام (الافتراضي) */}
                                    <button
                                        onClick={() => setRecordActiveTab('all')}
                                        className={`group relative shrink-0 text-right transition-all duration-300 ${
                                            recordActiveTab === 'all' ? 'transform scale-[1.02]' : 'hover:-translate-y-1'
                                        }`}
                                    >
                                        <div className={`p-4 rounded-2xl border-2 transition-all duration-300 w-48 h-full flex flex-col justify-between ${
                                            recordActiveTab === 'all' 
                                            ? 'bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/20' 
                                            : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
                                        }`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`text-sm font-black ${recordActiveTab === 'all' ? 'text-white' : 'text-slate-700'}`}>
                                                    🌐 التراكمي العام
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${recordActiveTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                    {processedCourses.length} مواد
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-2xl font-[900] ${recordActiveTab === 'all' ? 'text-white' : 'text-slate-800'}`}>
                                                        {cumulativeStats?.percentage || '0.0'}
                                                    </span>
                                                    <span className={`text-xs font-bold ${recordActiveTab === 'all' ? 'text-indigo-300' : 'text-slate-400'}`}>%</span>
                                                </div>
                                                <span className={`text-[10px] font-bold mb-1 ${recordActiveTab === 'all' ? 'text-slate-400' : 'text-slate-400'}`}>
                                                    {cumulativeStats?.credits || 0} ساعة
                                                </span>
                                            </div>
                                        </div>
                                    </button>

                                    {/* تبويبات الفصول (ديناميكية) */}
                                    {recordSemesters.map(sem => {
                                        const stats = semesterStats[sem];
                                        const isActive = recordActiveTab === sem;
                                        
                                        return (
                                            <button
                                                key={sem}
                                                onClick={() => setRecordActiveTab(sem)}
                                                className={`group relative shrink-0 text-right transition-all duration-300 ${isActive ? 'transform scale-[1.02]' : 'hover:-translate-y-1'}`}
                                            >
                                                <div className={`p-4 rounded-2xl border-2 transition-all duration-300 w-44 h-full flex flex-col justify-between ${
                                                    isActive 
                                                    ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-200' 
                                                    : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'
                                                }`}>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className={`text-sm font-black ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                            الفصل {sem}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>
                                                            {stats.count} مواد
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className={`text-2xl font-[900] ${isActive ? 'text-indigo-700' : 'text-slate-800'}`}>
                                                                {stats.percentage > 0 ? stats.percentage : '--'}
                                                            </span>
                                                            <span className={`text-xs font-bold ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>%</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold mb-1 ${isActive ? 'text-indigo-600/70' : 'text-slate-400'}`}>
                                                            {stats.credits} ساعة
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Courses List */}
                            <div className="p-6 sm:p-8 bg-white min-h-[250px]">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {recordDisplayedCourses.map((course, idx) => (
                                        <div 
                                            key={`${recordActiveTab}-${course.id}`}
                                            className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-300"
                                            style={{ animation: `sn-up 0.4s ${spring} ${idx * 40}ms both` }}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                                                    {course.credit_hours}س
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-slate-800 group-hover:text-indigo-900 transition-colors line-clamp-1">{course.name}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{course.code}</p>
                                                </div>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-lg text-[11px] font-black border shadow-sm ${getBadgeColor(course.pivot?.grade)}`}>
                                                {course.pivot?.grade ? `${course.pivot.grade}%` : 'منجزة'}
                                            </div>
                                        </div>
                                    ))}
                                    {recordDisplayedCourses.length === 0 && (
                                        <div className="col-span-1 lg:col-span-2 text-center py-10 text-slate-400 font-bold text-sm">
                                            لا توجد مواد مسجلة في هذا الفصل.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. ACTION MODULES */}
                    <div ref={actionsRef} className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                        <Link href={route('tree.index')} className="group block">
                            <div className="bg-white border-2 border-slate-100 group-hover:border-indigo-400 rounded-[1.8rem] p-7 group-hover:shadow-[0_24px_60px_rgba(0,0,0,0.06)] group-hover:-translate-y-2 transition-all duration-500 flex flex-col h-full relative overflow-hidden" style={{ opacity: actionsVis ? 1 : 0, transform: actionsVis ? 'translateY(0)' : 'translateY(20px)', transition: `opacity 600ms ${spring}, transform 600ms ${spring}, border-color 300ms, box-shadow 300ms`, transitionDelay: '0ms' }}>
                                <div className="absolute -top-10 -left-10 w-36 h-36 bg-indigo-50 rounded-full blur-3xl opacity-0 group-hover:opacity-80 transition-opacity duration-600" />
                                <div className="flex justify-between items-start mb-5 relative z-10">
                                    <div className="w-[54px] h-[54px] rounded-[14px] bg-slate-50 flex items-center justify-center text-[1.6rem] transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:scale-[1.08] group-hover:bg-indigo-600 group-hover:text-white">🌳</div>
                                    <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all duration-300"><svg className="w-4 h-4 rtl:-scale-x-100 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></div>
                                </div>
                                <div className="relative z-10"><h4 className="text-[1.2rem] font-[900] text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors duration-300">مخطط الشجرة التفاعلي</h4><p className="text-slate-500 text-[13px] leading-[1.7]">استكشف مواد تخصصك، افهم المتطلبات السابقة، واكتشف المسار الحرج الذي يضمن تخرجك في الوقت المحدد.</p></div>
                            </div>
                        </Link>
                        <Link href={route('calculator.index')} className="group block">
                            <div className="bg-white border-2 border-slate-100 group-hover:border-emerald-400 rounded-[1.8rem] p-7 group-hover:shadow-[0_24px_60px_rgba(0,0,0,0.06)] group-hover:-translate-y-2 transition-all duration-500 flex flex-col h-full relative overflow-hidden" style={{ opacity: actionsVis ? 1 : 0, transform: actionsVis ? 'translateY(0)' : 'translateY(20px)', transition: `opacity 600ms ${spring}, transform 600ms ${spring}, border-color 300ms, box-shadow 300ms`, transitionDelay: '150ms' }}>
                                <div className="absolute -top-10 -left-10 w-36 h-36 bg-emerald-50 rounded-full blur-3xl opacity-0 group-hover:opacity-80 transition-opacity duration-600" />
                                <div className="flex justify-between items-start mb-5 relative z-10">
                                    <div className="w-[54px] h-[54px] rounded-[14px] bg-slate-50 flex items-center justify-center text-[1.6rem] transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:scale-[1.08] group-hover:bg-emerald-500 group-hover:text-white">📈</div>
                                    <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all duration-300"><svg className="w-4 h-4 rtl:-scale-x-100 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></div>
                                </div>
                                <div className="relative z-10"><h4 className="text-[1.2rem] font-[900] text-slate-800 mb-2 group-hover:text-emerald-600 transition-colors duration-300">حاسبة التفوق الأكاديمي</h4><p className="text-slate-500 text-[13px] leading-[1.7]">توقع معدلك التراكمي، أدخل علاماتك الحالية والمستقبلية، واعرف بالضبط ما تحتاجه للوصول إلى مرتبة الشرف بدقة.</p></div>
                            </div>
                        </Link>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}