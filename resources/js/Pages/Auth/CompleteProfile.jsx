import { useEffect, useState, useMemo } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import Swal from 'sweetalert2';
import confetti from 'canvas-confetti';

export default function CompleteProfile({ colleges, majors, isNewUser }) {
    const { auth } = usePage().props;
    const user = auth?.user || {};

    const { data, setData, post, processing, errors } = useForm({
        college_id: '',
        major_id: '',
        study_plan_version: '12',
    });

    const [mounted, setMounted] = useState(false);
    const [step, setStep] = useState(1); // 1=college, 2=major, 3=plan, 4=confirm

    useEffect(() => {
        setTimeout(() => setMounted(true), 100);

        if (isNewUser) {
            // Trigger confetti
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#3b82f6', '#10b981', '#8b5cf6']
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#3b82f6', '#10b981', '#8b5cf6']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();

            // Play sound
            try {
                const audio = new Audio('/sounds/notification.wav');
                audio.volume = 0.5;
                audio.play().catch(() => {});
            } catch (e) { }

            // Show SweetAlert
            Swal.fire({
                title: 'مرحباً بك في سنفور! 🎉',
                html: '<b>سعداء بانضمامك لمنصتنا!</b><br/><br/>خطوة واحدة بس بتفصلك عن كل الميزات.. حدد كليتك وتخصصك عشان نخصص تجربتك.',
                icon: 'success',
                confirmButtonText: 'يلا نبدأ 🚀',
                confirmButtonColor: '#3b82f6',
                background: '#ffffff',
                backdrop: `rgba(15, 23, 42, 0.7)`,
                customClass: {
                    popup: 'rounded-3xl border border-blue-100 shadow-2xl',
                    title: 'text-2xl font-black text-slate-800',
                    htmlContainer: 'text-slate-600 font-bold',
                    confirmButton: 'rounded-xl font-black px-8 py-3 w-full shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]',
                }
            });
        }
    }, [isNewUser]);

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
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl transition-all duration-500 shadow-sm ${
                    isCompleted
                        ? 'bg-emerald-500 text-white shadow-emerald-500/30 scale-100'
                        : isActive
                            ? 'bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-blue-500/40 scale-110'
                            : 'bg-slate-100 text-slate-400 scale-95'
                }`}>
                    {isCompleted ? '✓' : icon}
                </div>
                <span className={`text-[10px] sm:text-[11px] font-black tracking-tight transition-all duration-300 ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                }`}>{label}</span>
            </div>
        );
    };

    const cardBase = "p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]";
    const cardSelected = "border-blue-400 bg-blue-50/80 shadow-lg shadow-blue-500/10 ring-2 ring-blue-400/20";
    const cardDefault = "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:bg-blue-50/30";

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
            ` }} />

            <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-indigo-50/30 flex items-center justify-center px-4 py-8 relative overflow-hidden">
                {/* Floating background particles */}
                <div className="absolute top-20 right-20 w-32 h-32 rounded-full bg-blue-400/10 blur-3xl animate-float pointer-events-none"></div>
                <div className="absolute bottom-32 left-16 w-40 h-40 rounded-full bg-indigo-400/10 blur-3xl animate-float pointer-events-none" style={{animationDelay: '2s'}}></div>
                <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-sky-300/5 blur-3xl pointer-events-none"></div>

                <div className="w-full max-w-2xl relative z-10">
                    {/* Logo + Welcome */}
                    <div className="text-center mb-8" style={stagger(0)}>
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
                        <h1 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">
                            مرحباً بك يا{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                {(user.name || 'طالب').split(' ')[0]}
                            </span>
                            ! 👋
                        </h1>
                        <p className="text-sm sm:text-base font-bold text-slate-500 max-w-md mx-auto leading-relaxed">
                            قبل ما تبدأ رحلتك الأكاديمية، نحتاج تحدد كليتك وتخصصك عشان نخصص التجربة إلك.
                        </p>
                    </div>

                    {/* Step Indicator */}
                    <div className="flex items-center justify-center gap-3 sm:gap-6 mb-8" style={stagger(1)}>
                        {stepIndicator(1, 'الكلية', '🏛️')}
                        <div className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-500 ${step > 1 ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
                        {stepIndicator(2, 'التخصص', '📚')}
                        <div className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-500 ${step > 2 ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
                        {stepIndicator(3, 'الخطة', '🧭')}
                        <div className={`h-0.5 w-8 sm:w-12 rounded-full transition-all duration-500 ${step > 3 ? 'bg-emerald-400' : 'bg-slate-200'}`}></div>
                        {stepIndicator(4, 'تأكيد', '🚀')}
                    </div>

                    {/* Main Card */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-6 sm:p-8 animate-glow" style={stagger(2)}>
                        <form onSubmit={submit}>
                            {/* Step 1: College */}
                            {step === 1 && (
                                <div className="step-enter">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white text-lg shadow-lg shadow-blue-500/20">🏛️</div>
                                        <div>
                                            <h2 className="text-lg font-black text-slate-800">اختر كليتك</h2>
                                            <p className="text-xs font-bold text-slate-500">حدد الكلية اللي إنت فيها</p>
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
                                                        String(data.college_id) === String(college.id) ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>🏛️</div>
                                                    <span className="text-sm font-black text-slate-700 leading-snug">{college.name}</span>
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
                                                <h2 className="text-lg font-black text-slate-800">اختر تخصصك</h2>
                                                <p className="text-xs font-bold text-slate-500">
                                                    في كلية <span className="text-blue-600">{selectedCollege?.name}</span>
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
                                                        String(data.major_id) === String(major.id) ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>📚</div>
                                                    <span className="text-sm font-black text-slate-700 leading-snug">{major.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {filteredMajors.length === 0 && (
                                        <div className="text-center py-10">
                                            <span className="text-4xl mb-3 block">🤷‍♂️</span>
                                            <p className="text-sm font-bold text-slate-500">لا توجد تخصصات مسجلة لهذه الكلية</p>
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
                                                <h2 className="text-lg font-black text-slate-800">اختر خطتك الدراسية</h2>
                                                <p className="text-xs font-bold text-slate-500">حدد إصدار الخطة الشجرية</p>
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
                                                    data.study_plan_version === '11' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>🌳</div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-800">الخطة 11</h3>
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
                                                    data.study_plan_version === '12' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                                                }`}>🌲</div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-800">الخطة 12</h3>
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
                                            <h2 className="text-lg font-black text-slate-800">تأكيد البيانات</h2>
                                            <p className="text-xs font-bold text-slate-500">تأكد من صحة اختياراتك قبل البدء</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/80 border border-blue-100">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">🏛️</span>
                                                <span className="text-xs font-black text-slate-600">الكلية</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-blue-700">{selectedCollege?.name || '—'}</span>
                                                <button type="button" onClick={() => setStep(1)} className="text-[10px] font-black text-blue-400 hover:text-blue-600 underline">تعديل</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50/80 border border-purple-100">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">📚</span>
                                                <span className="text-xs font-black text-slate-600">التخصص</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-purple-700">{selectedMajor?.name || '—'}</span>
                                                <button type="button" onClick={() => setStep(2)} className="text-[10px] font-black text-purple-400 hover:text-purple-600 underline">تعديل</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50/80 border border-emerald-100">
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">🧭</span>
                                                <span className="text-xs font-black text-slate-600">الخطة الدراسية</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-emerald-700">الإصدار {data.study_plan_version}</span>
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
                                                    🚀 ابدأ رحلتك الأكاديمية
                                                </>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </form>
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
