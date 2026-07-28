import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { AlertTriangle, BookOpen, CheckCircle2, GraduationCap, Info, Route, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { csrfHeaders } from '@/utils/csrf';

const visualByType = {
    critical_course: { Icon: Route, tone: 'blue' },
    risky_cart: { Icon: AlertTriangle, tone: 'amber' },
    graduation_risk: { Icon: GraduationCap, tone: 'amber' },
    gpa_opportunity: { Icon: BookOpen, tone: 'blue' },
    missing_data: { Icon: Info, tone: 'amber' },
    positive_status: { Icon: CheckCircle2, tone: 'emerald' },
};

const tones = {
    blue: {
        shell: 'border-blue-200/80 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/35',
        icon: 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
        label: 'text-blue-700 dark:text-blue-300',
        button: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500',
        dot: 'bg-blue-500',
    },
    amber: {
        shell: 'border-amber-200/90 bg-amber-50/65 dark:border-amber-800 dark:bg-amber-950/30',
        icon: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
        label: 'text-amber-700 dark:text-amber-300',
        button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
        dot: 'bg-amber-500',
    },
    emerald: {
        shell: 'border-emerald-200/90 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30',
        icon: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
        label: 'text-emerald-700 dark:text-emerald-300',
        button: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500',
        dot: 'bg-emerald-500',
    },
};

function requestPayload(insight) {
    return {
        fingerprint: insight.fingerprint,
        type: insight.type,
        priority: insight.priority,
        version: insight.version,
    };
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('request_failed');
    return response.json();
}

export default function AcademicInsightCard({ initialInsight }) {
    const [insight, setInsight] = useState(initialInsight);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(Boolean(initialInsight?.dismissed));
    const [requestError, setRequestError] = useState(false);

    useEffect(() => {
        setInsight(initialInsight);
        setDismissed(Boolean(initialInsight?.dismissed));
    }, [initialInsight]);

    const track = useCallback((event, current = insight) => {
        if (!current?.fingerprint) return;
        postJson(route('dashboard.academic-insight.track'), { ...requestPayload(current), event }).catch(() => {});
    }, [insight]);

    useEffect(() => {
        if (insight?.state === 'success' || insight?.state === 'missing_data') {
            track('insight_viewed', insight);
        }
    }, [insight?.fingerprint]); // One view event per rendered recommendation.

    const visual = useMemo(() => visualByType[insight?.type] || visualByType.positive_status, [insight?.type]);
    const tone = tones[visual.tone];
    const Icon = visual.Icon;

    const refresh = async () => {
        setLoading(true);
        setRequestError(false);
        try {
            const data = await postJson(route('dashboard.academic-insight.refresh'), {});
            setInsight(data.insight);
            setDismissed(Boolean(data.insight?.dismissed));
        } catch {
            setRequestError(true);
        } finally {
            setLoading(false);
        }
    };

    const dismiss = async () => {
        if (!insight?.fingerprint) return;
        setLoading(true);
        try {
            await postJson(route('dashboard.academic-insight.dismiss'), requestPayload(insight));
            setDismissed(true);
        } catch {
            setRequestError(true);
        } finally {
            setLoading(false);
        }
    };

    const openDetails = () => {
        setDetailsOpen(true);
        track('insight_details_opened');
    };

    const followAction = () => {
        track('insight_action_clicked');
        window.location.assign(insight.action.url);
    };

    if (dismissed) return null;

    if (loading && !insight) {
        return <AcademicInsightSkeleton />;
    }

    if (requestError || insight?.state === 'error') {
        return (
            <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-live="polite">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-xs font-extrabold text-slate-500 dark:text-slate-400">أهم قرار لك الآن</p>
                        <h2 className="mt-1 text-base font-black text-slate-800 dark:text-white">تعذر تحديث اقتراحك الآن</h2>
                    </div>
                    <button type="button" onClick={refresh} disabled={loading} className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
                        {loading ? 'جارٍ التحديث…' : 'إعادة المحاولة'}
                    </button>
                </div>
            </section>
        );
    }

    if (!insight) return <AcademicInsightSkeleton />;

    return (
        <>
            <section className={`relative overflow-hidden rounded-[1.6rem] border p-5 shadow-sm sm:p-6 ${tone.shell}`} aria-labelledby="academic-insight-title">
                {insight.expires_at && new Date(insight.expires_at).getTime() < Date.now() && (
                    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300" role="status">
                        <span>هذا الاقتراح يحتاج تحديثًا بعد تغيّر بياناتك.</span>
                        <button type="button" onClick={refresh} className="min-h-10 shrink-0 rounded-lg px-3 text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-950">تحديث</button>
                    </div>
                )}

                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${tone.icon}`} aria-hidden="true">
                            <Icon className="h-6 w-6" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                            <p className={`text-[11px] font-black tracking-wide ${tone.label}`}>أهم قرار لك الآن</p>
                            <h2 id="academic-insight-title" className="mt-1 text-lg font-black leading-snug text-slate-900 dark:text-white sm:text-xl">
                                {insight.recommendation}
                            </h2>
                            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-600 dark:text-slate-300">
                                {insight.summary}
                            </p>
                            {Array.isArray(insight.reasons) && insight.reasons.length > 0 && (
                                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {insight.reasons.slice(0, 3).map((reason) => (
                                        <li key={reason} className="flex items-center gap-2">
                                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
                                            {reason}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
                        {insight.action?.url && (
                            <button type="button" onClick={followAction} className={`min-h-11 rounded-xl px-5 text-sm font-black text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${tone.button}`}>
                                {insight.action.label}
                            </button>
                        )}
                        {insight.secondary_action?.type === 'dismiss' && (
                            <button type="button" onClick={dismiss} disabled={loading} className="min-h-11 rounded-xl px-4 text-sm font-black text-slate-600 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800">
                                ليس الآن
                            </button>
                        )}
                    </div>
                </div>

                <button type="button" onClick={openDetails} className="mt-4 min-h-11 rounded-lg px-1 text-xs font-black text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:text-white" aria-haspopup="dialog">
                    لماذا ظهر هذا الاقتراح؟
                </button>
            </section>

            <Transition show={detailsOpen}>
                <Dialog onClose={setDetailsOpen} className="relative z-50">
                    <TransitionChild enter="duration-200 ease-out" enterFrom="opacity-0" enterTo="opacity-100" leave="duration-150 ease-in" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-slate-950/55" aria-hidden="true" />
                    </TransitionChild>
                    <div className="fixed inset-0 flex items-end justify-center overflow-y-auto sm:items-center sm:p-4">
                        <TransitionChild enter="duration-200 ease-out" enterFrom="translate-y-full opacity-0 sm:translate-y-4 sm:scale-95" enterTo="translate-y-0 opacity-100 sm:scale-100" leave="duration-150 ease-in" leaveFrom="translate-y-0 opacity-100 sm:scale-100" leaveTo="translate-y-full opacity-0 sm:translate-y-4 sm:scale-95">
                            <DialogPanel className="w-full rounded-t-[1.75rem] bg-white p-5 shadow-2xl dark:bg-slate-900 sm:max-w-lg sm:rounded-[1.5rem] sm:p-6" dir="rtl">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className={`text-xs font-black ${tone.label}`}>تفاصيل القرار</p>
                                        <DialogTitle className="mt-1 text-lg font-black text-slate-900 dark:text-white">{insight.recommendation}</DialogTitle>
                                    </div>
                                    <button type="button" onClick={() => setDetailsOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800" aria-label="إغلاق التفاصيل">
                                        <X className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </div>

                                <div className="mt-5 space-y-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white">بُني الاقتراح على</h3>
                                        <p className="mt-1 leading-7">{insight.confidence?.based_on?.join('، ')}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 dark:text-white">طبيعة النتيجة</h3>
                                        <p className="mt-1 leading-7">
                                            {insight.fact_type === 'prediction'
                                                ? 'هذا توقع مبني على بيانات خطتك الحالية، وليس نتيجة قطعية.'
                                                : insight.fact_type === 'recommendation'
                                                    ? 'هذه توصية محسوبة، ويعود القرار النهائي لك.'
                                                    : 'هذه نتيجة مبنية على قواعد وبيانات أكاديمية مسجلة.'}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-xs dark:border-slate-700">
                                        <span>الثقة: {insight.confidence?.label || 'متوسطة'}</span>
                                        <span>آخر تحديث: {new Date(insight.generated_at).toLocaleString('ar-JO', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </div>
                                    <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        القرار النهائي لك، ويمكنك مراجعة المرشد الأكاديمي عند الحاجة.
                                    </p>
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
}

export function AcademicInsightSkeleton() {
    return (
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6" aria-label="جارٍ تجهيز الاقتراح الأكاديمي" aria-busy="true">
            <div className="animate-pulse flex items-start gap-4 motion-reduce:animate-none">
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-3">
                    <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-3 w-full max-w-xl rounded bg-slate-100 dark:bg-slate-800" />
                </div>
            </div>
        </section>
    );
}
