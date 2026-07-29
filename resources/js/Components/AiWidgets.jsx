import React, { useState } from 'react';

/**
 * The additional advisor widgets, kept out of Advisor.jsx so the page keeps its
 * existing shape and the diff there stays small.
 *
 * These arrive in the reply's `widgets` array, which is additive: the legacy
 * `interactive_widget` is still rendered first by the page, and an older reply
 * that carries no `widgets` simply renders nothing extra.
 *
 * Anything unknown is skipped rather than guessed at, so a widget type added on
 * the server later cannot break a client that has not shipped yet.
 */

/**
 * Tailwind scans source for literal class names, so every colour variant has to
 * appear in full here — an interpolated `text-${tone}-600` is purged from the
 * production build and renders unstyled.
 */
const TONE = {
    slate: { text: 'text-slate-600', chip: 'border-slate-200 bg-slate-50 text-slate-700', tile: 'border-slate-100 bg-slate-50/60', value: 'text-slate-700' },
    blue: { text: 'text-blue-600', chip: 'border-blue-200 bg-blue-50 text-blue-700', tile: 'border-blue-100 bg-blue-50/60', value: 'text-blue-700' },
    emerald: { text: 'text-emerald-600', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', tile: 'border-emerald-100 bg-emerald-50/60', value: 'text-emerald-700' },
    amber: { text: 'text-amber-600', chip: 'border-amber-200 bg-amber-50 text-amber-700', tile: 'border-amber-100 bg-amber-50/60', value: 'text-amber-700' },
    rose: { text: 'text-rose-600', chip: 'border-rose-200 bg-rose-50 text-rose-700', tile: 'border-rose-100 bg-rose-50/60', value: 'text-rose-700' },
    red: { text: 'text-red-600', chip: 'border-red-200 bg-red-50 text-red-700', tile: 'border-red-100 bg-red-50/60', value: 'text-red-700' },
    violet: { text: 'text-violet-600', chip: 'border-violet-200 bg-violet-50 text-violet-700', tile: 'border-violet-100 bg-violet-50/60', value: 'text-violet-700' },
    teal: { text: 'text-teal-600', chip: 'border-teal-200 bg-teal-50 text-teal-700', tile: 'border-teal-100 bg-teal-50/60', value: 'text-teal-700' },
};

const tone = (name) => TONE[name] || TONE.slate;

const DIFF_TONE = (d) => (d <= 2 ? 'emerald' : d <= 3 ? 'amber' : 'red');

const Panel = ({ label, tone: toneName = 'slate', children }) => (
    <div className="sfr-attach sfr-fade-up">
        {label && <p className={`sfr-attach__label ${tone(toneName).text}`}>{label}</p>}
        {children}
    </div>
);

const Chip = ({ children, tone: toneName = 'slate' }) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone(toneName).chip}`}>
        {children}
    </span>
);

/* ── course_card ─────────────────────────────────────────────────────────── */

const STATE_LABEL = {
    passed: ['✅ أنجزتها', 'emerald'],
    in_cart: ['🛒 في تسجيلك', 'blue'],
    open: ['🔓 متاحة لك', 'emerald'],
    locked: ['🔒 مغلقة حالياً', 'rose'],
};

const CourseCardWidget = ({ widget, onAction }) => {
    const [stateLabel, stateTone] = STATE_LABEL[widget.state] || STATE_LABEL.locked;

    return (
        <Panel label="📘 بطاقة المادة" tone="blue">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[12.5px] font-black text-slate-800">{widget.name}</h4>
                    <Chip tone={stateTone}>{stateLabel}</Chip>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip>⏱️ {widget.credit_hours} ساعات</Chip>
                    <Chip tone={DIFF_TONE(widget.difficulty)}>📊 صعوبة {widget.difficulty}/5</Chip>
                    {widget.unlocks?.length > 0 && <Chip tone="violet">🔑 تفتح {widget.unlocks.length}</Chip>}
                </div>

                {widget.missing_prerequisites?.length > 0 && (
                    <p className="mt-2 text-[11px] font-bold leading-relaxed text-rose-600">
                        ⚠️ ينقصك: {widget.missing_prerequisites.join('، ')}
                    </p>
                )}
                {widget.minimum_passed_hours > 0 && (
                    <p className="mt-1 text-[11px] font-bold text-amber-600">
                        🕒 تحتاج {widget.minimum_passed_hours} ساعة منجزة لفتحها
                    </p>
                )}
                {widget.prerequisites?.length > 0 && (
                    <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-500">
                        يسبقها: {widget.prerequisites.join('، ')}
                    </p>
                )}
                {widget.unlocks?.length > 0 && (
                    <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">
                        تفتح لك: {widget.unlocks.join('، ')}
                    </p>
                )}

                <button
                    type="button"
                    onClick={() => onAction?.({ action: 'open_course_in_tree', course_id: widget.course_id })}
                    className="mt-3 min-h-[44px] w-full rounded-xl border border-blue-200 bg-blue-50 px-3 text-[11.5px] font-black text-blue-700 transition-colors hover:bg-blue-100 active:scale-[0.99]"
                >
                    🌳 اعرضها في شجرة المواد
                </button>
            </div>
        </Panel>
    );
};

/* ── gpa_goal ────────────────────────────────────────────────────────────── */

const GpaGoalWidget = ({ widget, renderChart }) => (
    <Panel label="🎯 هدف المعدل" tone="violet">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    ['معدلك الآن', `${widget.current_gpa ?? '—'}٪`, 'slate'],
                    ['هدفك', `${widget.target_gpa ?? '—'}٪`, 'violet'],
                    ['ساعات الفصل', widget.planned_hours, 'blue'],
                    ['المطلوب هذا الفصل', widget.required_term_average != null ? `${widget.required_term_average}٪` : '—', widget.reachable ? 'emerald' : 'rose'],
                ].map(([caption, value, toneName]) => (
                    <div key={caption} className={`rounded-lg border p-2 text-center ${tone(toneName).tile}`}>
                        <p className="text-[9px] font-black text-slate-500">{caption}</p>
                        <p className={`text-[13px] font-black ${tone(toneName).value}`}>{value}</p>
                    </div>
                ))}
            </div>

            {!widget.reachable && widget.max_possible != null && (
                <p className="mt-2 rounded-lg bg-rose-50 p-2 text-[11px] font-bold leading-relaxed text-rose-700">
                    ⚠️ هذا الهدف غير قابل للتحقيق بفصل واحد — أقصى ما يمكن الوصول إليه هو {widget.max_possible}٪.
                    يحتاج الأمر أكثر من فصل.
                </p>
            )}

            {widget.forecast && renderChart?.(widget.forecast)}
        </div>
    </Panel>
);

/* ── semester_plan ───────────────────────────────────────────────────────── */

const SemesterPlanWidget = ({ widget, onAction, actionState }) => {
    const [confirming, setConfirming] = useState(false);
    const busy = actionState?.pending;
    const done = actionState?.done;

    return (
        <Panel label="🗂️ خطة الفصل المقترحة" tone="blue">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[12.5px] font-black text-slate-800">{widget.title}</h4>
                    <Chip tone={widget.total_hours > widget.hour_limit ? 'rose' : 'emerald'}>
                        {widget.total_hours} / {widget.hour_limit} ساعة
                    </Chip>
                </div>

                {/* The split matters: a student with courses already registered needs
                    to see that the total includes them, not just the proposal. */}
                {widget.cart_hours > 0 && (
                    <p className="mt-1 text-[10px] font-bold text-slate-500">
                        عندك {widget.cart_hours} ساعة مسجّلة + {widget.proposed_hours} ساعة مقترحة
                    </p>
                )}

                <div className="mt-2 space-y-1.5">
                    {widget.courses?.map((course) => (
                        <div key={course.course_id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                            <div className="min-w-0">
                                <p className="truncate text-[11.5px] font-black text-slate-800">{course.name}</p>
                                {/* Why this course and not another one. Shown, not hidden
                                    behind a tap: a list the student cannot compare is a
                                    list they have to take on trust. */}
                                {course.advantages?.length > 0 ? (
                                    <ul className="mt-1 space-y-0.5">
                                        {course.advantages.map((advantage) => (
                                            <li key={advantage.key} className="flex items-start gap-1 text-[10px] font-bold leading-relaxed text-slate-500">
                                                <span className="shrink-0">{advantage.icon}</span>
                                                <span>{advantage.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    course.reason && <p className="mt-0.5 text-[10px] font-bold leading-relaxed text-slate-500">{course.reason}</p>
                                )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                                <Chip>{course.credit_hours}س</Chip>
                                <Chip tone={DIFF_TONE(course.difficulty)}>{course.difficulty}/5</Chip>
                            </div>
                        </div>
                    ))}
                </div>

                {widget.summary && <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-500">{widget.summary}</p>}

                {/* Nothing is written until the student confirms here. */}
                {done ? (
                    <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-[11.5px] font-black text-emerald-700">{done}</p>
                ) : confirming ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                        <p className="text-[11.5px] font-black leading-relaxed text-amber-800">
                            سيتم إضافة {widget.courses?.length} مواد ({widget.proposed_hours ?? widget.total_hours} ساعة)
                            إلى تسجيلك التجريبي، ليصبح المجموع {widget.total_hours} من {widget.hour_limit} ساعة. متأكد؟
                        </p>
                        <div className="mt-2 flex gap-2">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => onAction?.(widget.apply_action)}
                                className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 px-3 text-[11.5px] font-black text-white disabled:opacity-50"
                            >
                                {busy ? '...جاري التنفيذ' : '✅ نعم، طبّقها'}
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirming(false)}
                                className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-[11.5px] font-black text-slate-600"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="mt-3 min-h-[44px] w-full rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 px-3 text-[11.5px] font-black text-white shadow-sm active:scale-[0.99]"
                    >
                        🛒 طبّق هذه الخطة على تسجيلي
                    </button>
                )}

                {actionState?.error && (
                    <p className="mt-2 rounded-lg bg-rose-50 p-2 text-[11px] font-bold leading-relaxed text-rose-700">{actionState.error}</p>
                )}
            </div>
        </Panel>
    );
};

/* ── graduation_roadmap ──────────────────────────────────────────────────── */

const GraduationRoadmapWidget = ({ widget }) => (
    <Panel label="🎓 مسارك حتى التخرج" tone="violet">
        <div className="overflow-x-auto">
            <div className="flex min-w-full gap-2 pb-1">
                {widget.semesters?.map((semester, index) => (
                    <div key={index} className="min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white p-2.5">
                        <div className="flex items-center justify-between gap-1">
                            <p className="text-[11px] font-black text-slate-800">{semester.label}</p>
                            {semester.is_prediction && <Chip tone="amber">توقّع</Chip>}
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold text-slate-500">{semester.total_hours} ساعة</p>
                        <ul className="mt-1.5 space-y-1">
                            {semester.courses?.map((course) => (
                                <li key={course.course_id} className="truncate text-[10.5px] font-bold text-slate-600">
                                    • {course.name}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
        {widget.summary && <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-500">{widget.summary}</p>}
    </Panel>
);

/* ── campus_place ────────────────────────────────────────────────────────── */

const CampusPlaceWidget = ({ widget }) => (
    <Panel label="📍 الموقع" tone="teal">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="text-[12.5px] font-black text-slate-800">{widget.name}</h4>
            {widget.building_location && (
                <p className="mt-1 text-[11.5px] font-bold leading-relaxed text-slate-600">🏢 {widget.building_location}</p>
            )}
            {widget.description && (
                <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-500">{widget.description}</p>
            )}
            {widget.maps_url && (
                <a
                    href={widget.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-teal-200 bg-teal-50 px-3 text-[11.5px] font-black text-teal-700"
                >
                    🗺️ افتح على الخريطة
                </a>
            )}
        </div>
    </Panel>
);

/* ── calendar_timeline ───────────────────────────────────────────────────── */

const CalendarTimelineWidget = ({ widget }) => (
    <Panel label="🗓️ مواعيد مهمة" tone="amber">
        <ol className="space-y-1.5">
            {widget.events?.map((event, index) => (
                <li key={index} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                    <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-600">{event.date}</span>
                    <div className="min-w-0">
                        <p className="text-[11.5px] font-black text-slate-800">{event.title}</p>
                        {event.note && <p className="text-[10px] font-bold text-slate-500">{event.note}</p>}
                    </div>
                </li>
            ))}
        </ol>
    </Panel>
);

/* ── clarification ───────────────────────────────────────────────────────── */

const ClarificationWidget = ({ widget, onSubmit }) => {
    const [sent, setSent] = useState(false);

    return (
        <Panel label="❓ سؤال توضيحي" tone="amber">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-[12px] font-black text-slate-800">{widget.question}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {widget.options?.map((option, index) => (
                        <button
                            key={index}
                            type="button"
                            disabled={sent}
                            onClick={() => { setSent(true); onSubmit?.(option.label); }}
                            className="min-h-[44px] rounded-xl border border-amber-200 bg-white px-3 text-[11px] font-black text-slate-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>
        </Panel>
    );
};

/* ── sources ─────────────────────────────────────────────────────────────── */

const SOURCE_ICON = {
    study_plan: '🗂️',
    cart: '🛒',
    transcript: '📄',
    academic_rules: '⚖️',
    regulations: '📜',
    campus_directory: '📍',
};

const SourcesWidget = ({ widget }) => (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-black text-slate-400">مبني على:</span>
        {widget.sources?.map((source, index) => (
            <span
                key={index}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9.5px] font-bold text-slate-600"
                title={source.entity_ids?.length ? `${source.entity_ids.length} عنصر` : undefined}
            >
                {SOURCE_ICON[source.type] || '•'} {source.label}
            </span>
        ))}
    </div>
);

/* ── registry ────────────────────────────────────────────────────────────── */

export const AI_WIDGET_REGISTRY = {
    course_card: CourseCardWidget,
    gpa_goal: GpaGoalWidget,
    semester_plan: SemesterPlanWidget,
    graduation_roadmap: GraduationRoadmapWidget,
    campus_place: CampusPlaceWidget,
    calendar_timeline: CalendarTimelineWidget,
    clarification: ClarificationWidget,
    sources: SourcesWidget,
};

/**
 * Render the additive `widgets` array.
 *
 * An unknown type is skipped silently: the server may ship a new widget before
 * the client does, and a missing panel is better than a crashed message.
 */
export default function AiWidgets({ widgets, onSubmit, onAction, actionStates = {}, renderChart }) {
    if (!Array.isArray(widgets) || widgets.length === 0) return null;

    return (
        <>
            {widgets.map((widget, index) => {
                const Component = AI_WIDGET_REGISTRY[widget?.type];
                if (!Component) return null;

                return (
                    <Component
                        key={`${widget.type}-${index}`}
                        widget={widget}
                        onSubmit={onSubmit}
                        onAction={onAction}
                        actionState={actionStates[widget.type]}
                        renderChart={renderChart}
                    />
                );
            })}
        </>
    );
}

/**
 * What the advisor remembers about this student, and why it was used.
 *
 * Memory the student cannot see is memory they cannot correct, so everything
 * stored is listed with its purpose and a single button that clears all of it.
 */
export function MemoryPanel({ memory, onForget }) {
    const [busy, setBusy] = useState(false);
    const [cleared, setCleared] = useState(false);

    if (!memory?.enabled || !memory.has_memory || cleared) return null;

    const forget = async () => {
        setBusy(true);
        try {
            await onForget?.();
            setCleared(true);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-black text-violet-800">🧠 ما يتذكّره سنفور عنك</p>
                <button
                    type="button"
                    onClick={forget}
                    disabled={busy}
                    className="min-h-[36px] rounded-full border border-violet-200 bg-white px-2.5 text-[10px] font-black text-violet-700 disabled:opacity-50"
                >
                    {busy ? '...' : '🗑️ امسح تفضيلاتي'}
                </button>
            </div>

            <ul className="mt-2 space-y-1.5">
                {memory.items.map((item) => (
                    <li key={item.key} className="rounded-lg border border-violet-100 bg-white/70 p-2">
                        <p className="text-[10.5px] font-black text-slate-700">
                            {item.label}: <span className="text-violet-700">{item.value}</span>
                        </p>
                        <p className="mt-0.5 text-[9.5px] font-bold leading-relaxed text-slate-500">{item.why}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * A confidence notice, shown ONLY when the answer is weak.
 *
 * A badge on every reply is trained away within a day; a notice that appears only
 * when something is genuinely uncertain keeps its meaning. The reasons come from
 * the server, which computed them from observable facts.
 */
export function ConfidenceNotice({ confidence }) {
    if (!confidence || confidence.level !== 'low') return null;

    return (
        <div className="sfr-attach sfr-fade-up">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
                <p className="text-[11.5px] font-black text-amber-800">⚠️ خُذ هذا الجواب بحذر</p>
                {confidence.reasons?.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                        {confidence.reasons.filter((reason) => reason.detail).map((reason, index) => (
                            <li key={index} className="text-[10.5px] font-bold leading-relaxed text-amber-700">• {reason.detail}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
