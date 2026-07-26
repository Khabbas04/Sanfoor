import React, { useMemo, useState } from 'react';
import {
    ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

/**
 * Generative charts for advisor replies.
 *
 * The model returns only data points (validated + clamped server-side in
 * AiAdvisorController::sanitizeGpaForecastWidget/sanitizeRadarWidget); every
 * visual decision lives here.
 *
 * Loaded lazily from the advisor page so the recharts chunk is only fetched when
 * a reply actually contains a chart.
 */

// Categorical slots in fixed order — a series keeps its hue no matter how many
// series are on screen. Validated for all-pairs CVD separation on a white
// surface (worst pair ΔE 9.2 deutan / 16.3 normal), so slot 4 is violet rather
// than the yellow that would collide with orange.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7'];

const INK = { primary: '#0f172a', secondary: '#475569', muted: '#94a3b8' };
const GRID = '#eef2f7';

const fmt = (v) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(1));

// Shared tooltip shell: RTL text, values in ink with a colored dot for identity.
const TipCard = ({ title, rows }) => (
    <div dir="rtl" style={{
        background: '#fff', border: '1px solid #e6ebf2', borderRadius: 10,
        boxShadow: '0 6px 20px rgba(15,23,42,.10)', padding: '7px 10px', fontSize: 11,
    }}>
        <p style={{ margin: 0, fontWeight: 900, color: INK.primary, fontSize: 11 }}>{title}</p>
        {rows.map((r, i) => (
            <p key={i} style={{ margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 6, color: INK.secondary, fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: r.color || INK.muted, flexShrink: 0 }} />
                <span>{r.label}</span>
                <span style={{ color: INK.primary, fontWeight: 900, marginInlineStart: 'auto' }}>{r.value}</span>
            </p>
        ))}
    </div>
);

const ChartFrame = ({ icon, title, note, children, footer }) => (
    <div className="sfr-attach sfr-fade-up">
        <p className="sfr-attach__label text-slate-600">{icon} {title}</p>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            {note && <p className="text-[11px] font-bold text-slate-500 leading-snug mb-2">{note}</p>}
            {children}
            {footer}
        </div>
    </div>
);

// ── GPA forecast: one measure over time + an uncertainty band ────────────────
// One series, so no legend box; the band is explained in a caption instead.
const GpaForecast = ({ widget }) => {
    const points = widget.points || [];

    const data = useMemo(() => points.map(p => ({
        label: p.label,
        expected: p.expected,
        // Recharts renders a two-value dataKey as a range area, which is how the
        // best/worst case reads as one band instead of two competing lines.
        band: p.pessimistic != null && p.optimistic != null ? [p.pessimistic, p.optimistic] : null,
        pessimistic: p.pessimistic,
        optimistic: p.optimistic,
    })), [points]);

    const hasBand = data.some(d => d.band);

    // Pad the domain around the data: a forced 0–100 axis flattens a few points of
    // GPA movement into a straight line and hides the actual story.
    const domain = useMemo(() => {
        const all = data.flatMap(d => [d.expected, d.pessimistic, d.optimistic].filter(v => v != null));
        const lo = Math.min(...all), hi = Math.max(...all);
        const pad = Math.max(1.5, (hi - lo) * 0.35);
        return [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
    }, [data]);

    const first = data[0]?.expected;
    const last = data[data.length - 1]?.expected;
    const delta = first != null && last != null ? last - first : null;

    return (
        <ChartFrame
            icon="📈"
            title={widget.title || 'توقّع معدلك التراكمي'}
            note={widget.note}
            footer={hasBand && (
                <p className="text-[9.5px] font-bold text-slate-400 mt-1.5 flex items-center gap-1.5">
                    <span className="inline-block w-4 h-2 rounded-sm" style={{ background: 'rgba(42,120,214,.16)', border: '1px solid rgba(42,120,214,.3)' }} />
                    النطاق بين أفضل وأسوأ حالة · الخط = التوقّع الأرجح
                </p>
            )}
        >
            {/* Headline numbers first — the trend is the chart, the value is the point. */}
            <div className="flex items-center gap-4 mb-2">
                <div>
                    <p className="text-[8.5px] font-bold text-slate-400">معدلك الآن</p>
                    <p className="text-[19px] font-black leading-tight" style={{ color: INK.primary }}>
                        {fmt(widget.current_gpa ?? first)}<span className="text-[10px] text-slate-400 font-bold">%</span>
                    </p>
                </div>
                {delta != null && (
                    <div>
                        <p className="text-[8.5px] font-bold text-slate-400">المتوقّع بعد {data.length - 1} فصل</p>
                        <p className="text-[19px] font-black leading-tight" style={{ color: delta >= 0 ? '#0a7048' : '#b42323' }}>
                            {fmt(last)}<span className="text-[10px] font-bold opacity-70">% ({delta >= 0 ? '+' : ''}{fmt(delta)})</span>
                        </p>
                    </div>
                )}
                {widget.target_gpa != null && (
                    <div className="mr-auto text-left">
                        <p className="text-[8.5px] font-bold text-slate-400">هدفك</p>
                        <p className="text-[13px] font-black" style={{ color: INK.secondary }}>{fmt(widget.target_gpa)}%</p>
                    </div>
                )}
            </div>

            {/* dir=ltr keeps the SVG geometry predictable; `reversed` makes time run
                right-to-left so it still reads correctly in Arabic. */}
            <div dir="ltr" style={{ width: '100%', height: 190 }}>
                <ResponsiveContainer>
                    <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 4, left: 6 }}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis
                            dataKey="label" reversed
                            tick={{ fill: INK.secondary, fontSize: 10, fontWeight: 700 }}
                            tickLine={false} axisLine={{ stroke: GRID }} height={22}
                        />
                        <YAxis
                            domain={domain} orientation="right" width={34}
                            tick={{ fill: INK.muted, fontSize: 10, fontWeight: 700 }}
                            tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip
                            cursor={{ stroke: INK.muted, strokeWidth: 1 }}
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const p = payload[0].payload;
                                const rows = [{ label: 'التوقّع الأرجح', value: `${fmt(p.expected)}%`, color: SERIES[0] }];
                                if (p.optimistic != null) rows.push({ label: 'أفضل حالة', value: `${fmt(p.optimistic)}%` });
                                if (p.pessimistic != null) rows.push({ label: 'أسوأ حالة', value: `${fmt(p.pessimistic)}%` });
                                return <TipCard title={label} rows={rows} />;
                            }}
                        />
                        {widget.target_gpa != null && (
                            <ReferenceLine
                                y={widget.target_gpa} stroke={INK.muted} strokeWidth={1}
                                label={{ value: `هدفك ${fmt(widget.target_gpa)}%`, position: 'insideTopLeft', fill: INK.secondary, fontSize: 9, fontWeight: 800 }}
                            />
                        )}
                        {hasBand && (
                            <Area
                                dataKey="band" stroke="none" fill={SERIES[0]} fillOpacity={0.16}
                                isAnimationActive={false} connectNulls
                            />
                        )}
                        <Line
                            dataKey="expected" stroke={SERIES[0]} strokeWidth={2} fill={SERIES[0]}
                            dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                            animationDuration={550}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </ChartFrame>
    );
};

