import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

/**
 * Gemini infrastructure monitor.
 *
 * Everything is grouped by API key AND by model, because that pair is the only
 * thing that answers the operational question: a key can be idle on chat while
 * already exhausted on embeddings, and a per-key total hides exactly that.
 */

const REFRESH_MS = 20000;

/* ── formatting ──────────────────────────────────────────────────────────── */

const compact = (value) => {
    const n = Number(value || 0);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
    return `${n}`;
};

const ms = (value) => {
    const n = Number(value || 0);
    return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
};

const ago = (iso) => {
    if (!iso) return '—';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return `قبل ${seconds} ثانية`;
    if (seconds < 3600) return `قبل ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `قبل ${Math.floor(seconds / 3600)} ساعة`;
    return `قبل ${Math.floor(seconds / 86400)} يوم`;
};

/* ── quota bar ───────────────────────────────────────────────────────────── */

// Literal class strings: Tailwind cannot see an interpolated colour name.
const BAND = {
    ok: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-200 dark:border-emerald-900/60' },
    warning: { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-200 dark:border-amber-900/60' },
    high: { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', ring: 'border-orange-200 dark:border-orange-900/60' },
    critical: { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: 'border-red-200 dark:border-red-900/60' },
};

const band = (name) => BAND[name] || BAND.ok;

const QuotaBar = ({ label, quota, showRemaining = false }) => {
    const tone = band(quota?.band);

    return (
        <div>
            <div className="flex items-baseline justify-between gap-2">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">{label}</span>
                <span className={`font-mono text-[10.5px] font-black ${tone.text}`}>
                    {compact(quota?.used)} / {compact(quota?.limit)}
                </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/60">
                <div
                    className={`h-full rounded-full transition-[width] duration-700 ease-out ${tone.bar}`}
                    style={{ width: `${Math.min(100, Number(quota?.percent || 0))}%` }}
                />
            </div>
            {showRemaining && (
                <p className="mt-1 text-[9px] font-bold text-slate-400">
                    متبقٍ اليوم: <span className="font-mono">{compact(quota?.remaining)}</span> طلب
                </p>
            )}
        </div>
    );
};

/* ── shells ──────────────────────────────────────────────────────────────── */

const Card = ({ className = '', children }) => (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700/60 dark:bg-slate-900/60 ${className}`}>
        {children}
    </div>
);

