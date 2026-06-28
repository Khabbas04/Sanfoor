import { useEffect, useState, useMemo } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';

export default function CompleteProfile({ colleges, majors }) {
    const { auth } = usePage().props;
    const user = auth?.user || {};

    const { data, setData, post, processing, errors } = useForm({
        college_id: '',
        major_id: '',
        study_plan_version: '12',
    });

    const isGuest = user.role === 'guest';

    const [mounted, setMounted] = useState(false);
    const [step, setStep] = useState(1); // 1=college, 2=major, 3=plan, 4=confirm

    useEffect(() => {
        setTimeout(() => setMounted(true), 100);
    }, []);

    const filteredMajors = useMemo(
        () => (majors || []).filter(m => String(m.college_id) === String(data.college_id)),
        [majors, data.college_id]
    );

    const selectedCollege = useMemo(
        () => (colleges || []).find(c => String(c.id) === String(data.college_id)),
        [colleges, data.college_id]
    );

    const selectedMajor = useMemo(
        () => (majors || []).find(m => String(m.id) === String(data.major_id)),
        [majors, data.major_id]
    );

    const handleCollegeSelect = (id) => {
        setData({ ...data, college_id: String(id), major_id: '' });
        setTimeout(() => setStep(2), 300);
    };

    const handleMajorSelect = (id) => {
        setData('major_id', String(id));
        setTimeout(() => setStep(3), 300);
    };

    const handlePlanSelect = (version) => {
        setData('study_plan_version', String(version));
        setTimeout(() => setStep(4), 300);
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('profile.complete.update'));
    };

    const spring = 'cubic-bezier(0.16,1,0.3,1)';
    const stagger = (i) => ({
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        transition: `all 700ms ${spring} ${120 + i * 80}ms`,
    });

    const stepIndicator = (stepNum, label, icon) => {
        const isActive = step === stepNum;
        const isCompleted = step > stepNum;
        return (
            <div className="flex flex-col items-center gap-1.5 transition-all duration-500" key={stepNum}>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl transition-all duration-500 shadow-sm backdrop-blur-md ${
                    isCompleted
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30 scale-100'
                        : isActive
                            ? 'bg-white text-blue-600 shadow-white/40 scale-110'
                            : 'bg-white/20 text-white/70 scale-95 border border-white/10'
                }`}>
                    {isCompleted ? '✓' : icon}
                </div>
                <span className={`text-[10px] sm:text-[11px] font-black tracking-tight transition-all duration-300 ${
                    isActive ? 'text-white' : isCompleted ? 'text-emerald-300' : 'text-white/60'
                }`}>{label}</span>
            </div>
        );
    };

    const cardBase = "p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] group/item";
    const cardSelected = "border-emerald-500 bg-emerald-900/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30";
    const cardDefault = "border-slate-700/50 bg-slate-800/40 hover:border-emerald-500/40 hover:shadow-lg hover:bg-slate-800/70";

    return (
        <>
            <Head title="أكمل ملفك الأكاديمي - سنفور" />
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes gradientMove {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                @keyframes floatParticle {
                    0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.15; }
                    50% { transform: translateY(-30px) rotate(180deg); opacity: 0.3; }
                }
                @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.1); }
                    50% { box-shadow: 0 0 40px rgba(59,130,246,0.2); }
                }
                .animate-gradient { animation: gradientMove 8s ease infinite; background-size: 200% 200%; }
                .animate-float { animation: floatParticle 6s ease-in-out infinite; }
                .animate-glow { animation: pulseGlow 3s ease-in-out infinite; }
                .step-enter { animation: stepSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
                @keyframes stepSlideIn {
                    from { opacity: 0; transform: translateY(24px) scale(0.96); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes shimmerSweep {
                    0% { transform: translateX(100%); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes pulseBorder {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.02); }
                }
                .animate-shimmer { animation: shimmerSweep 3s infinite linear; }
                .animate-pulse-border { animation: pulseBorder 4s infinite ease-in-out; }
            ` }} />

            <div dir="rtl" className="min-h-screen bg-[#020617] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/30 via-[#020617] to-blue-900/30 flex items-center justify-center px-4 py-8 relative overflow-hidden">
                
                {/* Tech Dot Grid Overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] opacity-60 pointer-events-none"></div>

                {/* Floating background particles */}
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-emerald-500/15 blur-[120px] animate-float pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-blue-600/15 blur-[150px] animate-float pointer-events-none" style={{animationDelay: '3s'}}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-indigo-500/10 blur-[150px] pointer-events-none"></div>

                {/* Floating Tech/Code Symbols */}
                <div className="absolute top-[15%] left-[15%] text-emerald-400/20 text-3xl font-black font-mono animate-float pointer-events-none select-none" style={{animationDelay: '0s'}}>+</div>
                <div className="absolute bottom-[25%] right-[10%] text-blue-400/20 text-4xl font-black font-mono animate-float pointer-events-none select-none" style={{animationDelay: '1.5s'}}>+</div>
                <div className="absolute top-[30%] right-[25%] text-indigo-400/10 text-2xl font-black font-mono animate-float pointer-events-none select-none" style={{animationDelay: '3.5s'}}>{'{ }'}</div>
                <div className="absolute bottom-[20%] left-[25%] text-white/10 text-2xl font-black font-mono animate-float pointer-events-none select-none" style={{animationDelay: '2.2s'}}>&lt;/&gt;</div>
                <div className="absolute top-[60%] left-[5%] text-sky-400/10 text-xl font-black font-mono animate-float pointer-events-none select-none" style={{animationDelay: '4.1s'}}>#</div>

                <div className="w-full max-w-2xl relative z-10">
                    {/* Logo + Welcome */}
                    <div className="text-center mb-8" style={stagger(0)}>
                        {isGuest ? (
                            <div className="flex flex-col items-center justify-center mb-6 animate-enter">
                                <div className="flex items-center justify-center gap-4 sm:gap-8 mb-4">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all"></div>
                                        <img src="/images/sanfoor.png" alt="Sanfoor" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-2xl relative z-10 transform transition-transform hover:scale-110" />
                                    </div>
                                    <div className="relative flex items-center justify-center mx-6 sm:mx-10 group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/30 to-emerald-400/30 blur-xl rounded-full group-hover:blur-2xl transition-all duration-700 animate-pulse"></div>
                                        <span className="relative z-10 text-4xl sm:text-5xl font-black italic font-serif select-none bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-emerald-500 to-sky-500 animate-gradient drop-shadow-2xl transform group-hover:scale-125 transition-transform duration-500">
                                            X
                                        </span>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-green-500/15 rounded-full blur-xl group-hover:bg-green-500/30 transition-all"></div>
                                        <img src="/images/ntp-logo.png" alt="NTP 2026" className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-2xl relative z-10 transform transition-transform hover:scale-110" />
                                    </div>
                                </div>
                                <div className="relative group inline-flex items-center justify-center mb-6 cursor-default">
                                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                                    <div className="relative inline-flex items-center px-5 py-2.5 rounded-full bg-white/90 backdrop-blur-md border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] group-hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 transform group-hover:-translate-y-0.5 overflow-hidden">
                                        <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/60 to-transparent -skew-x-12 animate-shimmer pointer-events-none z-10"></div>
                                        <span className="relative flex h-3 w-3 ml-3 z-20">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </span>
                                        <span className="text-sm sm:text-base font-extrabold bg-clip-text text-transparent bg-gradient-to-l from-slate-800 to-slate-600 tracking-wide z-20 relative">
                                            الشريك الأكاديمي لمسابقة NTP 2026
                                        </span>
                                        <svg className="w-4 h-4 mr-3 text-blue-500 animate-pulse z-20 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="inline-flex items-center justify-center gap-4 mb-5 group">
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3">
                                    <div className="absolute inset-0 bg-blue-500/15 rounded-full blur-2xl"></div>
                                    <img src="/images/sanfoor.png" alt="Sanfoor" className="w-full h-full object-contain drop-shadow-xl relative z-10" />
                                </div>
                                <div className="flex flex-col text-right leading-none">
                                    <span className="text-2xl sm:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-l from-blue-600 from-[50%] to-slate-900 to-[50%] tracking-tight">سنفور</span>
                                    <span className="text-sm sm:text-base font-black bg-clip-text text-transparent bg-gradient-to-l from-blue-600 from-[50%] to-slate-900 to-[50%] tracking-[0.15em] uppercase">Sanfoor</span>
                                </div>
                            </div>
                        )}

                        <h1 className="text-xl sm:text-2xl font-black text-white mb-3">
                            {isGuest ? (
                                <span>أهلاً بك في منصة سنفور! <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-200">🎫</span></span>
                            ) : (
                                <>
                                    مرحباً بك يا{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-indigo-100">
                                        {(user.name || 'طالب').split(' ')[0]}
                                    </span>
                                    ! 👋
                                </>
                            )}
                        </h1>
                        <p className="text-sm sm:text-base font-bold text-white/80 max-w-md mx-auto leading-relaxed">
                            {isGuest 
                                ? 'لتبدأ تجربتك المخصصة، يرجى تحديد كليتك وتخصصك الجامعي وسنقوم بتجهيز النظام لك.'
                                : 'قبل ما تبدأ رحلتك الأكاديمية، نحتاج تحدد كليتك وتخصصك عشان نخصص التجربة إلك.'}
                        </p>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-3 sm:gap-6 mb-8" style={stagger(1)}>
                        {stepIndicator(1, 'الكلية', '🏛️')}
                        <div className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-500 ${step > 1 ? 'bg-emerald-400' : 'bg-white/20'}`}></div>
                        {stepIndicator(2, 'التخصص', '📚')}
                        <div className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-500 ${step > 2 ? 'bg-emerald-400' : 'bg-white/20'}`}></div>
                        {stepIndicator(3, 'الخطة', '🧭')}
                        <div className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-500 ${step > 3 ? 'bg-emerald-400' : 'bg-white/20'}`}></div>
                        {stepIndicator(4, 'تأكيد', '🚀')}
                    </div>

                    {/* Main Card */}
                    <div className="relative group/card" style={stagger(2)}>
                        {/* Glowing Outer Border */}
                        <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-emerald-500 via-sky-400 to-blue-600 opacity-0 group-hover/card:opacity-30 blur-lg transition-all duration-1000 animate-pulse-border pointer-events-none"></div>
                        <div className="relative bg-[#060c18]/80 backdrop-blur-2xl rounded-[2rem] border border-slate-700/50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] p-6 sm:p-8 animate-glow">
                        <form onSubmit={submit}>
                            {/* Step 1: College */}
                            {step === 1 && (
                                <div className="step-enter">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-lg shadow-lg shadow-blue-500/20">🏛️</div>
                                        <div>
                                            <h2 className="text-lg font-black text-white">اختر كليتك</h2>
                                            <p className="text-xs font-bold text-slate-400">حدد الكلية اللي إنت فيها</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(colleges || []).map((college) => (
                                            <button
                                                key={college.id}
                                                type="button"
                                                onClick={() => handleCollegeSelect(college.id)}
                                                className={`${cardBase} ${String(data.college_id) === String(college.id) ? cardSelected : cardDefault} text-right`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all ${
                                                        String(data.college_id) === String(college.id) ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800/80 text-slate-400 group-hover/item:text-emerald-400'
                                                    }`}>🏛️</div>
                                                    <span className="text-sm font-black text-slate-200 group-hover/item:text-white leading-snug transition-colors">{college.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {errors.college_id && <p className="text-xs font-bold text-rose-500 mt-3">{errors.college_id}</p>}
                                </div>
                            )}

                            {/* Step 2: Major */}
                            {step === 2 && (
                                <div className="step-enter">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-lg shadow-lg shadow-purple-500/20">📚</div>
                                            <div>
                                                <h2 className="text-lg font-black text-white">اختر تخصصك</h2>
                                                <p className="text-xs font-bold text-slate-400">
                                                    في كلية <span className="text-emerald-400">{selectedCollege?.name}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setStep(1)} className="text-xs font-black text-slate-400 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50">
                                            ← تغيير الكلية
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {filteredMajors.map((major) => (
                                            <button
                                                key={major.id}
                                                type="button"
                                                onClick={() => handleMajorSelect(major.id)}
                                                className={`${cardBase} ${String(data.major_id) === String(major.id) ? cardSelected : cardDefault} text-right`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 transition-all ${
                                                        String(data.major_id) === String(major.id) ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-slate-800/80 text-slate-400 group-hover/item:text-purple-400'
                                                    }`}>📚</div>
                                                    <span className="text-sm font-black text-slate-200 group-hover/item:text-white leading-snug transition-colors">{major.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {filteredMajors.length === 0 && (
                                        <div className="text-center py-10">
                                            <span className="text-4xl mb-3 block">🤷‍♂️</span>
                                            <p className="text-sm font-bold text-slate-400">لا توجد تخصصات مسجلة لهذه الكلية</p>
                                        </div>
                                    )}
                                    {errors.major_id && <p className="text-xs font-bold text-rose-500 mt-3">{errors.major_id}</p>}
                                </div>
                            )}

                            {/* Step 3: Study Plan */}
                            {step === 3 && (
                                <div className="step-enter">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-lg shadow-lg shadow-emerald-500/20">🧭</div>
                                            <div>
                                                <h2 className="text-lg font-black text-white">اختر خطتك الدراسية</h2>
                                                <p className="text-xs font-bold text-slate-400">حدد إصدار الخطة الشجرية</p>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setStep(2)} className="text-xs font-black text-slate-400 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50">
                                            ← تغيير التخصص
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <button
                                            type="button"
                                            onClick={() => handlePlanSelect('11')}
                                            className={`${cardBase} text-center ${data.study_plan_version === '11' ? cardSelected : cardDefault}`}
                                        >
                                            <div className="flex flex-col items-center gap-3 py-3">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${
                                                    data.study_plan_version === '11' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800/80 text-slate-400 group-hover/item:text-emerald-400'
                                                }`}>🌳</div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-200 group-hover/item:text-white transition-colors">الخطة 11</h3>
                                                    <p className="text-xs font-bold text-slate-500 mt-1">الخطة الشجرية الإصدار 11</p>
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePlanSelect('12')}
                                            className={`${cardBase} text-center ${data.study_plan_version === '12' ? cardSelected : cardDefault} relative`}
                                        >
                                            <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-[9px] font-black rounded-full shadow-sm">الأحدث ✨</span>
                                            <div className="flex flex-col items-center gap-3 py-3">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all ${
                                                    data.study_plan_version === '12' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800/80 text-slate-400 group-hover/item:text-emerald-400'
                                                }`}>🌲</div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-200 group-hover/item:text-white transition-colors">الخطة 12</h3>
                                                    <p className="text-xs font-bold text-slate-500 mt-1">الخطة الشجرية الإصدار 12</p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                    {errors.study_plan_version && <p className="text-xs font-bold text-rose-500 mt-3">{errors.study_plan_version}</p>}
                                </div>
                            )}

                            {/* Step 4: Confirmation */}
                            {step === 4 && (
                                <div className="step-enter">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg shadow-lg shadow-amber-500/20">🚀</div>
                                        <div>
                                            <h2 className="text-lg font-black text-white">تأكيد البيانات</h2>
                                            <p className="text-xs font-bold text-slate-400">تأكد من صحة اختياراتك قبل البدء</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">🏛️</span>
                                                <span className="text-xs font-black text-slate-400">الكلية</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-blue-400">{selectedCollege?.name || '—'}</span>
                                                <button type="button" onClick={() => setStep(1)} className="text-[10px] font-black text-blue-400 hover:text-blue-600 underline">تعديل</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">📚</span>
                                                <span className="text-xs font-black text-slate-400">التخصص</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-purple-400">{selectedMajor?.name || '—'}</span>
                                                <button type="button" onClick={() => setStep(2)} className="text-[10px] font-black text-purple-400 hover:text-purple-600 underline">تعديل</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">🧭</span>
                                                <span className="text-xs font-black text-slate-400">الخطة الدراسية</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-emerald-400">الإصدار {data.study_plan_version}</span>
                                                <button type="button" onClick={() => setStep(3)} className="text-[10px] font-black text-emerald-400 hover:text-emerald-600 underline">تعديل</button>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={processing || !data.college_id || !data.major_id || !data.study_plan_version}
                                        className="w-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-500 hover:to-blue-700 text-white py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg transition-all duration-300 shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98] disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-3 relative overflow-hidden group"
                                    >
                                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
                                        <span className="relative z-10 flex items-center gap-3">
                                            {processing ? (
                                                <>
                                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                                    جاري الحفظ...
                                                </>
                                            ) : (
                                                <>
                                                    إتمام وإعداد ملفي الأكاديمي 🚀
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                    </div>

                    {/* Logout link */}
                    <div className="text-center mt-6" style={stagger(3)}>
                        <a href={route('logout')} onClick={(e) => { e.preventDefault(); document.getElementById('logout-form').submit(); }} className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors">
                            تسجيل الخروج
                        </a>
                        <form id="logout-form" action={route('logout')} method="POST" className="hidden">
                            <input type="hidden" name="_token" value={document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')} />
                        </form>
                    </div>

                    {/* Bottom branding */}
                    <div className="text-center mt-4" style={stagger(4)}>
                        <p className="text-[10px] font-bold text-slate-400">
                            © {new Date().getFullYear()} سنفور • Sanfoor
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