// ── Radar: 2–4 courses across 3–6 shared axes ───────────────────────────────
const RadarCompare = ({ widget }) => {
    const [asTable, setAsTable] = useState(false);
    const axes = widget.axes || [];
    const series = (widget.series || []).slice(0, SERIES.length);

    const data = useMemo(() => axes.map((axis, i) => {
        const row = { axis };
        series.forEach((s, si) => { row[`s${si}`] = s.values?.[i] ?? 0; });
        return row;
    }), [axes, series]);

    return (
        <ChartFrame
            icon="🕸️"
            title={widget.title || 'مقارنة متعددة الأبعاد'}
            note={widget.note}
            footer={
                <div className="flex items-center justify-between mt-1.5">
                    {/* Legend is always present for ≥2 series: identity never rests on
                        color alone. Text stays in ink; the dot carries the hue. */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {series.map((s, i) => (
                            <span key={i} className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: INK.secondary }}>
                                <span className="inline-block w-2 h-2 rounded-full" style={{ background: SERIES[i] }} />
                                {s.name}
                            </span>
                        ))}
                    </div>
                    <button type="button" onClick={() => setAsTable(v => !v)} className="text-[9.5px] font-black text-slate-500 hover:text-blue-700 transition-colors shrink-0">
                        {asTable ? '🕸️ كرسم' : '📋 كجدول'}
                    </button>
                </div>
            }
        >
            {asTable ? (
                <div className="sfr-table-wrap" style={{ overflowX: 'auto', border: '1px solid #e6ebf2', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '6px 8px', textAlign: 'start', background: '#f6f8fc', color: INK.primary, fontWeight: 900 }}>المحور</th>
                                {series.map((s, i) => (
                                    <th key={i} style={{ padding: '6px 8px', textAlign: 'start', background: '#f6f8fc', color: INK.primary, fontWeight: 900 }}>{s.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, ri) => (
                                <tr key={ri}>
                                    <td style={{ padding: '6px 8px', borderTop: '1px solid #eef2f7', color: INK.secondary, fontWeight: 700 }}>{row.axis}</td>
                                    {series.map((s, si) => (
                                        <td key={si} style={{ padding: '6px 8px', borderTop: '1px solid #eef2f7', color: INK.primary, fontWeight: 800 }}>{fmt(row[`s${si}`])} / 5</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div dir="ltr" style={{ width: '100%', height: 230 }}>
                    <ResponsiveContainer>
                        <RadarChart data={data} outerRadius="72%">
                            <PolarGrid stroke={GRID} />
                            <PolarAngleAxis dataKey="axis" tick={{ fill: INK.secondary, fontSize: 10, fontWeight: 700 }} />
                            <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fill: INK.muted, fontSize: 8 }} axisLine={false} />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    return <TipCard
                                        title={payload[0].payload.axis}
                                        rows={series.map((s, i) => ({ label: s.name, value: `${fmt(payload[0].payload[`s${i}`])} / 5`, color: SERIES[i] }))}
                                    />;
                                }}
                            />
                            {series.map((s, i) => (
                                <Radar
                                    key={i} dataKey={`s${i}`} name={s.name}
                                    stroke={SERIES[i]} strokeWidth={2}
                                    fill={SERIES[i]} fillOpacity={0.12}
                                    dot={{ r: 2.5, strokeWidth: 0, fill: SERIES[i] }}
                                    animationDuration={550}
                                />
                            ))}
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </ChartFrame>
    );
};

export default function AiCharts({ widget }) {
    if (widget?.type === 'gpa_forecast') return <GpaForecast widget={widget} />;
    if (widget?.type === 'radar') return <RadarCompare widget={widget} />;
    return null;
}
