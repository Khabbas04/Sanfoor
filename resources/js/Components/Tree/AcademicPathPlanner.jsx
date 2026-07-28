import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import {
    ArrowLeft,
    BrainCircuit,
    Check,
    ChevronDown,
    ChevronUp,
    Gauge,
    GraduationCap,
    Route,
    ShieldCheck,
    Scale,
    TrendingUp,
    X,
} from 'lucide-react';
import axios from 'axios';
import { useMemo, useState } from 'react';

const goals = [
    {
        id: 'fastest_graduation',
        label: 'التخرج بأسرع وقت',
        description: 'أولوية للمواد التي تفتح أكبر جزء من المسار.',
        Icon: GraduationCap,
    },
    {
        id: 'improve_gpa',
        label: 'رفع المعدل',
        description: 'مسار أكثر أمانًا للمعدل ويقلل تجميع المواد الخطرة.',
        Icon: TrendingUp,
    },
    {
        id: 'reduce_pressure',
        label: 'تقليل الضغط الدراسي',
        description: 'حمل أخف وتوزيع المواد الصعبة على أكثر من فصل.',
        Icon: Gauge,
    },
    {
        id: 'balanced',
        label: 'موازنة المعدل وسرعة التخرج',
        description: 'توازن بين فتح المسار والمحافظة على حمل مناسب.',
        Icon: Scale,
    },
];

const priorityLabel = {
    critical: 'حرجة',
    high: 'عالية',
    normal: 'طبيعية',
};

function AnalysisState() {
    const stages = ['بناء المسار وفق قواعد الجامعة', 'إرسال الخطة الآمنة إلى AI', 'تحليل القرارات وشرحها', 'التحقق النهائي من النتيجة'];

    return (
        <div className="py-8 text-center" aria-live="polite" aria-busy="true">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200">
                <BrainCircuit className="h-7 w-7 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">الذكاء الاصطناعي يحلل مسارك</h3>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">ننشئ خطة آمنة ثم يفسّر AI أفضل القرارات لك.</p>
            <div className="mx-auto mt-6 max-w-sm space-y-2 text-right">
                {stages.map((stage, index) => (
                    <div key={stage} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-black text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">{index + 1}</span>
                        {stage}
                    </div>
                ))}
            </div>
        </div>
    );
}

