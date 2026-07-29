import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Swal from 'sweetalert2';
import AiWidgets, { ConfidenceNotice, MemoryPanel } from '@/Components/AiWidgets';
const VideoPlayer = React.lazy(() => import('@/Components/VideoPlayer'));
const AiCharts = React.lazy(() => import('@/Components/AiCharts'));

// Respect the OS-level "reduce motion" setting: the typewriter is decoration, and
// for a student who asked for less movement it is the first thing to drop.
const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
// Resolve the deployment URL once for canonical metadata and stable links.
const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

// Shared SweetAlert configuration for advisor-side confirmations and alerts.
const swal = { confirmButtonColor: '#3b82f6', customClass: { popup: 'rounded-3xl font-t', title: 'font-t font-black', htmlContainer: 'font-t font-bold text-sm' } };

const csrfToken = () => document.querySelector('meta[name="csrf-token"]')?.content || '';

// Quick-command tones as literal class strings. Tailwind compiles what it can see in
// the source, so the previous `bg-${cmd.color}-50/50` produced class names that were
// never generated — the cards rendered with no background, border or text colour.
const CMD_TONES = {
    blue: { card: 'bg-blue-50/60 border-blue-200/50 hover:bg-blue-100/60 hover:border-blue-300/60', title: 'text-blue-700', desc: 'text-blue-500/70' },
    sky: { card: 'bg-sky-50/60 border-sky-200/50 hover:bg-sky-100/60 hover:border-sky-300/60', title: 'text-sky-700', desc: 'text-sky-500/70' },
    cyan: { card: 'bg-cyan-50/60 border-cyan-200/50 hover:bg-cyan-100/60 hover:border-cyan-300/60', title: 'text-cyan-700', desc: 'text-cyan-500/70' },
    teal: { card: 'bg-teal-50/60 border-teal-200/50 hover:bg-teal-100/60 hover:border-teal-300/60', title: 'text-teal-700', desc: 'text-teal-500/70' },
    emerald: { card: 'bg-emerald-50/60 border-emerald-200/50 hover:bg-emerald-100/60 hover:border-emerald-300/60', title: 'text-emerald-700', desc: 'text-emerald-500/70' },
    amber: { card: 'bg-amber-50/60 border-amber-200/50 hover:bg-amber-100/60 hover:border-amber-300/60', title: 'text-amber-700', desc: 'text-amber-500/70' },
    orange: { card: 'bg-orange-50/60 border-orange-200/50 hover:bg-orange-100/60 hover:border-orange-300/60', title: 'text-orange-700', desc: 'text-orange-500/70' },
    rose: { card: 'bg-rose-50/60 border-rose-200/50 hover:bg-rose-100/60 hover:border-rose-300/60', title: 'text-rose-700', desc: 'text-rose-500/70' },
    pink: { card: 'bg-pink-50/60 border-pink-200/50 hover:bg-pink-100/60 hover:border-pink-300/60', title: 'text-pink-700', desc: 'text-pink-500/70' },
    fuchsia: { card: 'bg-fuchsia-50/60 border-fuchsia-200/50 hover:bg-fuchsia-100/60 hover:border-fuchsia-300/60', title: 'text-fuchsia-700', desc: 'text-fuchsia-500/70' },
    violet: { card: 'bg-violet-50/60 border-violet-200/50 hover:bg-violet-100/60 hover:border-violet-300/60', title: 'text-violet-700', desc: 'text-violet-500/70' },
    indigo: { card: 'bg-indigo-50/60 border-indigo-200/50 hover:bg-indigo-100/60 hover:border-indigo-300/60', title: 'text-indigo-700', desc: 'text-indigo-500/70' },
    slate: { card: 'bg-slate-50 border-slate-200/60 hover:bg-slate-100/70 hover:border-slate-300/60', title: 'text-slate-700', desc: 'text-slate-500/70' },
};
const cmdTone = (color) => CMD_TONES[color] || CMD_TONES.slate;

// Read one SSE frame ("event: x\ndata: {...}") into { event, data }.
const parseSseFrame = (frame) => {
    let event = 'message';
    const dataLines = [];

    for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }

    let data = null;
    if (dataLines.length) {
        try { data = JSON.parse(dataLines.join('')); } catch { data = null; }
    }

    return { event, data };
};

// Clean an AI reply before markdown rendering:
//  - The skill-tree feature was removed. Older stored messages may still contain a
//    ```mermaid / ```skilltree diagram fence (or a bare %%SKILL_TREE%% token); strip
//    them so raw diagram source never renders as an ugly code block.
//  - The model sometimes pads bold markers with inner spaces ("** نص **"), which
//    Markdown shows as literal asterisks. Collapse the padding (code fences untouched).
const sanitizeReply = (s) => {
    if (typeof s !== 'string') s = String(s ?? '');
    let out = s
        .replace(/```(?:mermaid|skilltree)[\s\S]*?```/gi, '')
        .replace(/%%SKILL_TREE%%/g, '');
    if (out.indexOf('**') !== -1) {
        out = out
            .split(/(```[\s\S]*?```)/g)
            .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/\*\*[ \t]*([^*\n]+?)[ \t]*\*\*/g, '**$1**')))
            .join('');
    }
    return out.trim();
};

// ──────────────────────────────────────────────────────────────
// AI reply rendering
//
// The model is instructed (config/ai.php → formatting_instructions) to split
// consultations into `### ` sections: الخلاصة / خطة العمل المقترحة / نصيحة د. سنفور.
// Markdown alone renders those as bare headings followed by loose text, so we
// parse the reply into sections and render each one as a real card that WRAPS
// its own body — instead of styling the heading and leaving the content outside.
// ──────────────────────────────────────────────────────────────