const Skeleton = ({ className = '' }) => (
    <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/50 ${className}`} />
);

const StatTile = ({ label, value, unit, hint, tone = 'slate' }) => {
    const accent = {
        slate: 'text-slate-900 dark:text-white',
        emerald: 'text-emerald-600 dark:text-emerald-400',
        amber: 'text-amber-600 dark:text-amber-400',
        red: 'text-red-600 dark:text-red-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
    }[tone];

    return (
        <Card className="min-w-0">
            <p className="truncate text-[9.5px] font-black uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`mt-1 font-mono text-xl font-black leading-none ${accent}`}>
                {value}
                {unit && <span className="ms-0.5 text-[11px] font-bold text-slate-400">{unit}</span>}
            </p>
            {hint && <p className="mt-1 truncate text-[9px] font-bold text-slate-400">{hint}</p>}
        </Card>
    );
};

const STATUS = {
    active: ['🟢', 'يعمل', 'text-emerald-600 dark:text-emerald-400'],
    rpm_full: ['🟡', 'حد الدقيقة', 'text-amber-600 dark:text-amber-400'],
    cooldown: ['🟠', 'يستريح', 'text-orange-600 dark:text-orange-400'],
    invalid: ['🔴', 'غير صالح', 'text-red-600 dark:text-red-400'],
};

/* ── health ──────────────────────────────────────────────────────────────── */

const HEALTH_LABEL = {
    healthy: ['سليم', 'text-emerald-600 dark:text-emerald-400', 'stroke-emerald-500'],
    degraded: ['متأثر', 'text-amber-600 dark:text-amber-400', 'stroke-amber-500'],
    at_risk: ['في خطر', 'text-orange-600 dark:text-orange-400', 'stroke-orange-500'],
    critical: ['حرج', 'text-red-600 dark:text-red-400', 'stroke-red-500'],
    offline: ['متوقف', 'text-slate-500', 'stroke-slate-400'],
};

const HealthPanel = ({ health }) => {
    const [label, tone, stroke] = HEALTH_LABEL[health?.label] || HEALTH_LABEL.offline;
    const score = Number(health?.score || 0);
    const radius = 34;
    const circumference = 2 * Math.PI * radius;

    return (
        <Card className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-5">
                <div className="relative shrink-0">
                    <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
                        <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="7" className="stroke-slate-200 dark:stroke-slate-700" />
                        <circle
                            cx="44" cy="44" r={radius} fill="none" strokeWidth="7" strokeLinecap="round"
                            className={`${stroke} transition-[stroke-dashoffset] duration-1000 ease-out`}
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - score / 100)}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`font-mono text-lg font-black ${tone}`}>{score}%</span>
                        <span className={`text-[9px] font-black ${tone}`}>{label}</span>
                    </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">صحة المنظومة</p>
                    {(health?.components || []).map((component) => (
                        <div key={component.key} className="flex items-center gap-2">
                            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                    className={`h-full rounded-full ${component.score >= 90 ? 'bg-emerald-500' : component.score >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${component.score}%` }}
                                />
                            </div>
                            <span className="shrink-0 font-mono text-[10px] font-black text-slate-500">{component.score}</span>
                            <span className="truncate text-[10px] font-bold text-slate-500 dark:text-slate-400">{component.detail}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};

/* ── model cards ─────────────────────────────────────────────────────────── */

const ModelCard = ({ model }) => (
    <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
                <h3 className="truncate text-[13px] font-black text-slate-900 dark:text-white">{model.label}</h3>
                <p className="mt-0.5 font-mono text-[9px] text-slate-400">{model.id}</p>
            </div>
            {model.never_used ? (
                <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-400 dark:border-slate-700">
                    لم يُستخدم
                </span>
            ) : (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-600 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-400">
                    {model.active_keys} / {model.configured_keys} مفتاح نشط
                </span>
            )}
        </div>

        <div className="mt-3 space-y-2.5">
            <QuotaBar label="RPM" quota={model.quotas.rpm} />
            <QuotaBar label="TPM" quota={model.quotas.tpm} />
            <QuotaBar label="RPD" quota={model.quotas.rpd} showRemaining />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
            {[
                ['طلبات اليوم', compact(model.requests_today)],
                ['توكنز اليوم', compact(model.tokens_today)],
                ['نسبة النجاح', model.success_rate === null ? '—' : `${model.success_rate}%`],
                ['نسبة الخطأ', model.error_rate === null ? '—' : `${model.error_rate}%`],
                ['متوسط الاستجابة', ms(model.avg_response_ms)],
                ['حد المفتاح/دقيقة', model.per_key_limits.rpm],
            ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                    <p className="truncate text-[9px] font-bold text-slate-400">{label}</p>
                    <p className="font-mono text-[11.5px] font-black text-slate-700 dark:text-slate-200">{value}</p>
                </div>
            ))}
        </div>
    </Card>
);

/* ── key cards ───────────────────────────────────────────────────────────── */

const MODEL_STATUS = {
    healthy: ['Healthy', 'text-emerald-600 dark:text-emerald-400'],
    strained: ['Strained', 'text-amber-600 dark:text-amber-400'],
    exhausted: ['Exhausted', 'text-red-600 dark:text-red-400'],
};

const KeyCard = ({ apiKey }) => {
    const [open, setOpen] = useState(false);
    const [icon, statusLabel, statusTone] = STATUS[apiKey.status] || STATUS.cooldown;

    return (
        <Card className="p-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-3 p-4 text-right transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
            >
                <span className="text-sm">{icon}</span>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12.5px] font-black text-slate-900 dark:text-white">🔑 API Key #{apiKey.index}</span>
                        <span className={`text-[10px] font-black ${statusTone}`}>{statusLabel}</span>
                        {apiKey.near_limit && (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-black text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                                قريب من الحد
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[9px] text-slate-400">{apiKey.masked_key}</p>
                </div>

                <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-[9px] font-bold text-slate-400">آخر استخدام</p>
                    <p className="text-[10px] font-black text-slate-600 dark:text-slate-300">{ago(apiKey.history.last_used_at)}</p>
                </div>

                <div className="hidden shrink-0 text-right md:block">
                    <p className="text-[9px] font-bold text-slate-400">الموديل الحالي</p>
                    <p className="max-w-[140px] truncate text-[10px] font-black text-slate-600 dark:text-slate-300">
                        {apiKey.current_model || '—'}
                    </p>
                </div>

                <span className={`shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {open && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-700/60">
                    {apiKey.status_message && (
                        <p className="mb-3 text-[10.5px] font-bold text-slate-500 dark:text-slate-400">{apiKey.status_message}</p>
                    )}

                    {/* Per-model quota table — the whole point of the page. */}
                    <div className="-mx-1 overflow-x-auto">
                        <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 px-1 text-right">
                            <thead>
                                <tr className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="pb-1 text-right font-black">Model</th>
                                    <th className="pb-1 text-right font-black">RPM</th>
                                    <th className="pb-1 text-right font-black">TPM</th>
                                    <th className="pb-1 text-right font-black">RPD</th>
                                    <th className="pb-1 text-right font-black">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {apiKey.models.map((model) => {
                                    const [statusText, statusColour] = MODEL_STATUS[model.status] || MODEL_STATUS.healthy;

                                    return (
                                        <tr key={model.id} className="bg-slate-50/70 dark:bg-slate-800/40">
                                            <td className="rounded-s-xl p-2.5">
                                                <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">{model.label}</p>
                                                <p className="mt-0.5 text-[9px] font-bold text-slate-400">
                                                    {model.never_used ? 'Never Used' : `${compact(model.requests_today)} اليوم · ${compact(model.tokens_today)} توكن`}
                                                </p>
                                            </td>
                                            {model.never_used ? (
                                                <td colSpan={3} className="p-2.5 text-[10px] font-bold text-slate-400">
                                                    Never Used
                                                </td>
                                            ) : (
                                                <>
                                                    {['rpm', 'tpm', 'rpd'].map((metric) => (
                                                        <td key={metric} className="w-[110px] p-2.5">
                                                            <QuotaBar label={metric.toUpperCase()} quota={model.quotas[metric]} />
                                                        </td>
                                                    ))}
                                                </>
                                            )}
                                            <td className={`rounded-e-xl p-2.5 text-[10px] font-black ${statusColour}`}>{statusText}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* History */}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                            ['اليوم', compact(apiKey.history.requests_today)],
                            ['هذا الأسبوع', compact(apiKey.history.requests_week)],
                            ['هذا الشهر', compact(apiKey.history.requests_month)],
                            ['الإجمالي', compact(apiKey.history.lifetime)],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                                <p className="text-[9px] font-bold text-slate-400">{label}</p>
                                <p className="font-mono text-[12px] font-black text-slate-700 dark:text-slate-200">{value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                            <p className="text-[9px] font-bold text-slate-400">آخر نجاح</p>
                            <p className="text-[10px] font-black text-slate-600 dark:text-slate-300">{ago(apiKey.history.last_success_at)}</p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                            <p className="text-[9px] font-bold text-slate-400">آخر استراحة</p>
                            <p className="text-[10px] font-black text-slate-600 dark:text-slate-300">
                                {apiKey.cooldown_remaining > 0 ? `الآن (${apiKey.cooldown_remaining}s)` : apiKey.cooldown_reason || '—'}
                            </p>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2 dark:border-slate-700/60 dark:bg-slate-800/40">
                            <p className="text-[9px] font-bold text-slate-400">آخر خطأ</p>
                            <p className="truncate text-[10px] font-black text-slate-600 dark:text-slate-300">
                                {apiKey.history.last_error
                                    ? `${apiKey.history.last_error.message} · ${ago(apiKey.history.last_error_at)}`
                                    : 'لا يوجد'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

/* ── charts ──────────────────────────────────────────────────────────────── */

const PIE_COLOURS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const ChartCard = ({ title, subtitle, children, className = '' }) => (
    <Card className={className}>
        <div className="mb-3">
            <h3 className="text-[12px] font-black text-slate-900 dark:text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[9.5px] font-bold text-slate-400">{subtitle}</p>}
        </div>
        <div className="h-[190px] w-full">{children}</div>
    </Card>
);

const chartAxis = (isDark) => ({
    tick: { fontSize: 9, fill: isDark ? '#94a3b8' : '#64748b', fontWeight: 700 },
    stroke: isDark ? '#334155' : '#e2e8f0',
});

const chartTooltip = (isDark) => ({
    contentStyle: {
        background: isDark ? '#0f172a' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 800,
        direction: 'rtl',
    },
});

/* ── page ────────────────────────────────────────────────────────────────── */

export default function AiMonitorIndex({ auth, initialMetrics }) {
    const { isDark } = useTheme();
    const [metrics, setMetrics] = useState(initialMetrics || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [live, setLive] = useState(true);
    const [filters, setFilters] = useState(() => ({
        model: initialMetrics?.filters?.model || '',
        api_key_id: initialMetrics?.filters?.api_key_id || '',
        status: initialMetrics?.filters?.status || '',
        days: initialMetrics?.filters?.days || 7,
        only_active: Boolean(initialMetrics?.filters?.only_active),
        near_limit: Boolean(initialMetrics?.filters?.near_limit),
    }));

    const load = useCallback(async (next, { quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        Object.entries(next).forEach(([key, value]) => {
            if (value === '' || value === false || value === null || value === undefined) return;
            params.set(key, value === true ? '1' : String(value));
        });

        try {
            const response = await fetch(`/admin/ai-monitor/metrics?${params.toString()}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            setMetrics(await response.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Filter changes reload immediately; the live loop refreshes quietly so the
    // page never flashes a skeleton over data that is already on screen.
    useEffect(() => { load(filters); }, [filters, load]);

    useEffect(() => {
        if (!live) return undefined;
        const timer = setInterval(() => load(filters, { quiet: true }), REFRESH_MS);

        return () => clearInterval(timer);
    }, [live, filters, load]);

    const overview = metrics?.overview;
    const charts = metrics?.charts;
    const axis = chartAxis(isDark);
    const tooltip = chartTooltip(isDark);

    const tiles = useMemo(() => overview ? [
        { label: 'إجمالي المفاتيح', value: overview.total_keys, tone: 'indigo' },
        { label: 'مفاتيح نشطة', value: overview.active_keys, tone: 'emerald' },
        { label: 'مفاتيح تستريح', value: overview.resting_keys, tone: 'amber' },
        { label: 'قريبة من الحد', value: overview.keys_near_limit, tone: overview.keys_near_limit > 0 ? 'red' : 'slate' },
        { label: 'موديلات مستخدمة', value: overview.models_in_use },
        { label: 'طلبات اليوم', value: compact(overview.requests_today) },
        { label: 'طلبات الأسبوع', value: compact(overview.requests_week) },
        { label: 'توكنز اليوم', value: compact(overview.tokens_today) },
        { label: 'متوسط الاستجابة', value: ms(overview.avg_response_ms) },
        { label: 'طلبات فاشلة اليوم', value: compact(overview.failed_requests_today), tone: overview.failed_requests_today > 0 ? 'red' : 'slate' },
        { label: 'إجمالي المحادثات', value: compact(overview.total_conversations) },
        { label: 'مفاتيح غير صالحة', value: overview.invalid_keys, tone: overview.invalid_keys > 0 ? 'red' : 'slate' },
    ] : [], [overview]);

    return (
        <AdminLayout user={auth?.user || {}}>
            <Head title="مراقبة Gemini" />

            <div className="pb-8" dir="rtl">
                {/* Header */}
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 dark:text-white">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm text-white shadow-md">⚡</span>
                            مراقبة Gemini
                        </h1>
                        <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                            الحصص والاستهلاك لكل مفتاح ولكل موديل على حدة
                            {metrics?.generated_at && <> · آخر تحديث {ago(metrics.generated_at)}</>}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setLive((v) => !v)}
                            className={`flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-[10.5px] font-black transition-colors ${
                                live
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900'
                            }`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500 motion-safe:animate-pulse' : 'bg-slate-400'}`} />
                            {live ? 'تحديث تلقائي' : 'متوقف'}
                        </button>
                        <button
                            type="button"
                            onClick={() => load(filters)}
                            className="min-h-[38px] rounded-xl border border-slate-200 bg-white px-3 text-[10.5px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                            ↻ تحديث
                        </button>
                    </div>
                </div>

                {error && (
                    <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30">
                        <p className="text-[11px] font-black text-red-700 dark:text-red-400">تعذّر تحميل البيانات: {error}</p>
                    </Card>
                )}

                {metrics && !metrics.logging_enabled && (
                    <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
                        <p className="text-[11px] font-black text-amber-800 dark:text-amber-400">
                            تسجيل الاستخدام معطّل (GEMINI_USAGE_LOGGING=false) — تُعرض العدادات اللحظية فقط بلا تاريخ.
                        </p>
                    </Card>
                )}

                {/* Filters */}
                <Card className="mb-5">
                    <div className="flex flex-wrap items-end gap-2.5">
                        <label className="min-w-[150px] flex-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">الموديل</span>
                            <select
                                value={filters.model}
                                onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">كل الموديلات</option>
                                {(metrics?.available_models || []).map((model) => (
                                    <option key={model.id} value={model.id}>{model.label}</option>
                                ))}
                            </select>
                        </label>

                        <label className="min-w-[110px]">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">المفتاح</span>
                            <select
                                value={filters.api_key_id}
                                onChange={(e) => setFilters((f) => ({ ...f, api_key_id: e.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">الكل</option>
                                {(initialMetrics?.keys || []).map((key) => (
                                    <option key={key.index} value={key.index}>#{key.index}</option>
                                ))}
                            </select>
                        </label>

                        <label className="min-w-[120px]">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">الحالة</span>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">الكل</option>
                                <option value="active">نشط</option>
                                <option value="cooldown">يستريح</option>
                                <option value="rpm_full">حد الدقيقة</option>
                                <option value="invalid">غير صالح</option>
                            </select>
                        </label>

                        <label className="min-w-[110px]">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">المدة</span>
                            <select
                                value={filters.days}
                                onChange={(e) => setFilters((f) => ({ ...f, days: Number(e.target.value) }))}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                {[1, 7, 14, 30, 90].map((days) => (
                                    <option key={days} value={days}>{days} يوم</option>
                                ))}
                            </select>
                        </label>

                        {[['only_active', 'النشطة فقط'], ['near_limit', 'قريبة من الحد']].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                                className={`min-h-[38px] rounded-xl border px-3 text-[10.5px] font-black transition-colors ${
                                    filters[key]
                                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-400'
                                        : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Overview + health */}
                {!metrics ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="h-[76px]" />)}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                            {tiles.map((tile) => <StatTile key={tile.label} {...tile} />)}
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <HealthPanel health={metrics.health} />
                        </div>

                        {/* Model analytics */}
                        <h2 className="mb-3 mt-6 text-sm font-black text-slate-900 dark:text-white">Model Usage Analytics</h2>
                        {metrics.models.length === 0 ? (
                            <Card><p className="text-[11px] font-bold text-slate-400">لا توجد موديلات مهيّأة.</p></Card>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {metrics.models.map((model) => <ModelCard key={model.id} model={model} />)}
                            </div>
                        )}

                        {/* Keys */}
                        <h2 className="mb-3 mt-6 text-sm font-black text-slate-900 dark:text-white">
                            API Keys <span className="text-[10px] font-bold text-slate-400">({metrics.keys.length})</span>
                        </h2>
                        {metrics.keys.length === 0 ? (
                            <Card><p className="text-[11px] font-bold text-slate-400">لا يوجد مفتاح يطابق الفلاتر الحالية.</p></Card>
                        ) : (
                            <div className="space-y-2.5">
                                {metrics.keys.map((apiKey) => <KeyCard key={apiKey.fingerprint} apiKey={apiKey} />)}
                            </div>
                        )}

                        {/* Charts */}
                        <h2 className="mb-3 mt-6 text-sm font-black text-slate-900 dark:text-white">Charts</h2>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <ChartCard title="الطلبات لكل ساعة" subtitle="آخر 24 ساعة">
                                <ResponsiveContainer>
                                    <AreaChart data={charts?.hourly || []}>
                                        <defs>
                                            <linearGradient id="reqHour" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                                                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke={axis.stroke} vertical={false} />
                                        <XAxis dataKey="label" {...axis} interval={3} />
                                        <YAxis {...axis} width={30} />
                                        <Tooltip {...tooltip} />
                                        <Area type="monotone" dataKey="requests" name="طلبات" stroke="#6366f1" strokeWidth={2} fill="url(#reqHour)" />
                                        <Area type="monotone" dataKey="errors" name="أخطاء" stroke="#ef4444" strokeWidth={1.5} fillOpacity={0} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            <ChartCard title="الطلبات لكل يوم" subtitle={`آخر ${filters.days} يوم`}>
                                <ResponsiveContainer>
                                    <BarChart data={charts?.daily || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={axis.stroke} vertical={false} />
                                        <XAxis dataKey="label" {...axis} />
                                        <YAxis {...axis} width={30} />
                                        <Tooltip {...tooltip} />
                                        <Bar dataKey="requests" name="طلبات" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="errors" name="أخطاء" fill="#ef4444" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            <ChartCard title="التوكنز لكل يوم" subtitle="مدخلة ومخرجة">
                                <ResponsiveContainer>
                                    <AreaChart data={charts?.tokens_daily || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={axis.stroke} vertical={false} />
                                        <XAxis dataKey="label" {...axis} />
                                        <YAxis {...axis} width={38} tickFormatter={compact} />
                                        <Tooltip {...tooltip} formatter={(value) => compact(value)} />
                                        <Area type="monotone" dataKey="input_tokens" name="مدخلة" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.25} />
                                        <Area type="monotone" dataKey="output_tokens" name="مخرجة" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            <ChartCard title="زمن الاستجابة" subtitle="متوسط وأقصى (ms)">
                                <ResponsiveContainer>
                                    <LineChart data={charts?.latency_daily || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={axis.stroke} vertical={false} />
                                        <XAxis dataKey="label" {...axis} />
                                        <YAxis {...axis} width={38} tickFormatter={compact} />
                                        <Tooltip {...tooltip} />
                                        <Line type="monotone" dataKey="avg_ms" name="متوسط" stroke="#10b981" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="max_ms" name="أقصى" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            <ChartCard title="الأخطاء" subtitle="العدد والنسبة">
                                <ResponsiveContainer>
                                    <BarChart data={charts?.errors_daily || []}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={axis.stroke} vertical={false} />
                                        <XAxis dataKey="label" {...axis} />
                                        <YAxis {...axis} width={30} />
                                        <Tooltip {...tooltip} />
                                        <Bar dataKey="errors" name="أخطاء" fill="#ef4444" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartCard>

                            <ChartCard title="التوزيع" subtitle="حسب الموديل والمفتاح">
                                <div className="grid h-full grid-cols-2 gap-2">
                                    {[['by_model', 'موديل'], ['by_key', 'مفتاح']].map(([source, caption]) => (
                                        <div key={source} className="min-w-0">
                                            <ResponsiveContainer>
                                                <PieChart>
                                                    <Tooltip {...tooltip} />
                                                    <Pie
                                                        data={charts?.[source] || []}
                                                        dataKey="requests"
                                                        nameKey="label"
                                                        innerRadius="45%"
                                                        outerRadius="78%"
                                                        paddingAngle={2}
                                                    >
                                                        {(charts?.[source] || []).map((entry, index) => (
                                                            <Cell key={entry.key} fill={PIE_COLOURS[index % PIE_COLOURS.length]} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <p className="text-center text-[9px] font-black text-slate-400">حسب الـ{caption}</p>
                                        </div>
                                    ))}
                                </div>
                            </ChartCard>
                        </div>

                        {loading && (
                            <p className="mt-4 text-center text-[10px] font-bold text-slate-400">...جاري التحديث</p>
                        )}
                    </>
                )}
            </div>
        </AdminLayout>
    );
}