function CourseCard({ course, index }) {
    const [expanded, setExpanded] = useState(false);
    const priorityClass = course.priority === 'critical'
        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        : course.priority === 'high'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{index + 1}</span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-black text-slate-900 dark:text-white">{course.name}</h4>
                        <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${priorityClass}`}>أولوية {priorityLabel[course.priority]}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-400" dir="ltr">{course.code} · {course.credit_hours} ساعات</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-600 dark:text-slate-300">{course.ai_explanation || course.reason}</p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300 dark:hover:bg-indigo-950"
                aria-expanded={expanded}
            >
                <span>لماذا اختيرت هذه المادة؟</span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {expanded && (
                <div className="mt-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    {course.ai_strategic_impact && (
                        <div className="mb-3 flex items-start gap-2 rounded-xl bg-violet-50 p-3 text-xs font-bold leading-6 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                            <BrainCircuit className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span><strong>تحليل AI:</strong> {course.ai_strategic_impact}</span>
                        </div>
                    )}
                    <ul className="space-y-2 text-xs font-bold leading-6 text-slate-600 dark:text-slate-300">
                        {course.reasons.map((reason) => (
                            <li key={reason} className="flex items-start gap-2">
                                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                {reason}
                            </li>
                        ))}
                    </ul>
                    {course.unlocks.direct_count > 0 && (
                        <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">
                            تفتح مباشرة: {course.unlocks.courses.map((item) => item.name).join('، ') || `${course.unlocks.direct_count} مواد`}
                        </p>
                    )}
                </div>
            )}
        </article>
    );
}

function ResultView({ path, onApply, applying, onRestart }) {
    const courses = path.current_semester?.courses || [];

    if (path.status === 'completed') {
        return (
            <div className="py-10 text-center">
                <ShieldCheck className="mx-auto h-14 w-14 text-emerald-600" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">خطتك الأكاديمية مكتملة</h3>
                <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-7 text-slate-600 dark:text-slate-300">{path.summary.message}</p>
            </div>
        );
    }

    if (path.status === 'blocked') {
        return (
            <div className="py-10 text-center">
                <ShieldCheck className="mx-auto h-14 w-14 text-amber-600" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-black text-slate-900 dark:text-white">تحتاج بيانات الخطة إلى مراجعة</h3>
                <p className="mx-auto mt-2 max-w-md text-sm font-bold leading-7 text-slate-600 dark:text-slate-300">{path.summary.message}</p>
                <button type="button" onClick={onRestart} className="mt-5 min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:text-slate-200">
                    تجربة هدف آخر
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {path.ai?.status === 'completed' ? (
                <section className="rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50 to-indigo-50 p-4 dark:border-violet-800 dark:from-violet-950/60 dark:to-indigo-950/50">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                            <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                            <p className="text-xs font-black text-violet-700 dark:text-violet-300">تحليل فعلي بواسطة Gemini AI</p>
                            <p className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                اكتمل خلال {(path.ai.duration_ms / 1000).toFixed(1)} ثانية · بعد التحقق من قواعد الجامعة
                            </p>
                        </div>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-7 text-slate-700 dark:text-slate-200">{path.ai.analysis}</p>
                    {path.ai.next_step && <p className="mt-2 text-xs font-black leading-6 text-violet-800 dark:text-violet-200">الخطوة التالية: {path.ai.next_step}</p>}
                </section>
            ) : path.ai?.status === 'fallback' ? (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    تعذّر اتصال AI حاليًا؛ عُرضت الخطة الآمنة من المحرك الأكاديمي دون الادعاء بأنها تحليل AI.
                </section>
            ) : null}

            <section className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-800 dark:bg-indigo-950/40">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 shrink-0 text-indigo-700 dark:text-indigo-300" aria-hidden="true" />
                    <div>
                        <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">تم التحقق من الخطة</p>
                        <h3 className="mt-0.5 font-black text-slate-900 dark:text-white">{path.goal.label}</h3>
                    </div>
                </div>
                <p className="mt-3 text-sm font-bold leading-7 text-slate-600 dark:text-slate-300">{path.summary.message}</p>
            </section>

            <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">اقتراح الفصل الحالي</p>
                        <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">أفضل مواد لهذا الفصل</h3>
                    </div>
                    <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {path.current_semester.total_hours} ساعة
                    </span>
                </div>
                <div className="space-y-3">
                    {courses.map((course, index) => <CourseCard key={course.id} course={course} index={index} />)}
                </div>
            </section>

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    ['مواد تُفتح', path.summary.unlocks_count],
                    ['أثر المسار', path.summary.path_unlocks_count],
                    ['الحمل', path.summary.workload_level],
                    ['الثقة', path.confidence.label],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-[10px] font-black text-slate-400">{label}</p>
                        <p className="mt-1 text-sm font-black text-slate-800 dark:text-white">{value}</p>
                    </div>
                ))}
            </section>

            {path.roadmap.length > 0 && (
                <section>
                    <div className="flex items-center gap-2">
                        <Route className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                        <h3 className="font-black text-slate-900 dark:text-white">Roadmap مختصر</h3>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">الفصول القادمة تقديرية وتتحدث مع تغيّر سجلك.</p>
                    <div className="mt-3 space-y-3">
                        {path.roadmap.map((semester) => (
                            <div key={semester.sequence} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex items-center justify-between gap-3">
                                    <h4 className="font-black text-slate-800 dark:text-white">{semester.label}</h4>
                                    <span className="text-xs font-black text-slate-400">{semester.total_hours} ساعة</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {semester.courses.map((course) => (
                                        <span key={course.id} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{course.name}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:static sm:mx-0 sm:flex-row sm:px-0 sm:pb-0">
                <button
                    type="button"
                    disabled={applying || courses.length === 0}
                    onClick={() => onApply(courses.map((course) => course.id))}
                    className="min-h-12 flex-1 rounded-xl bg-indigo-600 px-5 text-sm font-black text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {applying ? 'جارٍ تطبيق الخطة…' : 'استخدام مواد هذا الفصل'}
                </button>
                <button type="button" onClick={onRestart} className="min-h-12 rounded-xl px-5 text-sm font-black text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800">
                    التحليل بهدف مختلف
                </button>
            </div>
        </div>
    );
}

export default function AcademicPathPlanner({ onApply }) {
    const [open, setOpen] = useState(false);
    const [goal, setGoal] = useState('balanced');
    const [state, setState] = useState('goal');
    const [path, setPath] = useState(null);
    const [error, setError] = useState('');
    const [applying, setApplying] = useState(false);

    const selectedGoal = useMemo(() => goals.find((item) => item.id === goal), [goal]);

    const close = () => {
        if (state !== 'analyzing') setOpen(false);
    };

    const analyze = async () => {
        setState('analyzing');
        setError('');
        try {
            const response = await axios.post(route('academic-path-planner.generate'), { goal });
            setPath(response.data.path);
            setState('result');
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'تعذر بناء خطتك الآن. حاول مرة أخرى.');
            setState('goal');
        }
    };

    const apply = async (ids) => {
        setApplying(true);
        try {
            const applied = await onApply(ids);
            if (applied) setOpen(false);
        } finally {
            setApplying(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="group w-full rounded-[1.25rem] border border-indigo-200 bg-white p-4 text-right shadow-sm transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:bg-slate-900"
            >
                <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-200">
                        <Route className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-slate-900 dark:text-white">خطتي الذكية</span>
                        <span className="mt-1 block text-[11px] font-bold leading-5 text-slate-500 dark:text-slate-400">أفضل مسار لك حتى التخرج حسب هدفك.</span>
                    </span>
                    <ArrowLeft className="h-5 w-5 text-indigo-500 transition group-hover:-translate-x-1 rtl:rotate-0" aria-hidden="true" />
                </div>
            </button>

            <Transition show={open}>
                <Dialog onClose={close} className="relative z-[100]">
                    <TransitionChild enter="duration-200 ease-out" enterFrom="opacity-0" enterTo="opacity-100" leave="duration-150 ease-in" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-slate-950/60" aria-hidden="true" />
                    </TransitionChild>
                    <div className="fixed inset-0 flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
                        <TransitionChild enter="duration-250 ease-out" enterFrom="translate-y-full opacity-0 sm:translate-y-5 sm:scale-95" enterTo="translate-y-0 opacity-100 sm:scale-100" leave="duration-150 ease-in" leaveFrom="translate-y-0 opacity-100 sm:scale-100" leaveTo="translate-y-full opacity-0 sm:translate-y-5 sm:scale-95">
                            <DialogPanel className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[1.75rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-3xl sm:rounded-[1.75rem] sm:p-6" dir="rtl">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                                            {state === 'result' ? 'نتيجة التحليل' : state === 'analyzing' ? 'الخطوة 2 من 2' : 'الخطوة 1 من 2'}
                                        </p>
                                        <DialogTitle className="mt-1 text-xl font-black text-slate-900 dark:text-white">خطتي الذكية</DialogTitle>
                                    </div>
                                    <button type="button" onClick={close} disabled={state === 'analyzing'} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 dark:hover:bg-slate-800" aria-label="إغلاق خطتي الذكية">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                {state === 'analyzing' && <AnalysisState />}

                                {state === 'goal' && (
                                    <div className="mt-6">
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white">ما هو هدفك؟</h3>
                                        <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">اختر هدفًا واحدًا وسنتولى بقية التحليل.</p>
                                        <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="هدف الخطة الأكاديمية">
                                            {goals.map(({ id, label, description, Icon }) => {
                                                const selected = goal === id;
                                                return (
                                                    <button
                                                        key={id}
                                                        type="button"
                                                        role="radio"
                                                        aria-checked={selected}
                                                        onClick={() => setGoal(id)}
                                                        className={`min-h-[92px] rounded-2xl border p-4 text-right transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${selected ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 dark:bg-indigo-950/50' : 'border-slate-200 hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-700'}`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-400'}`} aria-hidden="true" />
                                                            <span>
                                                                <span className="block text-sm font-black text-slate-900 dark:text-white">{label}</span>
                                                                <span className="mt-1 block text-xs font-bold leading-5 text-slate-500 dark:text-slate-400">{description}</span>
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{error}</p>}
                                        <button type="button" onClick={analyze} className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 px-5 text-sm font-black text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                                            ابدأ التحليل — {selectedGoal.label}
                                        </button>
                                    </div>
                                )}

                                {state === 'result' && path && (
                                    <div className="mt-6">
                                        <ResultView path={path} onApply={apply} applying={applying} onRestart={() => setState('goal')} />
                                    </div>
                                )}
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
}