// One visual theme per known section title (first match wins).
const SECTION_THEMES = [
    { test: /خلاصة|ملخص/, icon: '📌', cls: 'sfr-sec--summary' },
    { test: /خطة|المواد|مقترح|توصيات/, icon: '📚', cls: 'sfr-sec--plan' },
    { test: /نصيحة|توجيه|إستراتيجية|استراتيجية/, icon: '💡', cls: 'sfr-sec--tip' },
    { test: /تحذير|تنبيه|خطر|انتبه/, icon: '⚠️', cls: 'sfr-sec--warn' },
    { test: /قانون|قوانين|مادة \(|نظام/, icon: '⚖️', cls: 'sfr-sec--legal' },
    { test: /تقويم|موعد|مواعيد|جدول زمني/, icon: '📅', cls: 'sfr-sec--date' },
];

// Leading emoji of a heading (with variation selectors / ZWJ sequences).
const LEAD_EMOJI = /^(?:[\p{Extended_Pictographic}←-➿][︎️‍⃣]*)+/u;

// Strip a leading emoji and markdown punctuation so the card owns the icon.
const cleanTitle = (t) => t
    .replace(/^[\s#*_]+/, '')
    .replace(/[:：*_\s]+$/, '')
    .replace(LEAD_EMOJI, '')
    .trim();

// Split markdown into [{ title, icon, cls, body }]. Text before the first
// heading becomes an untitled intro section (rendered without a card).
const parseSections = (md) => {
    const lines = String(md ?? '').split('\n');
    const out = [];
    let cur = { title: null, icon: null, cls: null, lines: [] };
    let fence = false;

    for (const line of lines) {
        if (/^\s{0,3}```/.test(line)) fence = !fence;
        const h = !fence && line.match(/^\s{0,3}#{2,4}\s+(.+?)\s*$/);
        if (h) {
            if (cur.lines.length || cur.title) out.push(cur);
            const raw = h[1].trim();
            const title = cleanTitle(raw);
            const theme = SECTION_THEMES.find(t => t.test.test(title));
            cur = {
                title: title || raw,
                icon: theme?.icon || raw.match(LEAD_EMOJI)?.[0] || '▸',
                cls: theme?.cls || 'sfr-sec--plain',
                lines: [],
            };
            continue;
        }
        cur.lines.push(line);
    }
    if (cur.lines.length || cur.title) out.push(cur);

    return out
        .map(s => ({ ...s, body: s.lines.join('\n').trim() }))
        .filter(s => s.title || s.body);
};

// Markdown element overrides shared by every section body.
const mdComponents = {
    // Headings deeper than the section split act as inline sub-titles.
    h1: ({ children }) => <p className="sfr-sub">{children}</p>,
    h2: ({ children }) => <p className="sfr-sub">{children}</p>,
    h3: ({ children }) => <p className="sfr-sub">{children}</p>,
    h4: ({ children }) => <p className="sfr-sub">{children}</p>,
    h5: ({ children }) => <p className="sfr-sub">{children}</p>,
    h6: ({ children }) => <p className="sfr-sub">{children}</p>,
    hr: () => <div className="sfr-hr" />,
    blockquote: ({ children }) => <blockquote className="sfr-quote">{children}</blockquote>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="sfr-link">{children}</a>,
    table: ({ children }) => <div className="sfr-table-wrap"><table>{children}</table></div>,
    pre: ({ children }) => <>{children}</>,
    code({ node, inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const text = String(children).replace(/\n$/, '');
        const isBlock = !inline && (match || text.includes('\n'));
        if (!isBlock) return <code className="sfr-code-inline" dir="ltr" {...props}>{children}</code>;
        return (
            <div className="sfr-code" dir="ltr">
                <div className="sfr-code__bar">
                    <span className="sfr-code__lang">{match ? match[1] : 'code'}</span>
                    <button
                        type="button"
                        onClick={(e) => {
                            navigator.clipboard.writeText(text);
                            const btn = e.currentTarget, was = btn.innerHTML;
                            btn.innerHTML = '✓ تم النسخ';
                            setTimeout(() => { btn.innerHTML = was; }, 2000);
                        }}
                        className="sfr-code__copy"
                        title="نسخ الكود"
                    >📋 نسخ</button>
                </div>
                <div className="sfr-code__body">
                    <code className={className || ''} {...props}>{children}</code>
                </div>
            </div>
        );
    },
};

const Md = ({ children }) => (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{children}</ReactMarkdown>
);

// One section = header strip (icon + title) + its own body.
const ReplySection = ({ section }) => {
    if (!section.title) return <div className="sfr-intro"><Md>{section.body}</Md></div>;
    return (
        <section className={`sfr-sec ${section.cls}`}>
            <header className="sfr-sec__head">
                <span className="sfr-sec__icon">{section.icon}</span>
                <h3 className="sfr-sec__title">{section.title}</h3>
            </header>
            {section.body && <div className="sfr-sec__body"><Md>{section.body}</Md></div>}
        </section>
    );
};

const ReplyBody = ({ content }) => {
    const sections = useMemo(() => parseSections(content), [content]);
    if (!sections.length) return null;
    return <div className="sfr-md">{sections.map((s, i) => <ReplySection key={i} section={s} />)}</div>;
};

// Animate AI responses as they stream into the chat window.
const Typewriter = ({ content, isAnimating, onComplete, onScroll }) => {
    const [txt, setTxt] = useState('');
    const idx = useRef(0), raf = useRef(null), done = useRef(false);
    const safeContent = sanitizeReply(content);
    useEffect(() => {
        // Reduced motion: show the finished reply at once instead of typing it out.
        if (!isAnimating || prefersReducedMotion()) {
            setTxt(safeContent);
            done.current = true;
            if (isAnimating) onComplete?.();
            return;
        }

        idx.current = 0; setTxt(''); done.current = false;
        const go = () => {
            if (done.current) return;
            const i = idx.current;
            if (i < safeContent.length) {
                const speed = safeContent.length > 700 ? 4 : safeContent.length > 350 ? 3 : 2;
                const n = Math.min(i + speed, safeContent.length);
                setTxt(safeContent.slice(0, n));
                idx.current = n;
                if (n % 60 === 0) onScroll?.();
                raf.current = requestAnimationFrame(go);
            }
            else { done.current = true; onComplete?.(); }
        };
        raf.current = requestAnimationFrame(go);
        return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    }, [safeContent, isAnimating]);
    useEffect(() => { if (!isAnimating && !done.current) { setTxt(safeContent); done.current = true; } }, [isAnimating, safeContent]);
    return <ReplyBody content={txt} />;
};


// A single course row: name + hours + one clear action. Used for both the
// "add" lists and the "remove" list, so every course reads the same way.
const CourseButton = ({ course, isAdded, isLoading, onToggle, variant = 'add' }) => {
    const rm = variant === 'remove';
    if (!course || !course.id) return null;
    if (rm && !isAdded) return null;
    const tone = rm ? 'sfr-crow--remove' : isAdded ? 'sfr-crow--added' : 'sfr-crow--add';
    return (
        <button
            type="button"
            onClick={() => onToggle(course.id, course.name, course.credit_hours)}
            disabled={isLoading}
            className={`sfr-crow ${tone} ${isLoading ? 'is-loading' : ''} sfr-fade-up`}
            title={rm ? 'إزالة من التسجيل التجريبي' : isAdded ? 'إزالة من التسجيل التجريبي' : 'إضافة للتسجيل التجريبي'}
        >
            <span className="sfr-crow__mark">
                {isLoading ? <span className="sfr-spin" /> : rm ? '🗑' : isAdded ? '✓' : '+'}
            </span>
            <span className="sfr-crow__name">{course.name}</span>
            {course.credit_hours != null && <span className="sfr-crow__hours">{course.credit_hours} س</span>}
            <span className="sfr-crow__cta">{rm ? 'إزالة' : isAdded ? 'في خطتك · إزالة' : 'إضافة'}</span>
        </button>
    );
};

// ========== 📊 Comparison Cards ==========
const ComparisonWidget = ({ widget, addedCourses, onToggleCourse, loadingCourseId }) => {
    const [sel, setSel] = useState(null);
    const diffLabel = ['', 'سهل جداً', 'سهل', 'متوسط', 'صعب', 'صعب جداً'];
    const diffColor = (d) => d <= 2 ? 'emerald' : d <= 3 ? 'amber' : 'red';
    return (
        <div className="mt-4 pt-3 border-t border-blue-100/40 sfr-fade-up">
            <p className="text-[10px] font-black text-blue-600 mb-3">📊 {widget.title || 'قارن واختر'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(widget.items || []).map((item, i) => {
                    const dc = diffColor(item.difficulty || 3);
                    const active = sel === i;
                    const added = addedCourses[item.id];
                    return (
                        <div key={i} onClick={() => setSel(i)} className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${active ? 'border-blue-500 bg-blue-50/40 shadow-lg shadow-blue-100/40 scale-[1.01]' : 'border-slate-200/50 bg-white hover:border-blue-200 hover:shadow-sm'}`}>
                            {item.recommendation && <span className="absolute -top-2.5 right-3 text-[8px] bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full font-black shadow-sm">{item.recommendation}</span>}
                            <p className="font-black text-[13px] text-slate-800">{item.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono mb-3">{item.code} • {item.credit_hours} ساعة</p>
                            <div className="mb-2.5">
                                <div className="flex justify-between text-[9px] font-bold mb-1"><span className="text-slate-400">الصعوبة</span><span className={`text-${dc}-600`}>{diffLabel[item.difficulty || 0]}</span></div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full"><div className={`h-full rounded-full bg-${dc}-500 transition-all duration-500`} style={{ width: `${((item.difficulty || 1) / 5) * 100}%` }} /></div>
                            </div>
                            <div className="flex justify-between text-[9px] font-bold mb-3">
                                <span className="text-blue-600">🔓 تفتح {item.unlocks || 0} مواد</span>
                                <span className={`px-1.5 py-0.5 rounded ${item.gpa_impact === 'مرتفع' ? 'bg-emerald-50 text-emerald-700' : item.gpa_impact === 'متوسط' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>المعدل: {item.gpa_impact || '—'}</span>
                            </div>
                            {active && item.id && (
                                // 🆕 تم تمرير الساعات هنا: item.credit_hours
                                <button onClick={(e) => { e.stopPropagation(); onToggleCourse(item.id, item.name, item.credit_hours); }} disabled={loadingCourseId === item.id}
                                    className={`w-full py-2 rounded-xl text-[11px] font-black transition-all active:scale-95 ${added ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white shadow-md shadow-blue-500/30'}`}>
                                    {added ? '✅ في التسجيل التجريبي — اضغط للإزالة' : '➕ أضف للتسجيل التجريبي'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ========== 🗳 Poll ==========
const PollWidget = ({ widget, onSubmit }) => {
    const [chosen, setChosen] = useState(null);
    const [sent, setSent] = useState(false);
    const pick = (opt) => { if (sent) return; setChosen(opt.value); setSent(true); setTimeout(() => onSubmit(`أولويتي هالفصل: ${opt.label}`), 500); };
    return (
        <div className="mt-4 pt-3 border-t border-blue-100/40 sfr-fade-up">
            <p className="text-[10px] font-black text-blue-600 mb-3">🗳️ {widget.question}</p>
            <div className="space-y-1.5">
                {(widget.options || []).map((opt, i) => (
                    <button key={i} onClick={() => pick(opt)} disabled={sent}
                        className={`w-full py-3 px-4 rounded-xl font-black text-[12px] transition-all flex items-center justify-between ${chosen === opt.value ? 'bg-blue-600 text-white shadow-lg shadow-blue-200/40 scale-[1.01]' : sent ? 'bg-slate-50 text-slate-300 border border-slate-100' : 'bg-blue-50/70 text-blue-700 border border-blue-200/50 hover:bg-blue-100 active:scale-[.98]'}`}>
                        <span>{opt.label}</span>
                        {chosen === opt.value && <span className="text-sm">✓</span>}
                    </button>
                ))}
            </div>
            {sent && <p className="text-[9px] text-blue-400 font-bold text-center mt-2.5 animate-pulse">⏳ جاري تحليل أولويتك...</p>}
        </div>
    );
};

// ========== ⏱ Hours Slider ==========
const HoursSliderWidget = ({ widget, onSubmit }) => {
    const min = widget.min || 9, max = widget.max || 18;
    const [val, setVal] = useState(widget.default || 15);
    const [sent, setSent] = useState(false);
    const pct = ((val - min) / (max - min)) * 100;
    const go = () => { setSent(true); onSubmit(`أبي أسجل ${val} ساعة هالفصل`); };
    return (
        <div className="mt-4 pt-3 border-t border-teal-100/40 sfr-fade-up">
            <p className="text-[10px] font-black text-teal-600 mb-3">⏱️ {widget.question || 'كم ساعة تبي تسجل؟'}</p>
            <div className="bg-gradient-to-br from-teal-50/80 to-emerald-50/60 rounded-2xl p-4 border border-teal-200/40">
                <div className="text-center mb-4">
                    <span className="text-5xl font-black text-teal-700 tabular-nums">{val}</span>
                    <span className="text-base font-bold text-teal-500 mr-1">ساعة</span>
                    {widget.current_cart_hours > 0 && <p className="text-[9px] text-slate-400 font-bold mt-1">التسجيل التجريبي حالياً: {widget.current_cart_hours} ساعة</p>}
                </div>
                <div className="relative mb-4">
                    <div className="w-full h-2.5 bg-teal-100 rounded-full"><div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
                    <input type="range" min={min} max={max} value={val} onChange={(e) => setVal(+e.target.value)} disabled={sent} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
                <div className="flex gap-1 justify-center flex-wrap mb-4">
                    {[...Array(max - min + 1)].map((_, i) => { const v = min + i; return <button key={v} onClick={() => !sent && setVal(v)} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${v === val ? 'bg-teal-600 text-white shadow-md scale-110' : 'bg-white text-slate-500 border border-slate-200 hover:border-teal-300'}`}>{v}</button>; })}
                </div>
                {!sent ? <button onClick={go} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-[12px] font-black transition-all active:scale-95 shadow-md shadow-teal-200/30">🚀 ابنِ لي خطة بـ {val} ساعة</button>
                    : <p className="text-[10px] text-teal-500 font-bold text-center animate-pulse">⚡ جاري بناء خطتك...</p>}
            </div>
        </div>
    );
};

// ========== 📋 Cart Review (Bulletproof — مقاوم لهلوسة الـ AI) ==========
const CartReviewWidget = ({ widget, addedCourses, onToggleCourse, loadingCourseId }) => {
    const s = widget.summary || {};

    const currentWidgetHours = useMemo(() => {
        return (widget.courses || []).reduce((sum, c) => {
            return sum + (addedCourses[c.id] ? c.credit_hours : 0);
        }, 0);
    }, [widget.courses, addedCourses]);

    // ─── تصنيف حالة كل مادة بناءً على الواقع (inCart) وليس فقط verdict الـ AI ───
    const getCourseState = (c) => {
        const inCart = !!addedCourses[c.id];

        // 🛡️ القاعدة الذهبية: إذا المادة مو بالتسجيل التجريبي → دائماً "مقترحة للإضافة"
        // حتى لو الـ AI أرسل verdict: 'remove' بالخطأ (هلوسة)
        if (!inCart) {
            return {
                type: 'suggest_add',        // مادة مقترحة قابلة للإضافة
                rowClass: 'sfr-crow--add',
                icon: '💡',
                badge: { text: 'أضفها', cls: 'sfr-badge--blue' },
                reason: c.reason || 'مادة مقترحة من المرشد الذكي',
            };
        }

        // المادة موجودة بالتسجيل التجريبي → نثق بـ verdict الـ AI
        if (c.verdict === 'remove') {
            return {
                type: 'remove_from_cart',    // مادة سيئة، الـ AI يطلب حذفها
                rowClass: 'sfr-crow--remove',
                icon: '🗑️',
                badge: { text: 'احذفها', cls: 'sfr-badge--rose' },
                reason: c.reason || 'ينصح المرشد بإزالتها لتخفيف العبء',
            };
        }
        if (c.verdict === 'warning') {
            return {
                type: 'warning_in_cart',     // مادة فيها تحفظ
                rowClass: 'sfr-crow--warn',
                icon: '⚠️',
                badge: { text: 'انتبه', cls: 'sfr-badge--amber' },
                reason: c.reason || 'راقب هذه المادة',
            };
        }
        // verdict === 'keep' أو أي قيمة أخرى
        return {
            type: 'keep_in_cart',            // مادة جيدة، أبقِها
            rowClass: 'sfr-crow--added',
            icon: '✓',
            badge: { text: 'أبقِها', cls: 'sfr-badge--green' },
            reason: c.reason || 'مادة مناسبة لجدولك',
        };
    };

    const maxHours = s.max_hours || 18;
    const over = currentWidgetHours > maxHours;

    return (
        <div className="sfr-attach sfr-fade-up">
            <p className="sfr-attach__label text-slate-600">📋 {widget.title || 'مراجعة التسجيل التجريبي'}</p>
            {s.recommendation && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 mb-2 flex items-center gap-4">
                    <div className="text-center shrink-0">
                        <p className="text-[8px] font-bold text-slate-400">الساعات</p>
                        <p className={`text-[17px] font-black leading-tight ${over ? 'text-rose-600' : 'text-blue-700'}`}>
                            {currentWidgetHours}<span className="text-[10px] text-slate-400">/{maxHours}</span>
                        </p>
                    </div>
                    <div className="text-center shrink-0">
                        <p className="text-[8px] font-bold text-slate-400">الصعوبة</p>
                        <p className="text-[12px] font-black text-slate-700 leading-tight mt-1">{s.overall_difficulty || '—'}</p>
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 leading-snug border-r border-slate-200 pr-4">{s.recommendation}</p>
                </div>
            )}
            <div className="space-y-1.5">
                {(widget.courses || []).map((c, i) => {
                    const state = getCourseState(c);
                    const inCart = !!addedCourses[c.id];
                    const busy = loadingCourseId === c.id;

                    return (
                        <div key={i} className={`sfr-crow sfr-crow--static ${state.rowClass}`}>
                            <span className="sfr-crow__mark">{state.icon}</span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-1.5">
                                    <span className="sfr-crow__name truncate">{c.name}</span>
                                    {c.code && <span className="text-[9px] font-mono text-slate-400">{c.code}</span>}
                                    {c.credit_hours != null && <span className="sfr-crow__hours">{c.credit_hours} س</span>}
                                </span>
                                <span className="block text-[10px] text-slate-500 font-bold leading-snug mt-0.5">{state.reason}</span>
                            </span>
                            <span className={`sfr-badge ${state.badge.cls}`}>{state.badge.text}</span>

                            {/* المادة مو بالتسجيل التجريبي → إضافة (حتى لو الـ AI أرسل verdict: remove) */}
                            {!inCart && c.id && (
                                <button type="button" onClick={() => onToggleCourse(c.id, c.name, c.credit_hours)} disabled={busy} className="sfr-crow__cta sfr-crow__cta--add">
                                    {busy ? '…' : 'إضافة'}
                                </button>
                            )}

                            {/* المادة بالتسجيل التجريبي + الـ AI يطلب حذفها → حذف تحذيري */}
                            {inCart && c.verdict === 'remove' && c.id && (
                                <button type="button" onClick={() => onToggleCourse(c.id, c.name, c.credit_hours)} disabled={busy} className="sfr-crow__cta sfr-crow__cta--danger">
                                    {busy ? '…' : 'احذفها'}
                                </button>
                            )}

                            {/* المادة بالتسجيل التجريبي + verdict مو remove → إزالة هادئة للتراجع */}
                            {inCart && c.verdict !== 'remove' && (
                                <button type="button" onClick={() => onToggleCourse(c.id, c.name, c.credit_hours)} disabled={busy} className="sfr-crow__cta sfr-crow__cta--ghost">
                                    {busy ? '…' : 'إزالة'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Charts pull in recharts, so they load only when a reply actually contains one.
const ChartWidget = ({ widget }) => (
    <React.Suspense fallback={<div className="sfr-attach"><div className="h-[190px] rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-center"><span className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div></div>}>
        <AiCharts widget={widget} />
    </React.Suspense>
);

// Widget Router
const Widget = ({ widget, addedCourses, onToggleCourse, loadingCourseId, onSubmit }) => {
    if (!widget?.type) return null;
    const map = { comparison: ComparisonWidget, poll: PollWidget, hours_slider: HoursSliderWidget, cart_review: CartReviewWidget, gpa_forecast: ChartWidget, radar: ChartWidget };
    const C = map[widget.type]; if (!C) return null;
    return <C widget={widget} addedCourses={addedCourses} onToggleCourse={onToggleCourse} loadingCourseId={loadingCourseId} onSubmit={onSubmit} />;
};

// Why an answer was unhelpful. Optional — a plain thumbs-down still posts, and the
// endpoint accepts it without a reason exactly as before.
const FEEDBACK_REASONS = [
    ['incorrect_information', '❌ معلومة خاطئة'],
    ['misunderstood_question', '🤔 ما فهم سؤالي'],
    ['unsuitable_recommendation', '🎯 التوصية ما تناسبني'],
    ['too_long', '📏 طويل زيادة'],
    ['action_failed', '⚙️ الإجراء ما نُفّذ'],
];

// What to change on a retry. Sent as `mode`; omitting it is the old behaviour.
const REGEN_MODES = [
    ['shorten', '📏 أقصر'],
    ['explain_more', '🔍 وضّح أكثر'],
    ['alternative', '🔄 خيار آخر'],
    ['refresh_data', '♻️ حدّث بياناتي'],
];

// ========== MessageActions ==========
const Actions = ({ msg, onRegen, onFeedback, isLast }) => {
    const [fb, setFb] = useState(null);
    const [cp, setCp] = useState(false);
    const [askReason, setAskReason] = useState(false);
    const [askMode, setAskMode] = useState(false);

    return (
        <div className="mt-2 border-t border-slate-100/50 pt-2">
            <div className="flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover/m:opacity-100">
                <button onClick={() => { navigator.clipboard.writeText(msg.content); setCp(true); setTimeout(() => setCp(false), 2e3); }} className="sfr-action-btn" title="نسخ">{cp ? '✓' : '📋'}</button>
                {isLast && <button onClick={() => setAskMode(v => !v)} className="sfr-action-btn" title="إعادة التوليد">🔄</button>}
                <span className="mx-1 h-4 w-px bg-slate-200" />
                <button onClick={() => { if (!fb) { setFb('up'); onFeedback(msg.id, 'up'); } }} className={`sfr-action-btn ${fb === 'up' ? 'bg-emerald-100 text-emerald-600' : ''}`}>👍</button>
                <button onClick={() => { if (!fb) { setFb('down'); onFeedback(msg.id, 'down'); setAskReason(true); } }} className={`sfr-action-btn ${fb === 'down' ? 'bg-red-100 text-red-600' : ''}`}>👎</button>
            </div>

            {/* The rating is already recorded; the reason only sharpens it. */}
            {askReason && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                    <p className="text-[10px] font-black text-slate-500">وش كان الخطأ؟ (اختياري)</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {FEEDBACK_REASONS.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => { onFeedback(msg.id, 'down', value); setAskReason(false); }}
                                className="min-h-[36px] rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {askMode && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                    <p className="text-[10px] font-black text-slate-500">أعيد الجواب كيف؟</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {REGEN_MODES.map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => { setAskMode(false); onRegen(value); }}
                                className="min-h-[36px] rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                                {label}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => { setAskMode(false); onRegen(null); }}
                            className="min-h-[36px] rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-600"
                        >
                            ↩️ نفس السؤال
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ========== ChatMessage ==========
const Msg = ({ msg, name, added, loading, onToggle, onDone, scroll, isLast, onRegen, onFb, onFollow, onAction, actionStates }) => {
    const u = msg.role === 'user';

    // A course must appear exactly once per reply. The interactive widget is the
    // single source of truth for anything it lists, and each course belongs to one
    // list only — otherwise the same course showed up twice with opposite actions
    // ("أضفها" under the reply and "احذفها" inside the widget).
    const { suggest, remove } = useMemo(() => {
        const w = msg.interactive_widget;
        const owned = new Set([...(w?.courses || []), ...(w?.items || [])].map(c => c?.id).filter(Boolean));

        // A course listed inside one of the new panels (plan, roadmap, card) is
        // already presented there with its own action, so it must not also appear
        // as a loose suggestion chip above it.
        (msg.widgets || []).forEach(widget => {
            (widget.courses || []).forEach(c => c?.course_id && owned.add(c.course_id));
            (widget.semesters || []).forEach(s => (s.courses || []).forEach(c => c?.course_id && owned.add(c.course_id)));
            if (widget.course_id) owned.add(widget.course_id);
        });
        const seen = new Set();
        const take = (list) => (list || []).filter(c => {
            if (!c?.id || owned.has(c.id) || seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });
        return { suggest: take(msg.suggested_courses), remove: take(msg.courses_to_remove) };
    }, [msg.suggested_courses, msg.courses_to_remove, msg.interactive_widget, msg.widgets]);

    // Appended blocks (courses, widgets, actions) only make sense once the reply is
    // complete — mid-stream they would pop in against a half-written answer.
    const settled = !msg.isAnimating && !msg.isStreaming;

    return (
        <div className={`flex ${u ? 'justify-end' : 'justify-start'} sfr-slide-up`}>
            <div className={`flex w-full ${u ? 'md:max-w-[75%] justify-end' : 'w-full'} gap-3 ${u ? 'flex-row-reverse' : ''} items-start`}>
                {u ? (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-md ring-4 ring-white overflow-hidden mt-1">
                        {u.avatar ? <img src={u.avatar} alt={name} className="w-full h-full object-cover" /> : name?.charAt(0) || 'أ'}
                    </div>
                ) : <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 border-2 border-white flex items-center justify-center shrink-0 overflow-hidden shadow-md mt-1"><img src="/images/aiwidget.png?v=2" alt="AI Widget" className="w-full h-full object-cover opacity-90" onError={e => { e.target.outerHTML = '<span class="text-sm">🤖</span>'; }} /></div>}
                <div className={`group/m ${u ? 'bg-slate-800 text-white rounded-3xl rounded-se-sm shadow-md p-4' : 'bg-white border border-slate-200/80 text-slate-700 rounded-2xl rounded-ss-md w-full shadow-[0_2px_14px_rgba(15,23,42,0.05)] p-4 md:p-5'}`}>
                    {u ? <p className="font-bold leading-relaxed text-[12.5px] whitespace-pre-wrap">{msg.content}</p> : (
                        <div className="w-full">
                            <Typewriter content={msg.content} isAnimating={msg.isAnimating} onScroll={scroll} onComplete={onDone} />
                            {msg.isStreaming && <span className="sfr-caret" aria-hidden="true" />}
                            {settled && suggest.length > 0 && <div className="sfr-attach sfr-fade-up"><p className="sfr-attach__label text-blue-600">✨ مواد مقترحة</p><div className="space-y-1.5">{suggest.map(c => <CourseButton key={c.id} course={c} isAdded={!!added[c.id]} isLoading={loading === c.id} onToggle={onToggle} />)}</div></div>}
                            {settled && remove.some(c => added[c.id]) && <div className="sfr-attach sfr-fade-up"><p className="sfr-attach__label text-rose-600">⚠️ تخفيف العبء</p><div className="space-y-1.5">{remove.map(c => <CourseButton key={`r-${c.id}`} course={c} isAdded={!!added[c.id]} isLoading={loading === c.id} onToggle={onToggle} variant="remove" />)}</div></div>}
                            {settled && msg.interactive_widget && <Widget widget={msg.interactive_widget} addedCourses={added} onToggleCourse={onToggle} loadingCourseId={loading} onSubmit={onFollow} />}
                            {/* Additive: the legacy widget above still renders, and these
                                come alongside it. An older stored message has none. */}
                            {settled && (
                                <AiWidgets
                                    widgets={msg.widgets}
                                    onSubmit={onFollow}
                                    onAction={onAction}
                                    actionStates={actionStates}
                                    renderChart={(forecast) => <ChartWidget widget={forecast} />}
                                />
                            )}
                            {settled && <ConfidenceNotice confidence={msg.confidence} />}
                            {settled && msg.follow_up_suggestions?.length > 0 && <div className="sfr-attach sfr-fade-up"><p className="sfr-attach__label text-slate-500">💬 أسئلة متابعة</p><div className="flex flex-wrap gap-1.5">{msg.follow_up_suggestions.map((q, i) => <button key={i} onClick={() => onFollow(q)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[10.5px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all active:scale-95">{q}</button>)}</div></div>}
                            {settled && msg.id !== 'welcome' && <Actions msg={msg} isLast={isLast} onRegen={onRegen} onFeedback={onFb} />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ========== ProgressRing ==========
const Ring = ({ pct, size = 40, s = 3.5 }) => {
    const r = (size - s) / 2, c = 2 * Math.PI * r;
    return <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={s} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#rg)" strokeWidth={s} strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round" className="transition-all duration-700" /><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs></svg>;
};

// ======================================================================
// 🧠 Proactive Briefing — personalized analysis shown on page open
// ======================================================================
const BRIEF_CHIP = {
    risk: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    opportunity: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    pivotal: 'bg-indigo-50 border-indigo-200 text-indigo-800',
};
const briefBold = (t) => String(t ?? '').split(/(\*\*[^*]+\*\*)/g).map((x, i) =>
    x.startsWith('**') && x.endsWith('**')
        ? <strong key={i} className="font-extrabold">{x.slice(2, -2)}</strong>
        : <span key={i}>{x}</span>);

const ProactiveBriefing = ({ insights }) => {
    const p = insights.progress || {};
    return (
        <div className="sfr-fade-up bg-white border border-blue-200/60 rounded-2xl p-4 shadow-sm relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-sky-400 to-blue-500"></div>
            <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-blue-100 shrink-0 shadow-sm"><img src="/images/aiwidget.png?v=2" alt="سنفور" className="w-full h-full object-cover" /></div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-slate-800">{insights.greeting}</p>
                    <p className="text-[12px] font-bold text-blue-700 leading-snug">{insights.headline}</p>
                </div>
                {p.percent != null && (
                    <div className="relative flex items-center justify-center shrink-0"><Ring pct={p.percent} size={44} s={3.5} /><span className="absolute text-[10px] font-black text-slate-700">{p.percent}%</span></div>
                )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
                <div className="bg-white border border-slate-100 rounded-xl px-3 py-1.5"><p className="text-[7px] font-bold text-slate-400 uppercase">الساعات</p><p className="text-[12px] font-black text-slate-700">{p.passed}/{p.total}</p></div>
                {insights.gpa != null && <div className="bg-white border border-slate-100 rounded-xl px-3 py-1.5"><p className="text-[7px] font-bold text-slate-400 uppercase">المعدل</p><p className="text-[12px] font-black text-blue-700">{insights.gpa}%</p></div>}
                <div className="bg-white border border-slate-100 rounded-xl px-3 py-1.5 flex-1 min-w-[150px]"><p className="text-[7px] font-bold text-slate-400 uppercase">🎓 توقّع التخرج</p><p className="text-[10px] font-bold text-slate-600 leading-tight">{insights.graduation_forecast}</p></div>
            </div>

            {insights.highlights?.length > 0 && (
                <div className="mt-3 space-y-1.5">
                    {insights.highlights.map((h, i) => (
                        <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl border text-[11px] font-bold leading-snug ${BRIEF_CHIP[h.type] || BRIEF_CHIP.opportunity}`}>
                            <span className="text-sm shrink-0">{h.icon}</span>
                            <span className="flex-1">{briefBold(h.text)}</span>
                        </div>
                    ))}
                </div>
            )}

            {insights.sections?.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {insights.sections.map((s, i) => (
                        <div key={i} className="bg-white border border-slate-100 rounded-xl p-2">
                            <div className="flex items-center justify-between mb-1"><span className="text-[9px] font-black text-slate-600">{s.icon} {s.label}</span><span className="text-[8px] font-bold text-slate-400">{s.done}/{s.total}</span></div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${s.percent}%` }} /></div>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
};

// ======================================================================
// 🧠 Welcome Chat
// ======================================================================
const WelcomeChat = ({ st }) => {
    const capabilities = [
        { icon: '📊', title: 'تحليل دقيق لوضعك', desc: 'بحلل معدلك وساعاتك وموقعك من التخرج بذكاء' },
        { icon: '🎯', title: 'اقتراح أفضل المواد', desc: 'ببني لك جدول مخصص يرفع معدلك ويناسب خطتك' },
        { icon: '📋', title: 'تقييم تسجيلك الحالي', desc: 'براجع موادك التجريبية وبنصحك تحذف أو تخفف العبء' },
        { icon: '⚖️', title: 'مقارنة المواد', desc: 'بساعدك تختار بين مادتين وتعرف تأثير كل مادة' },
        { icon: '📅', title: 'قوانين وتقويم جامعي', desc: 'بجاوبك عن مواعيد التسجيل، الامتحانات، وأي قانون' },
    ];

    return (
        <div className="flex flex-col items-center justify-center text-center px-4 py-2 md:py-4 h-full sfr-fade-up">
            <div className="w-14 h-14 md:w-16 md:h-16 mb-4 rounded-full overflow-hidden shadow-sm ring-4 ring-blue-50">
                <img src="/images/aiwidget.png?v=2" alt="سنفور" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-slate-800 mb-1">أهلاً بك {st?.name?.split(' ')[0] || ''}! 👋</h2>
            <p className="text-[12px] font-bold text-slate-500 mb-4 max-w-lg leading-relaxed px-2">
                أنا دكتور سنفور، مستشارك الأكاديمي الذكي. 🤖<br/>
                هنا مساحتك الخاصة لتسألني وتستشيرني عن أي شيء يخص مسيرتك الأكاديمية!
            </p>
            
            <div className="w-full max-w-3xl bg-white border border-blue-100 rounded-3xl p-4 md:p-5 shadow-sm">
                <h3 className="text-[12px] md:text-[13px] font-black text-blue-700 mb-3 flex items-center justify-center gap-2">
                    <span className="text-lg">✨</span> كيف يمكنني مساعدتك؟
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 text-right">
                    {capabilities.map((cap, i) => (
                        <div key={i} className={`p-3 rounded-2xl border border-slate-100 bg-slate-50 flex items-start gap-2.5 transition-transform hover:-translate-y-1 hover:shadow-md hover:border-blue-200 ${i === 4 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                            <span className="text-xl md:text-2xl mt-0.5">{cap.icon}</span>
                            <div>
                                <h4 className="font-black text-[11px] md:text-[12px] text-slate-700 mb-0.5">{cap.title}</h4>
                                <p className="text-[9.5px] md:text-[10px] font-bold text-slate-500 leading-relaxed">{cap.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] md:text-[11px] font-bold text-slate-400 mt-4 text-center animate-pulse">
                    اكتب سؤالك في صندوق الدردشة بالأسفل للبدء 👇
                </p>
            </div>
        </div>
    );
};

// ======================================================================
// 🧠 MAIN
// ======================================================================
export default function Advisor() {
    const { studentStats: st, chats: initChats, initialCartIds, dailyMessagesRemaining: initialRemaining, hasDailyLimit: initialHasDailyLimit, isAiActive: initialIsAiActive, proactiveInsights, aiMemory } = usePage().props;

    const [remaining, setRemaining] = useState(initialHasDailyLimit ? (initialRemaining ?? 5) : null);
    const [hasDailyLimit, setHasDailyLimit] = useState(initialHasDailyLimit ?? true);
    const [isAiActive, setIsAiActive] = useState(initialIsAiActive ?? false);
    const [isFallback, setIsFallback] = useState(false);
    const [fallbackReason, setFallbackReason] = useState(null);

    const limitReached = hasDailyLimit && remaining !== null && remaining <= 0;

    const welcome = useMemo(() => {
        const name = st?.name || 'بطل';
        const gpa = parseFloat(st?.gpa) || 0;
        const hours = st?.hours_completed || 0;
        const totalHours = st?.total_plan_hours || 132;
        const progress = st?.progress_percent || 0;
        const cartHoursDb = st?.cart_hours || 0;
        const hasAcademicRecords = hours > 0;
        const isProbation = st?.is_probation || false;

        let greeting = `مرحباً **${name}**! 👋\n\nأنا **سنفور**، مرشدك الأكاديمي الذكي.\n\n`;
        let personalMsg = '';
        let suggestedActions = [];

        // تحليل حالة الطالب
        if (!hasAcademicRecords) {
            personalMsg = `✅ **وضعك طبيعي حالياً.** ما عندك مواد منجزة بعد، لذلك ما في معدل فعلي ولا إنذار.\nابدأ بإضافة أول موادك وأنا بساعدك تخطط بشكل صحيح.\n\n`;
            suggestedActions = ['اقترح لي أول مواد مناسبة', 'كم ساعة أسجل هالفصل؟', 'رتّب لي خطة بداية بسيطة'];
        } else if (isProbation) {
            personalMsg = `⚠️ **تنبيه:** معدلك حالياً **${gpa}%** وأنت تحت الإنذار الأكاديمي.\nلا تقلق — خليني أساعدك تبني خطة إنقاذ لرفع معدلك!\n\n`;
            suggestedActions = ['أريد خطة إنقاذ لرفع معدلي', 'اقترح مواد سهلة لرفع المعدل', 'كم ساعة أسجل وأنا بالإنذار؟'];
        } else if (progress >= 80) {
            personalMsg = `🎓 **أنت قريب من التخرج!** أنجزت **${progress}%** من خطتك (${hours}/${totalHours} ساعة).\nخليني أساعدك تنهي آخر المواد بأفضل طريقة.\n\n`;
            suggestedActions = ['رتّب لي المواد المتبقية', 'كم فصل باقي على التخرج؟', 'راجع التسجيل التجريبي وقيّمه'];
        } else if (cartHoursDb > 0) {
            personalMsg = `📋 **التسجيل التجريبي عندك فيه ${cartHoursDb} ساعة.** `;
            if (cartHoursDb > 18) {
                personalMsg += `⚠️ هذا أكثر من الحد المسموح!\n\n`;
                suggestedActions = ['العبء كبير، شو أحذف؟', 'راجع التسجيل التجريبي وقيّمه', 'قارن لي أفضل المواد'];
            } else if (cartHoursDb < 12) {
                personalMsg += `ممكن تضيف مواد ثانية — عندك مساحة.\n\n`;
                suggestedActions = ['اقترح مواد أضيفها للتسجيل التجريبي', 'قارن لي أفضل المواد', 'كم معدلي حالياً؟'];
            } else {
                personalMsg += `عبء متوازن! بس خليني أتأكد إنه مناسب.\n\n`;
                suggestedActions = ['راجع التسجيل التجريبي وقيّمه', 'هل الجدول مناسب لمعدلي؟', 'اقترح تعديلات على التسجيل التجريبي'];
            }
        } else if (gpa > 0 && gpa < 60) {
            personalMsg = `📊 معدلك **${gpa}%** — في مجال للتحسين!\nخليني أساعدك تختار مواد ترفع معدل الفصل الجاي.\n\n`;
            suggestedActions = ['أريد مواد سهلة لرفع معدلي', 'اقترح لي خطة متوازنة', 'كم ساعة أسجل هالفصل؟'];
        } else {
            personalMsg = `أقدر أساعدك بـ:\n* 📊 تحليل معدلك وساعاتك\n* 🛒 اقتراح مواد وإضافتها بضغطة\n* 📅 عرض التقويم الجامعي ومواعيد الامتحانات\n* ⏰ معرفة أوقات الشُعب المطروحة وأسماء الدكاترة\n* 📋 مراجعة التسجيل التجريبي وتخفيف العبء\n\n`;
            suggestedActions = ['اقترح لي مواد تفتح مواد أخرى', 'ما هو التقويم الجامعي هالفصل؟', 'مين دكاترة المواد المطروحة؟'];
        }

        return {
            id: 'welcome',
            role: 'ai',
            content: greeting + personalMsg + 'اختر من الأوامر السريعة أو اكتب سؤالك 👇',
            isAnimating: false,
            suggested_courses: [],
            courses_to_remove: [],
            follow_up_suggestions: suggestedActions,
            interactive_widget: null,
        };
    }, [st]);

    const [chats, setChats] = useState(initChats || []);
    const [activeId, setActiveId] = useState(null);
    const [msgs, setMsgs] = useState([welcome]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [generating, setGenerating] = useState(false);
    
    // Voice Recognition State
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);
    const voiceTimeoutRef = useRef(null);

    const stopListening = useCallback((abort = false) => {
        if (voiceTimeoutRef.current) {
            window.clearTimeout(voiceTimeoutRef.current);
            voiceTimeoutRef.current = null;
        }

        const recognition = recognitionRef.current;
        if (recognition) {
            try {
                abort ? recognition.abort() : recognition.stop();
            } catch {
                // Recognition may already be stopped; state still needs resetting.
            }
        }
        setIsListening(false);
    }, []);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'ar-SA';

            recognitionRef.current.onstart = () => {
                setIsListening(true);
                voiceTimeoutRef.current = window.setTimeout(() => stopListening(), 30000);
            };

            recognitionRef.current.onresult = (event) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; i++) {
                    currentTranscript += event.results[i][0].transcript;
                }
                if (currentTranscript.trim()) setInput(currentTranscript.trim());
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                setIsListening(false);
                if (event.error === 'not-allowed') {
                    Swal.fire({
                        icon: 'error',
                        title: 'صلاحية الميكروفون',
                        text: 'الرجاء إعطاء صلاحية استخدام الميكروفون للمتصفح.',
                        ...swal
                    });
                } else if (event.error === 'no-speech') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'لم يتم التقاط أي صوت',
                        text: 'لم يتمكن المتصفح من سماعك. يرجى التأكد من أن الميكروفون متصل ويعمل، أو حاول التحدث بصوت أعلى.',
                        ...swal
                    });
                }
            };

            recognitionRef.current.onend = () => {
                if (voiceTimeoutRef.current) {
                    window.clearTimeout(voiceTimeoutRef.current);
                    voiceTimeoutRef.current = null;
                }
                setIsListening(false);
            };
        }

        const stopForBackground = () => {
            if (document.hidden) stopListening(true);
        };
        window.addEventListener('pagehide', stopListening);
        document.addEventListener('visibilitychange', stopForBackground);

        return () => {
            window.removeEventListener('pagehide', stopListening);
            document.removeEventListener('visibilitychange', stopForBackground);
            stopListening(true);
            if (recognitionRef.current) {
                recognitionRef.current.onstart = null;
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
                recognitionRef.current = null;
            }
        };
    }, [stopListening]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            Swal.fire({
                icon: 'error',
                title: 'غير مدعوم',
                text: 'متصفحك لا يدعم خاصية التحدث الصوتي. الرجاء استخدام متصفح جوجل كروم.',
                ...swal
            });
            return;
        }

        if (isListening) {
            stopListening();
        } else {
            setInput('');
            try {
                recognitionRef.current.start();
            } catch {
                stopListening(true);
            }
        }
    };

    useEffect(() => {
        if (st && !st.has_academic_records) {
            Swal.fire({
                title: 'تنبيه هام! ⚠️',
                text: 'للحصول على أفضل تجربة وأدق إجابات من مرشد سنفور، يُرجى الذهاب إلى شجرة المواد أولاً وتحديد المواد التي أنهيتها مع علاماتك.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'الذهاب للشجرة',
                cancelButtonText: 'لاحقاً',
                ...swal
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = route('tree.index');
                }
            });
        }
    }, [st]);
    
    const [thinkingIndex, setThinkingIndex] = useState(0);
    const thinkingPhrases = [
        "🔎 جاري قراءة وتحليل سجلك الأكاديمي...",
        "⚖️ جاري موازنة المواد المتاحة للفصل القادم...",
        "💡 جاري استنباط أفضل مسار لرفع معدلك...",
        "⏳ جاري تجهيز الخطة الأنسب لك بناءً على القوانين...",
        "📝 جاري صياغة التقرير النهائي..."
    ];
    
    useEffect(() => {
        let interval;
        if (typing) {
            setThinkingIndex(0);
            interval = setInterval(() => {
                setThinkingIndex((prev) => (prev + 1) % thinkingPhrases.length);
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [typing]);
    const [loadingChat, setLoadingChat] = useState(false);
    const [sidebar, setSidebar] = useState(false);
    const [regenning, setRegenning] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
    const [showVideo, setShowVideo] = useState(false);

    // 🆕 State الساعات الديناميكية
    const [cartHours, setCartHours] = useState(st?.cart_hours || 0);

    // الأوامر السحرية
    const [showCommandMenu, setShowCommandMenu] = useState(false);
    const [commandFilter, setCommandFilter] = useState('');

    const [difficulty, setDifficulty] = useState(null); // 'easy', 'balanced', 'hard'
    const [criticalPath, setCriticalPath] = useState(false);
    const [wantsCode, setWantsCode] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState([]);
    const filterOptions = [
        { id: 'compulsory', label: 'إجباري' },
        { id: 'elective', label: 'اختياري' },
        { id: 'university_req', label: 'متطلب جامعة (أونلاين)' },
        { id: 'supporting', label: 'مساندة' },
    ];
    const toggleFilter = (id) => {
        setSelectedFilters(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    const magicCommands = [
        // أوامر الجدول
        { cmd: '/جدول', label: '🗓️ بناء جدول متكامل', message: 'ابنِ لي جدول متكامل للفصل الحالي يناسب معدلي', icon: '🗓️' },
        { cmd: '/صيفي', label: '☀️ اقتراح للصيفي', message: 'بناءً على المواد المطروحة هالفصل، شو أحسن مواد أنزلها؟', icon: '☀️' },
        { cmd: '/مواعيد', label: '⏰ مواعيد المواد', message: 'أعطني مواعيد المواد المطروحة التي يمكنني تسجيلها وهل هناك تعارض؟', icon: '⏰' },
        { cmd: '/تقويم', label: '📅 التقويم الجامعي', message: 'أعطني التقويم الجامعي للفصل الحالي ومواعيد السحب والإضافة والامتحانات', icon: '📅' },
        { cmd: '/رفع-معدل', label: '🚀 مواد لرفع المعدل', message: 'اقترح لي أسهل المواد المتاحة لرفع معدلي التراكمي', icon: '🚀' },
        { cmd: '/تجريبي', label: '🛒 تقييم الجدول التجريبي', message: 'راجع التسجيل التجريبي الحالي وقيّمه واقترح تعديلات عليه', icon: '🛒' },
        { cmd: '/حرج', label: '🚨 المسار الحرج', message: 'ما هي المواد الحرجة التي تفتح مواد أخرى ويجب أن أسجلها الآن؟', icon: '🚨' },
        { cmd: '/تخفيف', label: '😮‍💨 تخفيف العبء', message: 'حاسس العبء كبير، شو أحذف من التسجيل التجريبي؟', icon: '😮‍💨' },
        { cmd: '/تخرج', label: '🎓 خطة التخرج', message: 'كم فصل باقي على تخرجي وما هي المواد المتبقية؟', icon: '🎓' },
        
        // أوامر القوانين
        { cmd: '/غياب', label: '⏰ قوانين الغياب والحرمان', message: 'كم غياب مسموح لي قبل ما أنحرم من المادة؟ وما هي الأعذار المقبولة؟', icon: '⏰' },
        { cmd: '/إنذار', label: '⚠️ الإنذار الأكاديمي', message: 'متى بنزل لي إنذار أكاديمي؟ وشو الحد الأقصى للساعات المسموحة فيه؟', icon: '⚠️' },
        { cmd: '/إعادة', label: '🔄 شروط إعادة المواد', message: 'شو شروط إعادة المواد عشان أرفع معدلي التراكمي؟ وكيف تحسب العلامة؟', icon: '🔄' },
        { cmd: '/فصل', label: '⛔ الفصل من الجامعة', message: 'في أي حالة يتم فصلي من تخصصي بالجامعة؟', icon: '⛔' },
        { cmd: '/مدة', label: '⏳ مدة الدراسة', message: 'كم المدة القصوى المسموحة عشان أتخرج من الجامعة؟', icon: '⏳' },
        { cmd: '/مستوى', label: '📊 مستوى الطالب (سنة 2/3)', message: 'متى بتغير تصنيفي من سنة أولى لثانية وثالثة ورابعة؟', icon: '📊' },
        { cmd: '/غير-مكتمل', label: '🏥 الامتحان غير المكتمل', message: 'إذا غبت عن امتحان الفاينل بعذر مرضي، شو لازم أعمل؟ ومتى بتمتحن؟', icon: '🏥' },
        { cmd: '/انسحاب', label: '🚪 الانسحاب من المادة', message: 'إذا سحبت مادة بعد فترة السحب والإضافة، شو بنزل لي بكشف العلامات؟', icon: '🚪' }
    ];

    const initAdded = useMemo(() => { const s = {}; initialCartIds?.forEach(id => { s[id] = true; }); return s; }, [initialCartIds]);
    const [added, setAdded] = useState(initAdded);
    const [loadId, setLoadId] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const [showFiltersPopup, setShowFiltersPopup] = useState(false);

    const chatRef = useRef(null), inputRef = useRef(null), abortRef = useRef(null);
    const typewriterTimeoutRef = useRef(null);
    const isMobileViewport = viewportWidth < 1024;
    const scroll = useCallback(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, []);
    useEffect(() => { const t = setTimeout(scroll, 60); return () => clearTimeout(t); }, [msgs, typing]);

    useEffect(() => {
        return () => {
            if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const onResize = () => setViewportWidth(window.innerWidth);
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const finish = useCallback(() => {
        if (typewriterTimeoutRef.current) {
            clearTimeout(typewriterTimeoutRef.current);
            typewriterTimeoutRef.current = null;
        }
        setGenerating(false);
        setMsgs(p => p.map((m, i) => i === p.length - 1 && m.role === 'ai' && m.isAnimating ? { ...m, isAnimating: false } : m));
        setTimeout(scroll, 100);
    }, [scroll]);
    const newChat = useCallback(() => {
        stopListening(true);
        if (typewriterTimeoutRef.current) {
            clearTimeout(typewriterTimeoutRef.current);
            typewriterTimeoutRef.current = null;
        }
        setActiveId(null); setMsgs([welcome]); setInput(''); setGenerating(false); setTyping(false); setSidebar(false); setTimeout(() => inputRef.current?.focus(), 100);
    }, [welcome, stopListening]);

    const loadChat = useCallback(async (id) => {
        if (activeId === id) { setSidebar(false); return; }
        stopListening(true);
        setLoadingChat(true); setActiveId(id); setGenerating(false); setSidebar(false);
        try {
            const r = await axios.get(route('ai.advisor.messages', id));
            setMsgs(r.data.map(m => {
                let c = m.content, sc = [], cr = [], fu = [], iw = null;
                if (m.role === 'ai') { try { const p = JSON.parse(m.content); if (p.reply) { c = p.reply; sc = p.suggested_courses || []; cr = p.courses_to_remove || []; fu = p.follow_up_suggestions || []; iw = p.interactive_widget || null; } } catch { } }
                const safeText = typeof c === 'string' ? c : String(c ?? '');
                // Stored envelopes hold the original five keys only, so a reloaded
                // conversation carries no extra widgets — by design: those panels
                // describe the state at the time of the answer, which has moved on.
                return { id: m.id, role: m.role, content: safeText || 'ما وصلني رد واضح لهذه الرسالة.', suggested_courses: sc, courses_to_remove: cr, follow_up_suggestions: fu, interactive_widget: iw, widgets: [], confidence: null, isAnimating: false };
            }));
        } catch { setMsgs([{ id: 'err', role: 'ai', content: 'خطأ بتحميل المحادثة.', isAnimating: false }]); }
        finally { setLoadingChat(false); setTimeout(scroll, 150); }
    }, [activeId, scroll, stopListening]);

    const send = useCallback(async (text) => {
        const t = text?.trim();
        if (!t || generating || typing) return;
        stopListening();

        if (t.startsWith('/')) {
            const matchedCmd = magicCommands.find(c => c.cmd === t || t.startsWith(c.cmd));
            if (matchedCmd) {
                setShowCommandMenu(false);
                setCommandFilter('');
                send(matchedCmd.message);
                return;
            }
        }
        setShowCommandMenu(false);
        setCommandFilter('');

        setInput(''); setSidebar(false);
        const userMsgId = `u-${Date.now()}`;
        setMsgs(p => {
            const filtered = p.filter(m => m.id !== 'welcome');
            return [...filtered, { id: userMsgId, role: 'user', content: t }];
        });
        setTyping(true);

        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        const signal = abortRef.current.signal;

        const basePayload = { message: t, filters: selectedFilters, difficulty, critical_path: criticalPath, wants_code: wantsCode };
        if (activeId) basePayload.chat_id = activeId;

        // Shared tail for both transports: limits, cart refresh, chat list bookkeeping.
        const applyMeta = (data) => {
            if (data.has_daily_limit !== undefined) setHasDailyLimit(!!data.has_daily_limit);
            if (data.daily_messages_remaining !== undefined) setRemaining(data.daily_messages_remaining);
            setIsFallback(!!data.is_fallback);

            if (data.refresh_cart) router.reload({ only: ['initialCartIds', 'studentStats'] });

            if (!activeId && data.chat_id) {
                setActiveId(data.chat_id);
                setChats(p => p.some(c => c.id === data.chat_id) ? p : [{ id: data.chat_id, title: data.chat_title || t.substring(0, 40) + '...', created_at: new Date().toISOString() }, ...p]);
            } else if (data.chat_title && data.chat_id) {
                setChats(p => p.map(c => c.id === data.chat_id ? { ...c, title: data.chat_title } : c));
            }
        };

        const aiId = `ai-${Date.now()}`;
        let streamedChatId = null;   // chat the stream created, so a retry reuses it
        let streamedText = '';       // what the student already saw

        // ── 1. Streaming transport (SSE) ────────────────────────────────────────
        // Falls through to the blocking endpoint on any failure; that endpoint owns
        // the local-fallback reply, so nothing is lost by trying this first.
        try {
            const res = await fetch(route('ai.advisor.stream'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream', 'X-CSRF-TOKEN': csrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify(basePayload),
                credentials: 'same-origin',
                signal,
            });

            const isSse = (res.headers.get('content-type') || '').includes('text/event-stream');

            if (!res.ok || !isSse || !res.body) {
                // A quota/rate-limit answer is final — don't retry it as a normal send.
                if (res.status === 429) {
                    const j = await res.json().catch(() => null);
                    setTyping(false);
                    if (j?.daily_messages_remaining !== undefined) setRemaining(j.daily_messages_remaining);
                    if (j?.has_daily_limit !== undefined) setHasDailyLimit(!!j.has_daily_limit);
                    setMsgs(p => [...p, { id: `e-${Date.now()}`, role: 'ai', content: j?.message || 'وصلت للحد المسموح من الرسائل.', isAnimating: false }]);
                    setTimeout(scroll, 100);
                    return;
                }
                throw new Error('stream_unavailable');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finished = false;

            while (!finished) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                let cut;
                while ((cut = buffer.indexOf('\n\n')) !== -1) {
                    const { event, data } = parseSseFrame(buffer.slice(0, cut));
                    buffer = buffer.slice(cut + 2);

                    if (event === 'open') {
                        streamedChatId = data?.chat_id ?? null;
                        continue;
                    }

                    if (event === 'delta' && data?.text) {
                        const firstChunk = streamedText === '';
                        streamedText += data.text;

                        if (firstChunk) {
                            setTyping(false);
                            setGenerating(true);
                            // isAnimating stays false: the text is already arriving
                            // progressively, so the typewriter would double-animate it.
                            setMsgs(p => [...p, { id: aiId, role: 'ai', content: streamedText, isAnimating: false, isStreaming: true }]);
                        } else {
                            setMsgs(p => p.map(m => m.id === aiId ? { ...m, content: streamedText } : m));
                        }
                        scroll();
                        continue;
                    }

                    if (event === 'done' && data) {
                        finished = true;
                        setTyping(false);
                        setGenerating(false);
                        applyMeta(data);

                        const finalReply = typeof data.reply === 'string' && data.reply.trim() ? data.reply : (streamedText || 'ما وصلني رد واضح.');
                        const payload = {
                            id: aiId,
                            role: 'ai',
                            content: finalReply,
                            suggested_courses: data.suggested_courses || [],
                            courses_to_remove: data.courses_to_remove || [],
                            follow_up_suggestions: data.follow_up_suggestions || [],
                            interactive_widget: data.interactive_widget || null,
                            // Optional enhancement fields: absent on an older reply.
                            widgets: data.widgets || [],
                            confidence: data.confidence || null,
                            isAnimating: false,
                            isStreaming: false,
                        };
                        setMsgs(p => p.some(m => m.id === aiId) ? p.map(m => m.id === aiId ? payload : m) : [...p, payload]);
                        setTimeout(scroll, 100);
                        return;
                    }

                    if (event === 'error') {
                        streamedChatId = data?.chat_id ?? streamedChatId;
                        throw new Error('stream_failed');
                    }
                }
            }

            // Connection ended without a `done` frame — treat as a failed stream.
            throw new Error('stream_incomplete');
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) { setTyping(false); return; }

            // Drop the half-written bubble; the retry renders the complete reply.
            if (streamedText) setMsgs(p => p.filter(m => m.id !== aiId));
            streamedText = '';
        }

        // ── 2. Blocking transport (JSON) ───────────────────────────────────────
        try {
            setTyping(true);
            const pl = { ...basePayload };
            if (streamedChatId) {
                // The stream already created the chat and stored this message.
                pl.chat_id = streamedChatId;
                pl.user_message_stored = true;
            }

            const res = await axios.post(route('ai.advisor.chat'), pl, { signal, timeout: 30000 });
            const data = res.data;
            setTyping(false);

            if (data.status === 'error') {
                if (data.daily_messages_remaining !== undefined) setRemaining(data.daily_messages_remaining);
                if (data.has_daily_limit !== undefined) setHasDailyLimit(!!data.has_daily_limit);
                setMsgs(p => [...p, { id: `e-${Date.now()}`, role: 'ai', content: data.message || 'خطأ غير متوقع.', isAnimating: false }]);
                return;
            }

            applyMeta(data);

            const safeReply = typeof data.reply === 'string' && data.reply.trim() ? data.reply : 'ما وصلني رد واضح.';
            setGenerating(true);
            if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
            typewriterTimeoutRef.current = setTimeout(() => setGenerating(false), 12000);

            setMsgs(p => [...p, {
                id: `ai-${Date.now()}`,
                role: 'ai',
                content: safeReply,
                suggested_courses: data.suggested_courses || [],
                courses_to_remove: data.courses_to_remove || [],
                follow_up_suggestions: data.follow_up_suggestions || [],
                interactive_widget: data.interactive_widget || null,
                widgets: data.widgets || [],
                confidence: data.confidence || null,
                isAnimating: true
            }]);
        } catch (err) {
            setTyping(false);
            if (axios.isCancel(err) || err?.name === 'AbortError') return;
            setMsgs(p => [...p, { id: `err-${Date.now()}`, role: 'ai', content: 'عذراً، حدث خطأ في الاتصال. حاول مرة أخرى.', isAnimating: false }]);
        } finally {
            setGenerating(false);
            setTimeout(scroll, 100);
        }
    }, [activeId, generating, typing, magicCommands, scroll, selectedFilters, difficulty, criticalPath, wantsCode, stopListening]);

    const handleSend = e => {
        e.preventDefault();
        stopListening();
        send(input);
    };
    const stop = useCallback(() => finish(), [finish]);

    // `mode` shapes the retry (shorter / fuller / a different angle / fresh data).
    // Passing nothing keeps the previous behaviour of simply asking again.
    const regen = useCallback(async (mode = null) => {
        if (!activeId || regenning || generating) return; setRegenning(true);
        setMsgs(p => { const c = [...p]; if (c.length > 0 && c[c.length - 1].role === 'ai') c.pop(); return c; }); setTyping(true);
        try {
            const r = await axios.post(route('ai.advisor.regenerate'), { chat_id: activeId, mode, filters: selectedFilters, difficulty, critical_path: criticalPath, wants_code: wantsCode });
            if (r.data.status === 'success') {
                const safeReply = typeof r.data.reply === 'string' && r.data.reply.trim()
                    ? r.data.reply
                    : 'ما وصلني رد واضح هذه المرة. جرّب إعادة السؤال.';
                setGenerating(true);
                if (r.data.daily_messages_remaining !== undefined) setRemaining(r.data.daily_messages_remaining);
                setMsgs(p => [...p, { id: `r-${Date.now()}`, role: 'ai', content: safeReply, suggested_courses: r.data.suggested_courses || [], courses_to_remove: r.data.courses_to_remove || [], follow_up_suggestions: r.data.follow_up_suggestions || [], interactive_widget: r.data.interactive_widget || null, widgets: r.data.widgets || [], confidence: r.data.confidence || null, isAnimating: true }]);
            }
        } catch { setMsgs(p => [...p, { id: `e-${Date.now()}`, role: 'ai', content: 'فشلت إعادة التوليد.', isAnimating: false }]); }
        finally { setTyping(false); setRegenning(false); }
    }, [activeId, regenning, generating, selectedFilters, difficulty, criticalPath, wantsCode]);

    // `reason` is optional: a bare thumbs-up/down posts exactly as it always did.
    const fb = useCallback(async (mid, r, reason = null) => {
        try {
            await axios.post(route('ai.advisor.feedback'), { message_id: mid, rating: r, ...(reason ? { reason } : {}) });
        } catch { }
    }, []);

    // Per-widget-type state for confirmed actions, so a plan panel can show its own
    // progress without the page re-rendering every message.
    const [actionStates, setActionStates] = useState({});

    const forgetMemory = useCallback(async () => {
        await axios.delete(route('ai.advisor.memory.forget'));
    }, []);

    // Collapse the grown textarea once it has been cleared (send, new chat, switch).
    useEffect(() => {
        if (input === '' && inputRef.current) inputRef.current.style.height = 'auto';
    }, [input]);

    /**
     * Run an action the student confirmed.
     *
     * The server re-reads their academic state and re-validates before writing, so
     * this only reports the outcome — it never decides it.
     */
    const runAction = useCallback(async (payload) => {
        if (!payload?.action) return;
        const key = payload.action === 'apply_semester_plan' ? 'semester_plan' : payload.action;

        setActionStates(p => ({ ...p, [key]: { pending: true } }));

        try {
            const r = await axios.post(route('ai.advisor.action'), payload);
            const data = r.data;

            if (data.target?.route) {
                // Navigation actions carry a route NAME, never a URL.
                setActionStates(p => ({ ...p, [key]: {} }));
                router.visit(route(data.target.route, data.target.params || {}));
                return;
            }

            if (data.refresh_cart) router.reload({ only: ['initialCartIds', 'studentStats'] });

            setActionStates(p => ({
                ...p,
                [key]: data.status === 'success'
                    ? { done: data.message || 'تمّت العملية.' }
                    : { error: data.message || 'لم يُنفَّذ الإجراء.' },
            }));
        } catch (err) {
            const message = err?.response?.status === 404
                ? 'هذه الميزة غير مفعّلة حالياً.'
                : 'تعذّر تنفيذ الإجراء. لم يتغيّر شيء في تسجيلك.';
            setActionStates(p => ({ ...p, [key]: { error: message } }));
        }
    }, []);

    const maxCartHours = Math.min(18, st?.max_allowed_hours ?? 18);

    // 🆕 تحديث دالة الـ Toggle لتدعم الساعات الديناميكية
    const toggle = useCallback(async (cid, cn, chours = 0) => {
        const hoursToAdd = Number(chours) || 0;
        const isAlreadyAdded = !!added[cid];
        if (!isAlreadyAdded && hoursToAdd > 0 && (cartHours + hoursToAdd) > maxCartHours) {
            Swal.fire({
                icon: 'warning',
                title: 'الحد الأقصى للتسجيل التجريبي',
                text: `لا يمكن تجاوز ${maxCartHours} ساعة. احذف مادة أولاً ثم جرّب الإضافة.`,
                ...swal,
            });
            return;
        }

        setLoadId(cid);
        try {
            const r = await axios.post(route('cart.toggle.single'), { course_id: cid });
            if (r.data.status === 'added') {
                setAdded(p => ({ ...p, [cid]: true }));
                setCartHours(prev => prev + Number(chours)); // 🆕 إضافة الساعات
                Swal.fire({ icon: 'success', title: 'أضيفت! 🚀', text: `"${cn}" بالتسجيل التجريبي.`, timer: 1500, showConfirmButton: false, ...swal });
            } else if (r.data.status === 'removed') {
                setAdded(p => ({ ...p, [cid]: false }));
                setCartHours(prev => Math.max(0, prev - Number(chours))); // 🆕 خصم الساعات
                Swal.fire({ icon: 'info', title: 'أزيلت', text: `"${cn}" شُطبت.`, timer: 1500, showConfirmButton: false, ...swal });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'تعذر الإضافة',
                text: error?.response?.data?.message || error?.response?.data?.msg || 'خطأ غير متوقع.',
                ...swal
            });
        } finally {
            setLoadId(null);
        }
    }, [added, cartHours, maxCartHours]);

    const delChat = useCallback(async (id, e) => { e.stopPropagation(); const r = await Swal.fire({ title: 'حذف المحادثة؟', icon: 'warning', showCancelButton: true, confirmButtonText: 'احذف', cancelButtonText: 'لا', ...swal }); if (r.isConfirmed) { try { await axios.delete(route('ai.advisor.delete', id)); setChats(p => p.filter(c => c.id !== id)); if (activeId === id) newChat(); } catch { } } }, [activeId, newChat]);
    const delAll = useCallback(async () => { if (!chats.length) return; const r = await Swal.fire({ title: `حذف ${chats.length} محادثة؟`, icon: 'warning', showCancelButton: true, confirmButtonText: 'احذف الكل', cancelButtonText: 'لا', ...swal }); if (r.isConfirmed) { try { await axios.delete(route('ai.advisor.delete.all')); setChats([]); newChat(); } catch { } } }, [chats.length, newChat]);

    useEffect(() => {
        const fn = e => {
            if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); newChat(); }
            if (e.key === 'Escape' && generating) stop();
            // إغلاق قائمة الأوامر بـ Esc
            if (e.key === 'Escape' && showCommandMenu) {
                setShowCommandMenu(false);
                setCommandFilter('');
            }
        };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [newChat, generating, stop, showCommandMenu]);

    const allCommandsBank = useMemo(() => [
        // أوامر الجداول والتسجيل (الأساسية)
        { text: "ابنِ لي جدول متكامل للفصل الحالي", icon: "🗓️", desc: "جدول ذكي", color: "blue" },
        { text: "بناءً على المطروح، شو أسجل للصيفي؟", icon: "☀️", desc: "مواد الصيفي", color: "amber" },
        { text: "اقترح لي أسهل مواد لرفع المعدل", icon: "🚀", desc: "رفع المعدل", color: "emerald" },
        { text: "راجع التسجيل التجريبي وقيّمه", icon: "🛒", desc: "تقييم التسجيل", color: "slate" },
        { text: "ما هي المواد الحرجة التي يجب تسجيلها الآن؟", icon: "🚨", desc: "المسار الحرج", color: "rose" },
        
        // أسئلة من القوانين والأنظمة
        { text: "كم غياب مسموح لي قبل ما أنحرم من المادة؟", icon: "⏰", desc: "قوانين الغياب", color: "indigo" },
        { text: "متى بنزل لي إنذار أكاديمي؟ وشو بصير بعدها؟", icon: "⚠️", desc: "الإنذار الأكاديمي", color: "orange" },
        { text: "شو شروط إعادة المواد عشان أرفع معدلي التراكمي؟", icon: "🔄", desc: "إعادة المواد", color: "cyan" },
        { text: "كم فصل مسموح لي أأجل دراستي خلال الجامعة؟", icon: "⏸️", desc: "تأجيل الدراسة", color: "violet" },
        { text: "كم المدة القصوى المسموحة عشان أتخرج من الجامعة؟", icon: "⏳", desc: "مدة الدراسة", color: "fuchsia" },
        { text: "إذا غبت عن امتحان الفاينل بعذر مرضي، شو لازم أعمل؟", icon: "🏥", desc: "الامتحان غير المكتمل", color: "teal" },
        { text: "متى بتغير تصنيفي من سنة أولى لثانية وثالثة؟", icon: "📊", desc: "مستوى الطالب", color: "sky" },
        { text: "إذا سحبت مادة بعد السحب والإضافة، شو بنزل لي بكشف العلامات؟", icon: "🚪", desc: "الانسحاب", color: "pink" }
    ], []);

    const cmds = useMemo(() => {
        const shuffled = [...allCommandsBank].sort(() => 0.5 - Math.random());
        // نضمن دائماً ظهور خيار "بناء جدول" أو خيار متعلق بالتسجيل لتشجيع استخدام الودجت
        const coreCommand = shuffled.find(c => c.desc === "جدول ذكي" || c.desc === "تقييم التسجيل") || shuffled[0];
        const others = shuffled.filter(c => c !== coreCommand).slice(0, 3);
        return [coreCommand, ...others].sort(() => 0.5 - Math.random());
    }, [allCommandsBank, activeId]); // Update random suggestions whenever a chat is opened/closed

    const grouped = useMemo(() => {
        const n = new Date(), td = new Date(n.getFullYear(), n.getMonth(), n.getDate()), yd = new Date(td); yd.setDate(yd.getDate() - 1); const wk = new Date(td); wk.setDate(wk.getDate() - 7);
        const g = { today: [], yesterday: [], week: [], older: [] };
        chats.forEach(c => { const d = new Date(c.created_at); if (d >= td) g.today.push(c); else if (d >= yd) g.yesterday.push(c); else if (d >= wk) g.week.push(c); else g.older.push(c); }); return g;
    }, [chats]);
    const addedCount = useMemo(() => Object.values(added).filter(Boolean).length, [added]);
    const lastAi = useMemo(() => { for (let i = msgs.length - 1; i >= 0; i--)if (msgs[i].role === 'ai' && msgs[i].id !== 'welcome') return msgs[i].id; return null; }, [msgs]);

    const ChatItem = ({ c }) => (
        <div className="relative group/i">
            <button onClick={() => loadChat(c.id)} className={`w-full text-right p-2.5 rounded-xl transition-all flex items-center gap-2 ${activeId === c.id ? 'bg-blue-50 border border-blue-200/50' : 'hover:bg-slate-50 border border-transparent'}`}>
                <span className={`text-[10.5px] font-bold truncate flex-1 ${activeId === c.id ? 'text-blue-700' : 'text-slate-500'}`}>{c.title}</span>
            </button>
            <button onClick={e => delChat(c.id, e)} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/i:opacity-100 p-1 hover:bg-red-50 rounded transition-all text-[10px] text-red-400">✕</button>
        </div>
    );
    const Grp = ({ label, items }) => items.length === 0 ? null : <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-wider px-2.5 pt-2 pb-1">{label}</p>{items.map(c => <ChatItem key={c.id} c={c} />)}</div>;

    const FiltersUI = (
        <div className="bg-white p-2 shrink-0 relative overflow-hidden">
            {/* Sparkle background decoration */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 space-y-4">
                {/* 1. نوع المواد */}
                <div>
                    <h3 className="font-black text-slate-600 text-[10px] mb-2 px-1 flex items-center gap-1.5"><span className="text-sm">⚙️</span> نوع المواد</h3>
                    <div className="flex flex-wrap gap-1.5">
                        {filterOptions.map(opt => (
                            <button key={opt.id} type="button" onClick={() => toggleFilter(opt.id)} className={`px-2.5 py-1.5 text-[10.5px] font-bold rounded-xl transition-all duration-200 border flex-grow text-center ${selectedFilters.includes(opt.id) ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white border-transparent shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                {selectedFilters.includes(opt.id) && <span className="me-1 text-sky-400">✓</span>} {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. خيارات ذكية */}
                <div className="pt-3 border-t border-slate-100/80">
                    <h3 className="font-black text-blue-700 text-[10px] mb-2 px-1 flex items-center gap-1.5"><span className="text-sm">✨</span> إعدادات ذكية (AI)</h3>

                    <div className="space-y-2.5">
                        {/* المسار الحرج */}
                        <button type="button" onClick={() => setCriticalPath(!criticalPath)} className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${criticalPath ? 'bg-amber-50 border-amber-300 shadow-sm shadow-amber-200/30' : 'bg-white border-slate-100 hover:border-amber-200 hover:bg-amber-50/30'}`}>
                            <div className="flex items-center gap-2 text-right">
                                <span className={`text-lg transition-transform ${criticalPath ? 'scale-110' : 'grayscale opacity-60'}`}>🔑</span>
                                <div>
                                    <p className={`text-[11px] font-black ${criticalPath ? 'text-amber-700' : 'text-slate-600'}`}>المسار الحرج (تفتح مواد)</p>
                                    <p className="text-[8.5px] text-slate-400 font-bold mt-0.5">ركز لي على المواد اللي بتفتحلي مجالات قدام</p>
                                </div>
                            </div>
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${criticalPath ? 'bg-amber-500' : 'bg-slate-200'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-sm transition-transform ${criticalPath ? 'translate-x-[-16px]' : 'translate-x-0'}`} />
                            </div>
                        </button>

                        {/* وضع الأكواد */}
                        <button type="button" onClick={() => setWantsCode(!wantsCode)} className={`w-full flex items-center justify-between p-2.5 rounded-xl border-2 transition-all ${wantsCode ? 'bg-sky-50 border-sky-300 shadow-sm shadow-sky-200/30' : 'bg-white border-slate-100 hover:border-sky-200 hover:bg-sky-50/30'}`}>
                            <div className="flex items-center gap-2 text-right">
                                <span className={`text-lg transition-transform ${wantsCode ? 'scale-110' : 'grayscale opacity-60'}`}>💻</span>
                                <div>
                                    <p className={`text-[11px] font-black ${wantsCode ? 'text-sky-700' : 'text-slate-600'}`}>وضع الأكواد البرمجية</p>
                                    <p className="text-[8.5px] text-slate-400 font-bold mt-0.5">جهز لي الأكواد في صندوق احترافي</p>
                                </div>
                            </div>
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${wantsCode ? 'bg-sky-500' : 'bg-slate-200'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-sm transition-transform ${wantsCode ? 'translate-x-[-16px]' : 'translate-x-0'}`} />
                            </div>
                        </button>



                        {/* مستوى صعوبة الجدول */}
                        <div className="bg-white border border-slate-100 rounded-xl p-1 flex">
                            {[
                                { id: 'easy', label: 'سهل (رفع المعدل)', icon: '🌟', activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/50 shadow-sm' },
                                { id: 'balanced', label: 'متوازن', icon: '⚖️', activeClass: 'bg-blue-50 text-blue-700 border-blue-200/50 shadow-sm' },
                                { id: 'hard', label: 'صعب/دسم', icon: '🔥', activeClass: 'bg-rose-50 text-rose-700 border-rose-200/50 shadow-sm' }
                            ].map(lvl => {
                                const active = difficulty === lvl.id;
                                return (
                                    <button key={lvl.id} type="button" onClick={() => setDifficulty(active ? null : lvl.id)} className={`flex-1 py-1.5 px-1 rounded-lg text-[9px] font-black transition-all flex flex-col items-center justify-center gap-1 border ${active ? lvl.activeClass : 'border-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
                                        <span className={`text-xs ${active ? 'scale-110' : 'opacity-70 grayscale'} transition-all`}>{lvl.icon}</span>
                                        {lvl.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <MainLayout><Head>
            <title>المستشار الأكاديمي الذكي | سنفور</title>
            <meta name="description" content="مساعد ذكي داخل سنفور لتحليل وضعك الأكاديمي واقتراح مواد مناسبة بناءً على خطتك وسجلك." />
            <meta name="robots" content="noindex,nofollow,noarchive" />
            <link rel="canonical" href={`${siteUrl}/ai-advisor`} />
        </Head>
            <style dangerouslySetInnerHTML={{
                __html: `
            :root { --sfr-primary: #3b82f6; --sfr-accent: #6366f1; }
            .sfr-scrollbar::-webkit-scrollbar { width: 4px; }
            .sfr-scrollbar::-webkit-scrollbar-thumb { background: rgba(59,130,246,.2); border-radius: 10px; }
            .sfr-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,.4); }
            .typing-dot { animation: sfr-bounce 1.4s infinite ease-in-out both; }
            .typing-dot:nth-child(1) { animation-delay: -.32s; }
            .typing-dot:nth-child(2) { animation-delay: -.16s; }
            @keyframes sfr-bounce { 0%,80%,100% { transform: scale(.4); opacity: .25; } 40% { transform: scale(1); opacity: 1; } }
            /* ===== AI reply typography =====
               One rhythm for the whole reply: body text stays quiet, emphasis is
               weight-based (no chips), and structure comes from the section cards. */
            .sfr-md { font-size: 12.75px; color: #334155; }
            .sfr-md > * + * { margin-top: .7rem; }
            .sfr-md p { margin: 0 0 .55rem; line-height: 1.9; }
            .sfr-md > .sfr-intro > :last-child, .sfr-md p:last-child { margin-bottom: 0; }
            .sfr-md strong { font-weight: 800; color: #0f172a; }
            .sfr-md em { font-style: normal; font-weight: 700; color: #1d4ed8; }
            .sfr-md .sfr-sub { font-weight: 800; color: #1e293b; font-size: 12.5px; margin: .8rem 0 .35rem; }
            .sfr-md .sfr-hr { height: 1px; background: #e9eef5; margin: .9rem 0; }
            .sfr-md .sfr-link { color: #1d4ed8; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
            .sfr-md .sfr-quote { border-inline-start: 3px solid #cbd5e1; padding: .1rem .8rem; color: #64748b; font-weight: 600; margin: .6rem 0; }

            /* Lists: single quiet marker, generous line-height, no nested cards. */
            .sfr-md ul, .sfr-md ol { list-style: none; padding: 0; margin: .45rem 0 .55rem; }
            .sfr-md li { position: relative; padding-inline-start: 1.05rem; margin-bottom: .45rem; line-height: 1.85; color: #3f4c5f; }
            .sfr-md li:last-child { margin-bottom: 0; }
            .sfr-md li::before { content: ""; position: absolute; inset-inline-start: .2rem; top: .78em; width: 5px; height: 5px; border-radius: 50%; background: #94a3b8; }
            .sfr-md li > strong:first-child { color: #1d4ed8; }
            .sfr-md ol { counter-reset: sfr-ol; }
            .sfr-md ol > li { counter-increment: sfr-ol; padding-inline-start: 1.5rem; }
            .sfr-md ol > li::before { content: counter(sfr-ol); inset-inline-start: 0; top: .25em; width: 1.1rem; height: 1.1rem; border-radius: 6px; background: #eef2f7; color: #475569; font-size: 9.5px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
            .sfr-md li ul, .sfr-md li ol { margin: .35rem 0 0; }

            /* ===== Sections ===== */
            .sfr-md .sfr-sec { border: 1px solid #e6ebf2; border-radius: 14px; background: #fff; overflow: hidden; }
            .sfr-md .sfr-sec__head { display: flex; align-items: center; gap: .5rem; padding: .55rem .8rem; border-bottom: 1px solid #eef2f7; background: #fafbfd; }
            .sfr-md .sfr-sec__icon { font-size: 13px; line-height: 1; width: 22px; height: 22px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: #fff; border: 1px solid #e6ebf2; }
            .sfr-md .sfr-sec__title { margin: 0; font-size: 12px; font-weight: 900; color: #334155; letter-spacing: 0; }
            .sfr-md .sfr-sec__body { padding: .8rem .85rem; }
            .sfr-md .sfr-sec--summary { border-color: #d7e5fb; }
            .sfr-md .sfr-sec--summary .sfr-sec__head { background: #f3f8ff; border-bottom-color: #e2ecfd; }
            .sfr-md .sfr-sec--summary .sfr-sec__title { color: #1d4ed8; }
            .sfr-md .sfr-sec--tip { border-color: #f6e4bf; }
            .sfr-md .sfr-sec--tip .sfr-sec__head { background: #fffaf0; border-bottom-color: #f8ead0; }
            .sfr-md .sfr-sec--tip .sfr-sec__title { color: #92610a; }
            .sfr-md .sfr-sec--warn { border-color: #f7d7d7; }
            .sfr-md .sfr-sec--warn .sfr-sec__head { background: #fff5f5; border-bottom-color: #fadede; }
            .sfr-md .sfr-sec--warn .sfr-sec__title { color: #b42323; }
            .sfr-md .sfr-sec--legal { border-color: #e0dcfa; }
            .sfr-md .sfr-sec--legal .sfr-sec__head { background: #f7f5ff; border-bottom-color: #e8e4fb; }
            .sfr-md .sfr-sec--legal .sfr-sec__title { color: #4c37c4; }
            .sfr-md .sfr-sec--date .sfr-sec__title, .sfr-md .sfr-sec--plan .sfr-sec__title { color: #0f172a; }

            /* ===== Tables ===== */
            .sfr-md .sfr-table-wrap { overflow-x: auto; border: 1px solid #e6ebf2; border-radius: 12px; }
            .sfr-md table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
            .sfr-md th, .sfr-md td { padding: .5rem .6rem; text-align: start; border-bottom: 1px solid #eef2f7; }
            .sfr-md th { background: #f6f8fc; color: #334155; font-weight: 900; font-size: 11px; }
            .sfr-md tr:last-child td { border-bottom: 0; }
            .sfr-md tbody tr:nth-child(even) td { background: #fcfdfe; }

            /* ===== Code ===== */
            .sfr-md .sfr-code-inline { background: #f1f5f9; border: 1px solid #e2e8f0; color: #be185d; padding: .05rem .3rem; border-radius: 5px; font-family: ui-monospace, monospace; font-size: 11.5px; font-weight: 700; }
            .sfr-md .sfr-code { border-radius: 12px; overflow: hidden; background: #0d1117; border: 1px solid #1f2937; }
            .sfr-md .sfr-code__bar { display: flex; align-items: center; justify-content: space-between; padding: .35rem .7rem; background: #161b22; border-bottom: 1px solid #1f2937; }
            .sfr-md .sfr-code__lang { font-size: 10px; font-weight: 800; color: #8b98a8; text-transform: uppercase; letter-spacing: .1em; }
            .sfr-md .sfr-code__copy { font-size: 10px; font-weight: 800; color: #cbd5e1; background: rgba(148,163,184,.16); padding: .15rem .5rem; border-radius: 6px; cursor: pointer; }
            .sfr-md .sfr-code__copy:hover { background: rgba(148,163,184,.3); color: #fff; }
            .sfr-md .sfr-code__body { padding: .8rem; overflow-x: auto; }
            .sfr-md .sfr-code__body code { color: #e6edf3; font-family: ui-monospace, monospace; font-size: 12px; line-height: 1.75; display: block; white-space: pre; }

            /* Caret shown while the reply is still streaming in. */
            .sfr-caret { display: inline-block; width: 2px; height: 13px; background: var(--sfr-primary); margin-inline-start: 2px; vertical-align: -2px; animation: sfr-blink 1s steps(2, start) infinite; }
            @keyframes sfr-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

            /* Blocks appended under a reply (courses, widgets, follow-ups). */
            .sfr-attach { margin-top: .9rem; padding-top: .7rem; border-top: 1px solid #eef2f7; }
            .sfr-attach__label { font-size: 10px; font-weight: 900; margin-bottom: .5rem; }

            /* ===== Course row — one shared shape for add / remove / review ===== */
            .sfr-crow { width: 100%; display: flex; align-items: center; gap: .6rem; padding: .6rem .7rem; border: 1px solid #e6ebf2; border-radius: 12px; background: #fff; text-align: start; transition: border-color .18s, background .18s, box-shadow .18s; }
            .sfr-crow:not(.sfr-crow--static) { cursor: pointer; }
            .sfr-crow:not(.sfr-crow--static):hover { box-shadow: 0 2px 10px rgba(15,23,42,.06); }
            .sfr-crow:not(.sfr-crow--static):active { transform: scale(.995); }
            .sfr-crow.is-loading { opacity: .55; cursor: wait; }
            .sfr-crow__mark { width: 22px; height: 22px; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; background: #f1f5f9; color: #475569; flex-shrink: 0; }
            .sfr-crow__name { font-size: 12px; font-weight: 800; color: #0f172a; flex: 1; min-width: 0; }
            .sfr-crow--static .sfr-crow__name { flex: initial; }
            .sfr-crow__hours { font-size: 9.5px; font-weight: 800; color: #64748b; background: #f1f5f9; padding: .1rem .35rem; border-radius: 5px; flex-shrink: 0; }
            .sfr-crow__cta { font-size: 10px; font-weight: 900; padding: .2rem .55rem; border-radius: 7px; flex-shrink: 0; }
            .sfr-crow--add { border-color: #dbe7fb; background: #f8fbff; }
            .sfr-crow--add:hover { border-color: #9dc2f8; background: #f2f8ff; }
            .sfr-crow--add .sfr-crow__mark { background: #e5efff; color: #1d4ed8; }
            .sfr-crow--add .sfr-crow__cta { background: #e5efff; color: #1d4ed8; }
            .sfr-crow--added { border-color: #cdeade; background: #f6fdf9; }
            .sfr-crow--added .sfr-crow__mark { background: #dcf5e8; color: #077a4b; }
            .sfr-crow--added .sfr-crow__cta { background: #eaf7f0; color: #0a7048; }
            .sfr-crow--warn { border-color: #f6e4bf; background: #fffcf5; }
            .sfr-crow--warn .sfr-crow__mark { background: #fdf0d5; color: #92610a; }
            .sfr-crow--remove { border-color: #f7d7d7; background: #fffafa; }
            .sfr-crow--remove:hover { border-color: #ef9a9a; }
            .sfr-crow--remove .sfr-crow__mark { background: #fde8e8; color: #b42323; }
            .sfr-crow--remove .sfr-crow__cta { background: #fde8e8; color: #b42323; }
            .sfr-crow__cta--add { background: #e5efff; color: #1d4ed8; }
            .sfr-crow__cta--add:hover { background: #1d4ed8; color: #fff; }
            .sfr-crow__cta--danger { background: #e11d48; color: #fff; }
            .sfr-crow__cta--danger:hover { background: #be123c; }
            .sfr-crow__cta--ghost { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
            .sfr-crow__cta--ghost:hover { background: #fef2f2; color: #b42323; border-color: #fadede; }
            .sfr-badge { font-size: 9px; font-weight: 900; padding: .15rem .45rem; border-radius: 6px; flex-shrink: 0; }
            .sfr-badge--blue { background: #e5efff; color: #1d4ed8; }
            .sfr-badge--green { background: #dcf5e8; color: #0a7048; }
            .sfr-badge--amber { background: #fdf0d5; color: #92610a; }
            .sfr-badge--rose { background: #fde8e8; color: #b42323; }
            .sfr-spin { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; display: inline-block; animation: sfr-rot .7s linear infinite; }
            @keyframes sfr-rot { to { transform: rotate(360deg); } }
            @keyframes sfr-su { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
            .sfr-slide-up { animation: sfr-su .3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes sfr-fu { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform: translateY(0); } }
            .sfr-fade-up { animation: sfr-fu .25s ease-out forwards; }
            @keyframes sfr-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,.2); } 50% { box-shadow: 0 0 0 5px rgba(59,130,246,0); } }
            .sfr-glow { animation: sfr-glow 3s infinite; }
            .sfr-action-btn { padding: 4px 6px; border-radius: 6px; font-size: 11px; transition: all .2s; cursor: pointer; color: #64748b; }
            .sfr-action-btn:hover { background: #f1f5f9; color: #334155; transform: scale(1.05); }
        ` }} />

            <div className="py-2.5 md:py-5 pb-5 lg:pb-0 bg-[#f8f9fb] min-h-screen font-t" dir="rtl">
                <div className="max-w-[1600px] mx-auto px-2.5 md:px-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 lg:gap-4 items-start">

                    {/* === Mobile Sidebar Overlay === */}
                    {sidebar && <div className="lg:hidden fixed inset-0 z-[100] flex">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSidebar(false)} />
                        <div className="relative w-[85%] max-w-[320px] bg-white h-full shadow-2xl overflow-y-auto p-4 space-y-4 sfr-scrollbar transition-transform translate-x-0 flex flex-col">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
                                <h3 className="font-black text-slate-800 text-[14px]">القائمة</h3>
                                <button onClick={() => setSidebar(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-500 transition-colors">✕</button>
                            </div>
                            
                            <div className="shrink-0 space-y-3">
                                <button onClick={() => { setSidebar(false); newChat(); }} className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white p-3 rounded-xl font-black text-[13px] shadow-md flex items-center justify-center gap-2 active:scale-[.97] transition-all">✨ محادثة جديدة</button>
                                
                                {proactiveInsights ? (
                                    <ProactiveBriefing insights={proactiveInsights} />
                                ) : st && (
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200/50 p-3.5">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center text-lg font-black text-blue-700 shrink-0 overflow-hidden">
                                                {st.avatar ? <img src={st.avatar} alt={st.name} className="w-full h-full object-cover" /> : st.name?.charAt(0) || 'أ'}
                                            </div>
                                            <div className="min-w-0"><p className="font-black text-[13px] text-slate-800 truncate">{st.name}</p><p className="text-[9px] text-slate-400 font-bold">{st.major || '—'}</p></div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {st.gpa != null && <div className="text-center bg-white rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase">المعدل %</p><p className="text-[14px] font-black text-blue-700">{st.has_academic_records ? `${st.gpa}%` : 'لا'}</p></div>}
                                            {st.hours_completed != null && <div className="text-center bg-white rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase">منجزة</p><p className="text-[14px] font-black text-sky-700">{st.hours_completed}</p></div>}
                                            {st.progress_percent != null && <div className="flex flex-col items-center bg-white rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">التخرج</p><Ring pct={st.progress_percent} size={28} s={2.5} /><p className="text-[8px] font-black text-slate-700 mt-0.5">{st.progress_percent}%</p></div>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col border-t border-slate-100 pt-3">
                                <h3 className="font-black text-slate-800 text-[13px] mb-2 shrink-0">📂 المحادثات السابقة</h3>
                                <div className="flex-1 overflow-y-auto space-y-1 sfr-scrollbar pr-1">
                                    {chats.length > 0 ? chats.map(c => <ChatItem key={c.id} c={c} />) : <p className="text-center text-slate-400 text-[11px] py-6 font-bold">📭 لا يوجد محادثات</p>}
                                </div>
                            </div>
                        </div>
                    </div>}

                    {/* === Sidebar === */}
                    <div className="hidden lg:flex flex-col gap-2.5 lg:sticky top-20 max-h-[calc(100vh-100px)]">
                        <button onClick={newChat} className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white p-3 rounded-2xl font-black text-[13px] shadow-md shadow-blue-500/30 flex items-center justify-center gap-2.5 active:scale-[.97] group transition-all">
                            <span className="group-hover:rotate-12 transition-transform">✨</span> محادثة جديدة
                        </button>

                        {/* What the advisor remembers, with a clear button. Renders
                            nothing when the memory feature is off or empty. */}
                        <MemoryPanel memory={aiMemory} onForget={forgetMemory} />

                        {/* Student Info Card / Briefing */}
                        {proactiveInsights ? (
                            <ProactiveBriefing insights={proactiveInsights} />
                        ) : st && (
                            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-3.5 shrink-0">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center text-lg font-black text-blue-700 shrink-0 overflow-hidden">
                                        {st.avatar ? <img src={st.avatar} alt={st.name} className="w-full h-full object-cover" /> : st.name?.charAt(0) || 'أ'}
                                    </div>
                                    <div className="min-w-0"><p className="font-black text-[13px] text-slate-800 truncate">{st.name}</p><p className="text-[9px] text-slate-400 font-bold">{st.major || '—'}</p></div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {st.gpa != null && <div className="text-center bg-slate-50/80 rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase">المعدل %</p><p className="text-[15px] font-black text-blue-700">{st.has_academic_records ? `${st.gpa}%` : 'لا يوجد بعد'}</p>{st.is_probation && <span className="text-[6px] bg-red-100 text-red-600 px-1 rounded font-black">إنذار</span>}</div>}
                                    {st.hours_completed != null && <div className="text-center bg-slate-50/80 rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase">منجزة</p><p className="text-[15px] font-black text-sky-700">{st.hours_completed}</p>{st.total_plan_hours && <p className="text-[7px] text-slate-400">/{st.total_plan_hours}</p>}</div>}
                                    {st.progress_percent != null && <div className="flex flex-col items-center bg-slate-50/80 rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">التخرج</p><Ring pct={st.progress_percent} size={32} s={3} /><p className="text-[9px] font-black text-slate-700 mt-0.5">{st.progress_percent}%</p></div>}
                                </div>
                                {addedCount > 0 && <div className="mt-2 bg-emerald-50/80 rounded-xl p-2 flex items-center gap-2"><span className="text-sm">🛒</span><p className="text-[10px] font-black text-emerald-700">{addedCount} مادة بالتسجيل التجريبي</p>{cartHours > 0 && <span className="mr-auto text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">{cartHours}س</span>}</div>}
                            </div>
                        )}

                        {/* Chat History */}
                        <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                            <div className="p-2.5 border-b border-slate-100/80 shrink-0 flex items-center justify-between">
                                <h3 className="font-black text-slate-600 text-[10px]">📂 المحادثات</h3>
                                {chats.length > 0 && <button onClick={delAll} className="text-[8px] text-red-400 hover:text-red-600 font-bold transition-colors">مسح الكل</button>}
                            </div>
                            <div className="flex-1 overflow-y-auto p-1.5 sfr-scrollbar">
                                {chats.length > 0 ? <><Grp label="اليوم" items={grouped.today} /><Grp label="أمس" items={grouped.yesterday} /><Grp label="هالأسبوع" items={grouped.week} /><Grp label="أقدم" items={grouped.older} /></> : <div className="py-8 flex flex-col items-center text-slate-400 opacity-40"><span className="text-xl">📭</span></div>}
                            </div>
                        </div>



                        <p className="text-[8px] text-slate-400 font-bold text-center"><kbd className="bg-slate-100 px-1 py-0.5 rounded text-[7px] font-mono">Ctrl+Shift+N</kbd> جديدة · <kbd className="bg-slate-100 px-1 py-0.5 rounded text-[7px] font-mono">Esc</kbd> إيقاف</p>
                    </div>

                    {/* === Chat === */}
                    <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm flex flex-col h-[calc(100dvh-85px)] sm:h-[calc(100dvh-85px)] lg:h-[calc(100vh-80px)] min-h-[420px] overflow-hidden relative">
                        {/* Header */}
                        <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100/70 bg-white shrink-0 flex items-center justify-between gap-2 z-20">
                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                <div className="relative shrink-0">
                                    <div className="w-10 h-10 bg-white border-2 border-blue-100 rounded-full flex items-center justify-center shadow-sm overflow-hidden sfr-glow"><img src="/images/aiwidget.png?v=2" alt="AI Widget" className="w-full h-full object-cover" onError={e => { e.target.outerHTML = '<span class="text-lg">🤖</span>'; }} /></div>
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-white rounded-full ${(isFallback || !isAiActive) ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-[15px] font-[900] text-slate-800 flex items-center gap-2 whitespace-nowrap">سنفور <span className={`text-[7px] ${(isFallback || !isAiActive) ? 'bg-rose-600' : 'bg-blue-600'} text-white px-1.5 py-0.5 rounded font-black tracking-wider uppercase`}>{(isFallback || !isAiActive) ? 'Local' : 'AI'}</span></h2>
                                    </div>
                                    {(isFallback || fallbackReason) && <p className="text-[8.5px] font-bold text-rose-500 mt-0.5 line-clamp-2">{fallbackReason === 'gemini_unavailable' ? 'المساعد السحابي غير متاح حالياً، لذلك نستخدم الوضع المحلي.' : fallbackReason === 'local_fallback_error' ? 'الفالباك المحلي احتاج معالجة إضافية.' : 'الوضع المحلي مفعل حالياً.'}</p>}
                                    <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1 truncate">
                                        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${typing || generating ? 'bg-amber-400' : ((isFallback || !isAiActive) ? 'bg-rose-400' : 'bg-emerald-400')} animate-pulse`} />
                                        {typing ? 'يحلل سؤالك...' : generating ? 'يكتب الرد...' : ((isFallback || !isAiActive) ? (isMobileViewport ? 'الوضع المحلي 🔴' : 'مستشار سنفور (الوضع المحلي) 🔴') : (isMobileViewport ? 'الوضع الذكي 🟢' : 'مستشار سنفور (الوضع الذكي) 🟢'))}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {isMobileViewport && (
                                    <button onClick={() => setSidebar(true)} className="md:hidden bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 w-8 h-8 flex items-center justify-center rounded-lg text-[14px] font-black active:scale-95 transition-all shadow-sm">☰</button>
                                )}
                                {isMobileViewport && (
                                    <button onClick={newChat} className="md:hidden bg-gradient-to-tr from-sky-400 to-blue-500 text-white w-8 h-8 flex items-center justify-center rounded-lg text-[14px] font-black active:scale-95 transition-all shadow-sm">✨</button>
                                )}
                                {st && <div className="hidden md:flex items-center gap-2">
                                    {st.gpa && <div className="bg-slate-50 rounded-lg px-3 py-1.5 text-center border border-slate-100"><p className="text-[7px] font-bold text-slate-400">GPA</p><p className="text-[13px] font-black text-blue-700">{st.gpa}</p></div>}
                                    {st.progress_percent != null && <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100"><Ring pct={st.progress_percent} size={24} s={2.5} /><span className="text-[10px] font-black text-slate-700">{st.progress_percent}%</span></div>}
                                    {/* 🆕 تحديث الساعات في Header لتكون ديناميكية */}
                                    {addedCount > 0 && <div className="bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-100"><span className="text-[10px] font-black text-emerald-700">🛒 {addedCount} مواد • {cartHours}س</span></div>}
                                </div>}
                                <button onClick={() => setShowHelp(true)} className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 flex items-center justify-center font-bold shadow-sm transition-all text-sm ml-1" title="دليل المساعدة">
                                    ؟
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div ref={chatRef} className="flex-1 overflow-y-auto p-3 md:p-5 pb-5 space-y-3 bg-[#fafbfc] sfr-scrollbar">
                            {loadingChat ? <div className="h-full flex flex-col items-center justify-center text-blue-400"><div className="w-7 h-7 border-[3px] border-blue-100 border-t-blue-600 rounded-full animate-spin mb-2" /><p className="font-bold text-[10px]">جاري التحميل...</p></div> : (
                                <div className="space-y-3">
                                    {!activeId && msgs.length === 1 && msgs[0].id === 'welcome' && (
                                        <WelcomeChat insights={proactiveInsights} st={st} onQuick={send} />
                                    )}
                                    {msgs.map(m => (!activeId && msgs.length === 1 && m.id === 'welcome') ? null : <Msg key={m.id} msg={m} name={st?.name} added={added} loading={loadId} onToggle={toggle} onDone={finish} scroll={scroll} isLast={m.id === lastAi} onRegen={regen} onFb={fb} onFollow={send} onAction={runAction} actionStates={actionStates} />)}
                                    {typing && <div className="flex justify-start items-end gap-2 sfr-slide-up"><div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-blue-50"><img src="/images/aiwidget.png?v=2" alt="AI Widget" className="w-full h-full object-cover" /></div><div className="bg-white border border-slate-200/50 p-3.5 rounded-2xl rounded-ss-sm shadow-sm flex gap-1.5 items-center"><div className="w-1.5 h-1.5 bg-blue-600 rounded-full typing-dot" /><div className="w-1.5 h-1.5 bg-blue-400 rounded-full typing-dot" /><div className="w-1.5 h-1.5 bg-sky-300 rounded-full typing-dot" />{regenning && <span className="text-[8px] text-slate-400 font-bold mr-1.5">يعيد...</span>}<span className="text-[12px] font-bold text-slate-500 animate-pulse transition-opacity duration-500 mr-2">{thinkingPhrases[thinkingIndex]}</span></div></div>}
                                </div>)}<div className="h-2" />
                        </div>

                        {generating && <div className="absolute bottom-[80px] left-1/2 -translate-x-1/2 z-30 sfr-fade-up"><button onClick={stop} className="bg-slate-900 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black shadow-xl flex items-center gap-1.5 transition-all active:scale-95"><span className="w-1.5 h-1.5 bg-white rounded-sm" />إيقاف</button></div>}

                        {/* Input */}
                        <div className="bg-white border-t border-slate-100/70 z-20 pb-[env(safe-area-inset-bottom)]">
                            {/* 🆕 قائمة الأوامر السحرية (تظهر عند كتابة /) */}
                            {showCommandMenu && (
                                <div className="px-3 py-2 border-b border-blue-100/50 bg-gradient-to-b from-blue-50/50 to-white max-h-[240px] overflow-y-auto">
                                    <p className="text-[9px] font-[800] text-blue-500 mb-2 px-1 flex items-center gap-1.5">⚡ أوامر سريعة — اكتب <kbd className="bg-blue-100 px-1 py-0.5 rounded text-[8px] font-mono">/</kbd> ثم اسم الأمر:</p>
                                    <div className="space-y-1">
                                        {magicCommands
                                            .filter(c => !commandFilter || c.cmd.includes(commandFilter) || c.label.includes(commandFilter))
                                            .map((c, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        setShowCommandMenu(false);
                                                        setCommandFilter('');
                                                        setInput('');
                                                        send(c.message);
                                                    }}
                                                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50 transition-all text-right group active:scale-[0.98]"
                                                >
                                                    <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">{c.icon}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] font-[800] text-blue-700">{c.label}</span>
                                                            <span className="text-[9px] font-mono text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">{c.cmd}</span>
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 font-bold truncate mt-0.5">{c.message}</p>
                                                    </div>
                                                    <span className="text-slate-300 text-[10px] shrink-0 group-hover:text-blue-500 transition-colors">↵</span>
                                                </button>
                                            ))
                                        }
                                        {magicCommands.filter(c => !commandFilter || c.cmd.includes(commandFilter) || c.label.includes(commandFilter)).length === 0 && (
                                            <p className="text-[10px] text-slate-400 font-bold text-center py-3">لا يوجد أمر مطابق. اكتب سؤالك مباشرة.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* الأوامر السريعة المربوطة بالـ Widgets (تظهر فقط بالبداية) */}
                            {msgs.length < 3 && !typing && !activeId && !generating && !showCommandMenu && (
                                <div className="px-3 py-3 border-b border-slate-100/50">
                                    <p className="text-[9.5px] font-black text-slate-400 mb-2 px-1">⚡ أوامر سريعة — كل واحد يفتح أداة تفاعلية مختلفة</p>
                                    {/* One column on the narrowest phones: two 140px cells cannot hold a
                                        full Arabic command without breaking every word. */}
                                    <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2">
                                        {cmds.map((cmd, i) => {
                                            const tone = cmdTone(cmd.color);
                                            return (
                                                <button key={i} onClick={() => send(cmd.text)} className={`flex items-start gap-2.5 p-3 border rounded-xl text-right transition-all active:scale-[.98] ${tone.card}`}>
                                                    <span className="text-lg shrink-0 mt-0.5">{cmd.icon}</span>
                                                    <div className="min-w-0">
                                                        <p className={`text-[11.5px] font-black leading-snug ${tone.title}`}>{cmd.text}</p>
                                                        <p className={`text-[9px] font-bold mt-0.5 ${tone.desc}`}>{cmd.desc}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* NOT overflow-x-hidden: setting overflow-x alone makes the
                                browser compute overflow-y as `auto`, which turns this into
                                a scroll container and CLIPS the settings popup that opens
                                above it — the popup rendered but was invisible. Horizontal
                                overflow is prevented by min-w-0/max-w-full on the children
                                instead. */}
                            <div className="relative z-50 max-w-full px-2 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:p-3">
                                {/* The popup overlay */}
                                {showFiltersPopup && (
                                    <div className="absolute bottom-[calc(100%+10px)] right-3 sm:right-6 w-[calc(100%-24px)] sm:w-[360px] bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-200/80 p-2 z-50 sfr-slide-up origin-bottom-right">
                                        <div className="flex justify-between items-center p-3 border-b border-slate-100/80 mb-2 bg-slate-50/50 rounded-2xl">
                                            <h3 className="font-black text-slate-800 text-[12px] flex items-center gap-1.5"><span className="text-sm">🎛️</span> التفضيلات والإعدادات الذكية</h3>
                                            <button type="button" onClick={() => setShowFiltersPopup(false)} className="w-7 h-7 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 font-black text-[10px] transition-colors shadow-sm">✕</button>
                                        </div>
                                        {FiltersUI}
                                    </div>
                                )}

                                {/* Click outside to close (invisible overlay) */}
                                {showFiltersPopup && (
                                    <div className="fixed inset-0 z-40" onClick={() => setShowFiltersPopup(false)} />
                                )}

                                <form onSubmit={handleSend} className="relative z-50 flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2">
                                    {/* Plus Button */}
                                    <button
                                        type="button"
                                        onClick={() => setShowFiltersPopup(!showFiltersPopup)}
                                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 shadow-sm transition-all duration-300 sm:h-12 sm:w-12 sm:rounded-2xl ${showFiltersPopup ? 'bg-slate-800 border-slate-800 text-white rotate-45 scale-95 shadow-inner' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-300 active:scale-95'}`}
                                        title="إعدادات الذكاء"
                                        aria-label="فتح إعدادات المحادثة"
                                        aria-expanded={showFiltersPopup}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </button>

                                    <div className="relative min-w-0 flex-1">
                                        {/* A textarea rather than an input: a long question used to
                                            scroll sideways inside a one-line field on a phone. It grows
                                            with the text up to a cap, then scrolls internally. */}
                                        <textarea
                                            ref={inputRef}
                                            rows={1}
                                            value={input}
                                            onKeyDown={e => {
                                                // Enter sends, Shift+Enter breaks the line. On a phone the
                                                // virtual keyboard's return key inserts a newline instead,
                                                // which is what the send button is for.
                                                if (e.key === 'Enter' && !e.shiftKey && !isMobileViewport) {
                                                    e.preventDefault();
                                                    if (input.trim() && !typing && !loadingChat && !generating && !limitReached) {
                                                        stopListening();
                                                        send(input);
                                                    }
                                                }
                                            }}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setInput(val);

                                                // Grow to fit, capped so the input never eats the chat.
                                                const el = e.target;
                                                el.style.height = 'auto';
                                                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;

                                                if (val.startsWith('/')) {
                                                    setShowCommandMenu(true);
                                                    setCommandFilter(val.slice(1));
                                                } else {
                                                    setShowCommandMenu(false);
                                                    setCommandFilter('');
                                                }
                                            }}
                                            // A long placeholder is unreadable on a phone — it just truncates mid-word.
                                            placeholder={limitReached ? (isMobileViewport ? '⚠️ انتهت محاولاتك اليوم' : '⚠️ لقد استهلكت محاولاتك اليومية المتاحة. عد غداً ⏳') : isListening ? 'جاري الاستماع...' : (isMobileViewport ? 'اسأل سنفور أي شيء...' : 'اسأل سنفور أي شيء، أو اكتب / للأوامر السريعة...')}
                                            // text-[16px] on mobile is deliberate: iOS Safari zooms the whole page when a
                                            // focused input is under 16px, which knocks the chat layout sideways.
                                            className={`w-full min-w-0 resize-none overflow-y-auto ${limitReached ? 'bg-red-50/50 border-red-200/50 text-red-800 placeholder-red-400' : 'bg-slate-50/70 border-slate-200/50 text-slate-800 placeholder-slate-400/60'} border-2 rounded-xl sm:rounded-2xl py-3 pr-3 sm:py-3.5 sm:pr-4 pl-[100px] focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-400 focus:bg-white transition-all font-bold text-[16px] sm:text-[13px] shadow-inner leading-relaxed`}
                                            style={{ maxHeight: '120px' }}
                                            disabled={typing || loadingChat || generating || limitReached}
                                            enterKeyHint="send"
                                            autoComplete="off"
                                        />
                                        {/* Anchored to the bottom, not vertically centred: the field
                                            grows upward as the question gets longer. */}
                                        <div className="absolute bottom-[7px] left-1 flex items-center gap-1 sm:bottom-[9px] sm:left-1.5">
                                            <button type="button" onClick={toggleListening} disabled={typing || loadingChat || generating || limitReached} className={`flex h-11 w-11 items-center justify-center rounded-lg border shadow-sm transition-all active:scale-[0.93] ${isListening ? 'border-red-300 bg-red-50 text-red-600 ring-2 ring-red-200 motion-safe:animate-pulse' : 'bg-white/80 text-slate-500 hover:bg-slate-200 hover:text-blue-600 border-slate-200/60'}`} title={isListening ? 'إيقاف الاستماع' : 'تحدث بالصوت'} aria-label={isListening ? 'إيقاف الاستماع' : 'بدء الإدخال الصوتي'} aria-pressed={isListening}>
                                                {isListening ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
                                                )}
                                            </button>
                                            <button type="submit" disabled={!input.trim() || typing || loadingChat || generating || limitReached} className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-tr from-sky-400 to-blue-500 text-white shadow-md shadow-blue-500/20 transition-all hover:from-sky-500 hover:to-blue-600 active:scale-[0.93] disabled:opacity-20" aria-label="إرسال الرسالة">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 rotate-180"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                                {/* Disclaimer strip. On a phone the full sentences wrapped into three
                                    ragged lines at 7.5px, so the wording shortens instead of shrinking. */}
                                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
                                    <span className="hidden sm:inline text-[9px] font-bold text-slate-400">النتائج استرشادية — سنفور بيحلل خطتك الحقيقية</span>
                                    <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="text-[9px] font-black text-amber-600 px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-full">
                                        <span className="sm:hidden">⚠️ تجريبي (Beta) · نتائج استرشادية</span>
                                        <span className="hidden sm:inline">⚠️ هذه الميزة تحت التجربة (Beta) وقد تكون بعض الاقتراحات غير دقيقة</span>
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${limitReached ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-700'}`}>
                                        {hasDailyLimit
                                            ? (limitReached ? '⚠️ انتهت رسائل اليوم' : (isMobileViewport ? `متبقٍ ${remaining}/5` : `الرسائل المتبقية لليوم: ${remaining}/5`))
                                            : '♾️ رسائل غير محدودة'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div></div>

            {showHelp && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 font-t" dir="rtl">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowHelp(false)} />
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col sfr-slide-up">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-sky-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">💡</div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-[16px]">دليل استخدام المرشد الذكي</h3>
                                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">كيف تستفيد من قدرات سنفور للحد الأقصى؟</p>
                                </div>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-red-50 hover:text-red-500 shadow-sm transition-colors text-sm font-bold">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 sm:p-6 sfr-scrollbar space-y-6">
                            {/* Section 1: Features */}
                            <div>
                                <h4 className="font-black text-blue-700 text-[13px] mb-3 flex items-center gap-2"><span className="text-lg">✨</span> قدرات المرشد الذكي</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <p className="font-black text-slate-800 text-[11px] mb-1">📅 التقويم ومواعيد المحاضرات</p>
                                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">يعرف سنفور التقويم الجامعي ومواعيد السحب والإضافة. كما أنه على اطلاع دائم بجميع الشُعب المطروحة، أوقاتها، وأسماء الدكاترة.</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <p className="font-black text-slate-800 text-[11px] mb-1">📊 تحليل أكاديمي دقيق</p>
                                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">سنفور يقرأ معدلك، عدد ساعاتك المنجزة، والمواد التي نجحت بها سابقاً ليبني لك خطة تتناسب 100% مع وضعك الأكاديمي.</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <p className="font-black text-slate-800 text-[11px] mb-1">🎓 خطة التخرج وإنقاذ المعدل</p>
                                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">يمكنه توجيهك لمعرفة المواد المتبقية لتخرجك، أو اقتراح أسهل المواد لرفع معدلك التراكمي إذا كنت تحت الإنذار.</p>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <p className="font-black text-slate-800 text-[11px] mb-1">🛒 ربط كامل بالتسجيل</p>
                                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">تستطيع سؤاله ليراجع التسجيل التجريبي الحالي الخاص بك وتخفيف العبء عنك، واقتراح بدائل مناسبة.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Magic Commands */}
                            <div>
                                <h4 className="font-black text-emerald-700 text-[13px] mb-3 flex items-center gap-2"><span className="text-lg">⚡</span> الأوامر السحرية ( / )</h4>
                                <p className="text-[11px] text-slate-600 font-bold mb-3 leading-relaxed">فقط اكتب علامة السلاش <kbd className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono mx-1">/</kbd> في صندوق المحادثة لفتح قائمة من الأوامر السريعة الجاهزة مثل:</p>
                                <div className="flex flex-wrap gap-2">
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">/جدول</span>
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">/صيفي</span>
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">/مواعيد</span>
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">/تقويم</span>
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">/رفع-معدل</span>
                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-lg text-[10px] font-black">/تخرج</span>
                                </div>
                            </div>

                            {/* Section 3: Smart Settings */}
                            <div>
                                <h4 className="font-black text-sky-700 text-[13px] mb-3 flex items-center gap-2"><span className="text-lg">⚙️</span> إعدادات الذكاء وتفضيلات الجدول</h4>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 bg-sky-50/30 rounded-xl p-3 border border-sky-100/50">
                                        <span className="text-xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">🔑</span>
                                        <div>
                                            <p className="font-black text-slate-800 text-[11px] mb-1">المسار الحرج (فتح مواد)</p>
                                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">عند تفعيل هذا الخيار، سيقوم الذكاء الاصطناعي بالبحث وإعطاء أولوية قصوى للمواد التي تفتح مجالات ومواد أخرى في خطتك (مثل المتطلبات السابقة لغيرها) لتضمن عدم تأخرك.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 bg-sky-50/30 rounded-xl p-3 border border-sky-100/50">
                                        <span className="text-xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">🌟</span>
                                        <div>
                                            <p className="font-black text-slate-800 text-[11px] mb-1">مستوى الصعوبة (سهل، متوازن، صعب)</p>
                                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">أخبر سنفور ما إذا كنت تريد مواد سهلة جداً لترفع معدلك، أو جدول متوازن لتوزيع الجهد، وسيبحث هو عن مستوى صعوبة كل مادة ويرتب جدولك بناءً عليها.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Widgets */}
                            <div>
                                <h4 className="font-black text-amber-600 text-[13px] mb-3 flex items-center gap-2"><span className="text-lg">🧩</span> الأدوات التفاعلية (Widgets)</h4>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 bg-amber-50/30 rounded-xl p-3 border border-amber-100/50">
                                        <span className="text-xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">➕</span>
                                        <div>
                                            <p className="font-black text-slate-800 text-[11px] mb-1">أزرار إضافة المواد بضغطة واحدة</p>
                                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">يقترح لك سنفور مواد على شكل بطاقات. بضغطة زر يمكنك إضافة المادة مباشرة لتسجيلك التجريبي بدون مغادرة المحادثة.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 bg-amber-50/30 rounded-xl p-3 border border-amber-100/50">
                                        <span className="text-xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">🎚️</span>
                                        <div>
                                            <p className="font-black text-slate-800 text-[11px] mb-1">مؤشر الساعات (Hours Slider)</p>
                                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">أداة مرئية تظهر لك الحد الأقصى والأدنى المسموح لك بتسجيله بناءً على معدلك الحالي، لتتأكد أنك ضمن الحدود المسموحة.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 bg-amber-50/30 rounded-xl p-3 border border-amber-100/50">
                                        <span className="text-xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">⚖️</span>
                                        <div>
                                            <p className="font-black text-slate-800 text-[11px] mb-1">بطاقات المقارنة والتصويت</p>
                                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">عندما تقارن بين عدة مواد، يعرضها لك في بطاقات منظمة مع ميزة التصويت، لتعرف رأي زملائك في كل مادة.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 bg-amber-50/30 rounded-xl p-3 border border-amber-100/50">
                                        <span className="text-xl bg-white w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">📋</span>
                                        <div>
                                            <p className="font-black text-slate-800 text-[11px] mb-1">تقييم التسجيل (Cart Review)</p>
                                            <p className="text-[10px] text-slate-500 font-bold leading-relaxed">أداة تقوم بفحص المواد الموجودة في تسجيلك التجريبي مادة بمادة، وتعطيك نصيحة مفصلة (احتفظ بها، احذفها، أو تحذير من الصعوبة) مع تقييم للعبء الإجمالي.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Video Help Button */}
            <button
                onClick={() => setShowVideo(true)}
                className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-40 group flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-emerald-600 text-white rounded-full shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5)] hover:shadow-[0_15px_35px_-5px_rgba(16,185,129,0.6)] hover:scale-110 hover:-translate-y-1 transition-all duration-300"
                style={{ direction: 'rtl' }}
            >
                <div className="absolute inset-0 rounded-full bg-emerald-400 blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300"></div>
                <svg className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5 relative z-10" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z" /></svg>
                
                {/* Tooltip */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-slate-900 text-white text-[11px] sm:text-sm font-bold rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 whitespace-nowrap translate-x-2 group-hover:translate-x-0 shadow-xl hidden sm:block">
                    كيف تستخدم الذكاء الاصطناعي؟
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
            </button>

            {/* Video Modal */}
            {showVideo && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 font-t" style={{ direction: 'rtl' }}>
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setShowVideo(false)}></div>
                    <div className="relative z-10 w-full max-w-5xl bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                            <h3 className="text-lg font-black text-white">دليل المرشد الذكي</h3>
                            <button onClick={() => setShowVideo(false)} className="w-8 h-8 rounded-full bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 bg-black" dir="ltr">
                            <React.Suspense fallback={<div className="h-64 flex items-center justify-center bg-slate-900"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}>
                                <VideoPlayer
                                    source={{
                                        type: 'video',
                                        title: 'AI Tutorial',
                                        sources: [
                                            {
                                                src: '/videos/ai-demo.mp4',
                                                type: 'video/mp4',
                                            }
                                        ],
                                        tracks: [
                                            {
                                                kind: 'chapters',
                                                label: 'Chapters',
                                                srclang: 'ar',
                                                src: '/videos/ai-chapters.vtt',
                                                default: true,
                                            }
                                        ]
                                    }}
                                    chapters={[
                                        { title: 'كيف اعمل جدول ؟', startTime: 0 },
                                        { title: 'تقييم الجدول', startTime: 33 }
                                    ]}
                                />
                            </React.Suspense>
                        </div>
                    </div>
                </div>
            )}

        </MainLayout>
    );
}
