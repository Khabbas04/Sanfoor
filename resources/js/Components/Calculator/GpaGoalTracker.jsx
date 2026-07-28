import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Target, TrendingUp } from 'lucide-react';
import { calculateGoalProjection } from '@/Utils/gpaCalculations';

const Field = ({ label, value, onChange, min = 0, max = 100, suffix = '%' }) => (
    <label className="block">
        <span className="mb-2 block text-xs font-black text-slate-600 dark:text-slate-300">{label}</span>
        <span className="relative block">
            <input
                type="number"
                min={min}
                max={max}
                step="0.1"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pl-12 text-base font-black text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{suffix}</span>
        </span>
    </label>
);

export default function GpaGoalTracker({ realGpa, realCompletedHours }) {
    const defaults = {
        currentGpa: Number(realGpa || 0).toFixed(2),
        completedHours: Number(realCompletedHours || 0),
        targetGpa: Math.min(100, Math.max(60, Math.ceil(Number(realGpa || 70) + 5))),
        plannedHours: 15,
        expectedSemesterGpa: 80,
    };
    const [values, setValues] = useState(defaults);
    const update = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));
    const result = useMemo(() => calculateGoalProjection(values), [values]);
    const statusTone = result.status === 'impossible'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
        : result.status === 'hard'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-black text-indigo-600 dark:text-indigo-300">محاكاة فورية — لا تغيّر سجلك</p>
                        <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">حدد هدف معدلك</h2>
                        <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">استخدمنا بياناتك الحقيقية، ويمكنك تعديلها للمحاكاة فقط.</p>
                    </div>
                    <button type="button" onClick={() => setValues(defaults)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-black text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800">
                        <RotateCcw className="h-4 w-4" /> إعادة
                    </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="المعدل التراكمي الحالي" value={values.currentGpa} onChange={update('currentGpa')} />
                    <Field label="الساعات المنجزة" value={values.completedHours} onChange={update('completedHours')} min={0} max={250} suffix="ساعة" />
                    <Field label="المعدل المستهدف" value={values.targetGpa} onChange={update('targetGpa')} />
                    <Field label="ساعات الفصل القادم" value={values.plannedHours} onChange={update('plannedHours')} min={1} max={21} suffix="ساعة" />
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl bg-gradient-to-bl from-indigo-600 to-violet-700 p-6 text-white shadow-lg md:col-span-1">
                    <TrendingUp className="h-6 w-6 text-indigo-200" />
                    <p className="mt-5 text-xs font-black text-indigo-200">معدلك المتوقع بعد الفصل</p>
                    <p className="mt-1 text-5xl font-black tabular-nums">{result.expectedCumulativeGpa.toFixed(2)}<span className="text-lg">%</span></p>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
                        <div className="h-full rounded-full bg-white transition-[width] duration-300" style={{ width: `${result.progressPercentage}%` }} />
                    </div>
                    <p className="mt-2 text-xs font-bold text-indigo-100">{result.progressPercentage.toFixed(0)}% من الطريق بين معدلك الحالي والهدف</p>
                </div>

                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    {[
                        ['المتبقي للهدف', `${result.remainingDifference.toFixed(2)}%`],
                        ['المعدل الفصلي المطلوب', result.requiredSemesterGpa > 100 ? 'أكثر من 100%' : `${Math.max(0, result.requiredSemesterGpa).toFixed(2)}%`],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-black text-slate-400">{label}</p>
                            <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{value}</p>
                        </div>
                    ))}
                    <div className={`col-span-2 rounded-2xl border p-4 ${statusTone}`}>
                        <div className="flex items-center gap-2 font-black">
                            {result.status === 'impossible' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                            حالة الهدف: {result.statusLabel}
                        </div>
                        <p className="mt-2 text-sm font-bold leading-6">{result.recommendation}</p>
                    </div>
                </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-7">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"><Target className="h-5 w-5" /></span>
                    <div><h3 className="font-black text-slate-900 dark:text-white">ماذا لو؟</h3><p className="text-xs font-bold text-slate-500 dark:text-slate-400">غيّر معدلك الفصلي المتوقع وشاهد النتيجة مباشرة.</p></div>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input type="range" min="50" max="100" step="1" value={values.expectedSemesterGpa} onChange={(event) => update('expectedSemesterGpa')(event.target.value)} className="h-2 flex-1 cursor-pointer accent-indigo-600" aria-label="المعدل الفصلي المتوقع" />
                    <div className="min-w-28 rounded-xl bg-slate-100 px-4 py-3 text-center text-lg font-black tabular-nums text-indigo-700 dark:bg-slate-800 dark:text-indigo-300">{values.expectedSemesterGpa}%</div>
                </div>
            </section>
        </div>
    );
}
