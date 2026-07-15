import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Swal from 'sweetalert2';
const VideoPlayer = React.lazy(() => import('@/Components/VideoPlayer'));

// Resolve the deployment URL once for canonical metadata and stable links.
const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

// Shared SweetAlert configuration for advisor-side confirmations and alerts.
const swal = { confirmButtonColor: '#3b82f6', customClass: { popup: 'rounded-3xl font-t', title: 'font-t font-black', htmlContainer: 'font-t font-bold text-sm' } };

// Animate AI responses as they stream into the chat window.
const Typewriter = ({ content, isAnimating, onComplete, onScroll }) => {
    const [txt, setTxt] = useState('');
    const idx = useRef(0), raf = useRef(null), done = useRef(false);
    const safeContent = typeof content === 'string' ? content : String(content ?? '');
    useEffect(() => {
        if (!isAnimating) { setTxt(safeContent); done.current = true; return; }

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
    return (
        <div className="prose prose-sm prose-slate max-w-none rtl:prose-li:pl-0 rtl:prose-li:pr-2 prose-li:marker:text-blue-500 prose-p:leading-relaxed prose-strong:text-blue-800 prose-ul:my-2 prose-li:my-0.5 prose-table:border-collapse prose-table:w-full prose-th:bg-blue-50 prose-th:text-blue-800 prose-th:border prose-th:border-blue-200 prose-th:p-3 prose-td:border prose-td:border-slate-200 prose-td:p-3 prose-tr:even:bg-slate-50/50">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // The custom code renderer provides its own block container.
                    pre({ children }) {
                        return <>{children}</>;
                    },
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const text = String(children).replace(/\n$/, '');

                        const isBlock = !inline && (match || text.includes('\n'));
                        return isBlock ? (
                            <div className="relative my-4 rounded-xl overflow-hidden bg-[#0d1117] border border-slate-700/60 shadow-xl" dir="ltr">
                                <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-slate-700/60">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{match ? match[1] : 'CODE'}</span>
                                    <button
                                        onClick={(e) => {
                                            navigator.clipboard.writeText(text);
                                            const btn = e.currentTarget;
                                            const originalText = btn.innerHTML;
                                            btn.innerHTML = '✓ تم النسخ';
                                            btn.classList.add('text-emerald-400');
                                            setTimeout(() => {
                                                btn.innerHTML = originalText;
                                                btn.classList.remove('text-emerald-400');
                                            }, 2000);
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1 bg-slate-700/50 hover:bg-slate-600/80 px-2.5 py-1 rounded-md font-bold"
                                        title="نسخ الكود"
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                                <div className="p-4 overflow-x-auto" style={{ margin: 0 }}>
                                    <code className={`text-[13px] text-slate-50 font-mono leading-relaxed block ${className || ''}`} {...props}>
                                        {children}
                                    </code>
                                </div>
                            </div>
                        ) : (
                            <code className="bg-slate-100/80 border border-slate-200 text-pink-600 px-1.5 py-0.5 rounded-md font-mono text-[12px] font-bold mx-0.5" dir="ltr" {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
            >
                {txt}
            </ReactMarkdown>
        </div>
    );
};


// Reusable button used to add or remove suggested courses from the simulator cart.
const CourseButton = ({ course, isAdded, isLoading, onToggle, variant = 'add' }) => {
    const rm = variant === 'remove';
    if (!course || !course.id) return null;
    if (rm && !isAdded) return null;
    return (
        <div className="flex items-center gap-2 sfr-fade-up">
            {/* 🆕 تم تمرير الساعات هنا: course.credit_hours */}
            <button onClick={() => onToggle(course.id, course.name, course.credit_hours)} disabled={isLoading}
                className={`flex-1 font-black py-2.5 px-4 rounded-xl transition-all duration-200 flex justify-between items-center group/b text-[11.5px] ${rm ? 'bg-red-50 hover:bg-red-500 text-red-600 hover:text-white border border-red-200/60 hover:border-red-500' : isAdded ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-blue-50/70 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200/50 hover:border-blue-600 hover:shadow-lg hover:shadow-blue-200/30'} ${isLoading ? 'opacity-50' : ''}`}>
                <span className="flex items-center gap-2">
                    {isLoading ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : rm ? '🗑' : isAdded ? '✅' : <span className="group-hover/b:rotate-90 transition-transform inline-block text-sm">+</span>}
                    {rm ? `إزالة ${course.name}` : isAdded ? `${course.name} ✓` : `إضافة ${course.name}`}
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-black ${rm ? 'bg-red-200/60' : isAdded ? 'bg-emerald-200/60' : 'bg-white/80 group-hover/b:bg-white/20'}`}>{course.credit_hours}س</span>
            </button>
        </div>
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
                borderClass: 'border-blue-200 bg-blue-50/40',
                icon: '💡',
                badge: { text: 'أضفها', bg: 'bg-blue-100 text-blue-700' },
                reason: c.reason || 'مادة مقترحة من المرشد الذكي',
            };
        }

        // المادة موجودة بالتسجيل التجريبي → نثق بـ verdict الـ AI
        if (c.verdict === 'remove') {
            return {
                type: 'remove_from_cart',    // مادة سيئة، الـ AI يطلب حذفها
                borderClass: 'border-red-200 bg-red-50/40',
                icon: '🗑️',
                badge: { text: 'احذفها', bg: 'bg-red-200 text-red-800' },
                reason: c.reason || 'ينصح المرشد بإزالتها لتخفيف العبء',
            };
        }
        if (c.verdict === 'warning') {
            return {
                type: 'warning_in_cart',     // مادة فيها تحفظ
                borderClass: 'border-amber-200 bg-amber-50/40',
                icon: '⚠️',
                badge: { text: 'انتبه', bg: 'bg-amber-200 text-amber-800' },
                reason: c.reason || 'راقب هذه المادة',
            };
        }
        // verdict === 'keep' أو أي قيمة أخرى
        return {
            type: 'keep_in_cart',            // مادة جيدة، أبقِها
            borderClass: 'border-emerald-200 bg-emerald-50/40',
            icon: '✅',
            badge: { text: 'أبقِها', bg: 'bg-emerald-200 text-emerald-800' },
            reason: c.reason || 'مادة مناسبة لجدولك',
        };
    };

    return (
        <div className="mt-4 pt-3 border-t border-slate-200/40 sfr-fade-up">
            <p className="text-[10px] font-black text-slate-600 mb-3">📋 {widget.title || 'مراجعة التسجيل التجريبي'}</p>
            {s.recommendation && (
                <div className="bg-gradient-to-l from-slate-50 to-blue-50/30 rounded-xl p-3 mb-3 border border-slate-200/50 flex items-center justify-between transition-all">
                    <div className="flex gap-5">
                        <div className="text-center">
                            <p className="text-[7px] font-bold text-slate-400 uppercase">الساعات</p>
                            <p className={`text-lg font-black transition-colors ${currentWidgetHours > (s.max_hours || 18) ? 'text-red-600' : 'text-blue-700'}`}>
                                {currentWidgetHours}
                                <span className="text-[9px] text-slate-400">/{s.max_hours || 18}</span>
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="text-[7px] font-bold text-slate-400 uppercase">الصعوبة</p>
                            <p className="text-[12px] font-black text-slate-700">{s.overall_difficulty || '—'}</p>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-blue-600 max-w-[45%] text-left leading-snug">{s.recommendation}</p>
                </div>
            )}
            <div className="space-y-1.5">
                {(widget.courses || []).map((c, i) => {
                    const state = getCourseState(c);
                    const inCart = !!addedCourses[c.id];

                    return (
                        <div key={i} className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all duration-300 ${state.borderClass}`}>
                            <span className="text-base">{state.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-black text-[12px] text-slate-800 truncate">
                                    {c.name} <span className="text-[8px] font-mono text-slate-400">{c.code}</span> <span className="text-[9px] text-slate-500">{c.credit_hours}س</span>
                                </p>
                                <p className="text-[9px] text-slate-500 font-bold">{state.reason}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${state.badge.bg}`}>{state.badge.text}</span>

                                {/* 🛡️ المادة مو بالتسجيل التجريبي → زر إضافة أزرق (بغض النظر عن verdict) */}
                                {!inCart && c.id && (
                                    <button onClick={() => onToggleCourse(c.id, c.name, c.credit_hours)} disabled={loadingCourseId === c.id} className="text-[9px] bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white px-2.5 py-1 rounded-lg font-black active:scale-95 transition-all shadow-sm shadow-blue-500/30">
                                        {loadingCourseId === c.id ? '⏳' : '➕ إضافة'}
                                    </button>
                                )}

                                {/* المادة بالتسجيل التجريبي + الـ AI يطلب حذفها → زر حذف أحمر تحذيري */}
                                {inCart && c.verdict === 'remove' && c.id && (
                                    <button onClick={() => onToggleCourse(c.id, c.name, c.credit_hours)} disabled={loadingCourseId === c.id} className="text-[9px] bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg font-black active:scale-95 transition-all">
                                        {loadingCourseId === c.id ? '⏳' : '🗑️ احذفها'}
                                    </button>
                                )}

                                {/* المادة بالتسجيل التجريبي + verdict مو remove → زر إزالة بسيط للتراجع */}
                                {inCart && c.verdict !== 'remove' && (
                                    <button onClick={() => onToggleCourse(c.id, c.name, c.credit_hours)} disabled={loadingCourseId === c.id} className="text-[9px] bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 px-2.5 py-1 rounded-lg font-black active:scale-95 transition-all border border-slate-200/60">
                                        {loadingCourseId === c.id ? '⏳' : '✖ إزالة'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Widget Router
const Widget = ({ widget, addedCourses, onToggleCourse, loadingCourseId, onSubmit }) => {
    if (!widget?.type) return null;
    const map = { comparison: ComparisonWidget, poll: PollWidget, hours_slider: HoursSliderWidget, cart_review: CartReviewWidget };
    const C = map[widget.type]; if (!C) return null;
    return <C widget={widget} addedCourses={addedCourses} onToggleCourse={onToggleCourse} loadingCourseId={loadingCourseId} onSubmit={onSubmit} />;
};

// ========== MessageActions ==========
const Actions = ({ msg, onRegen, onFeedback, isLast }) => {
    const [fb, setFb] = useState(null);
    const [cp, setCp] = useState(false);
    return (
        <div className="flex items-center gap-0.5 mt-2 pt-2 border-t border-slate-100/50 opacity-0 group-hover/m:opacity-100 transition-opacity">
            <button onClick={() => { navigator.clipboard.writeText(msg.content); setCp(true); setTimeout(() => setCp(false), 2e3); }} className="sfr-action-btn" title="نسخ">{cp ? '✓' : '📋'}</button>
            {isLast && <button onClick={onRegen} className="sfr-action-btn" title="إعادة">🔄</button>}
            <span className="w-px h-4 bg-slate-200 mx-1" />
            <button onClick={() => { if (!fb) { setFb('up'); onFeedback(msg.id, 'up'); } }} className={`sfr-action-btn ${fb === 'up' ? 'bg-emerald-100 text-emerald-600' : ''}`}>👍</button>
            <button onClick={() => { if (!fb) { setFb('down'); onFeedback(msg.id, 'down'); } }} className={`sfr-action-btn ${fb === 'down' ? 'bg-red-100 text-red-600' : ''}`}>👎</button>
        </div>
    );
};

// ========== ChatMessage ==========
const Msg = ({ msg, name, added, loading, onToggle, onDone, scroll, isLast, onRegen, onFb, onFollow }) => {
    const u = msg.role === 'user';
    return (
        <div className={`flex ${u ? 'justify-end' : 'justify-start'} sfr-slide-up`}>
            <div className={`flex max-w-[95%] ${u ? 'md:max-w-[80%]' : 'md:max-w-full w-full'} gap-2 ${u ? 'flex-row-reverse' : ''} items-end`}>
                {u ? (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-[10px] font-black text-white shrink-0 mb-1 shadow ring-2 ring-white overflow-hidden">
                        {u.avatar ? <img src={u.avatar} alt={name} className="w-full h-full object-cover" /> : name?.charAt(0) || 'أ'}
                    </div>
                ) : <div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center shrink-0 mb-1 overflow-hidden shadow-sm ring-2 ring-blue-50"><img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-cover" onError={e => { e.target.outerHTML = '<span class="text-xs">🤖</span>'; }} /></div>}
                <div className={`group/m ${u ? 'bg-gradient-to-tr from-sky-400 to-blue-500 text-white rounded-2xl rounded-se-sm shadow-lg shadow-blue-500/10 p-3.5' : 'bg-white border border-slate-200/50 text-slate-700 rounded-2xl rounded-ss-sm w-full shadow-sm p-3.5'}`}>
                    {u ? <p className="font-bold leading-relaxed text-[12.5px] whitespace-pre-wrap">{msg.content}</p> : (
                        <div className="w-full">
                            <div className="sfr-ai-shell">
                                <div className="sfr-ai-card">
                                    <div className="sfr-md text-[12.5px] font-medium">
                                        <Typewriter content={msg.content} isAnimating={msg.isAnimating} onScroll={scroll} onComplete={onDone} />
                                    </div>
                                </div>
                            </div>
                            {!msg.isAnimating && (() => {
                                const seenIds = new Set();
                                const uniqueSuggested = msg.suggested_courses?.filter(c => {
                                    if (!c.id || seenIds.has(c.id)) return false;
                                    seenIds.add(c.id);
                                    if (msg.interactive_widget?.type === 'cart_review' && msg.interactive_widget.courses?.some(wc => wc.id === c.id)) return false;
                                    if (msg.interactive_widget?.type === 'comparison' && msg.interactive_widget.items?.some(wc => wc.id === c.id)) return false;
                                    return true;
                                }) || [];
                                return uniqueSuggested.length > 0 && <div className="mt-3 pt-2.5 border-t border-blue-100/40 sfr-fade-up"><p className="text-[9px] font-black text-blue-500 mb-2">✨ مواد مقترحة:</p><div className="space-y-1.5">{uniqueSuggested.map(c => <CourseButton key={c.id} course={c} isAdded={!!added[c.id]} isLoading={loading === c.id} onToggle={onToggle} />)}</div></div>;
                            })()}
                            {!msg.isAnimating && msg.courses_to_remove?.length > 0 && <div className="mt-2.5 pt-2.5 border-t border-red-100/40 sfr-fade-up"><p className="text-[9px] font-black text-red-500 mb-2">⚠️ تخفيف العبء:</p><div className="space-y-1.5">{msg.courses_to_remove.map(c => <CourseButton key={`r-${c.id}`} course={c} isAdded={!!added[c.id]} isLoading={loading === c.id} onToggle={onToggle} variant="remove" />)}</div></div>}
                            {!msg.isAnimating && msg.interactive_widget && <Widget widget={msg.interactive_widget} addedCourses={added} onToggleCourse={onToggle} loadingCourseId={loading} onSubmit={onFollow} />}
                            {!msg.isAnimating && msg.follow_up_suggestions?.length > 0 && <div className="mt-3 pt-2.5 border-t border-slate-100/50 sfr-fade-up"><div className="flex flex-wrap gap-1.5">{msg.follow_up_suggestions.map((q, i) => <button key={i} onClick={() => onFollow(q)} className="px-3 py-1.5 bg-slate-50 border border-slate-200/50 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all active:scale-95">{q}</button>)}</div></div>}
                            {!msg.isAnimating && msg.id !== 'welcome' && <Actions msg={msg} isLast={isLast} onRegen={onRegen} onFeedback={onFb} />}
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
// 🧠 MAIN
// ======================================================================
export default function Advisor() {
    const { studentStats: st, chats: initChats, initialCartIds, dailyMessagesRemaining: initialRemaining, hasDailyLimit: initialHasDailyLimit, isAiActive: initialIsAiActive } = usePage().props;

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

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'ar-SA';

            recognitionRef.current.onstart = () => {
                setIsListening(true);
            };

            recognitionRef.current.onresult = (event) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; i++) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setInput(currentTranscript);
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
                setIsListening(false);
            };
        }
    }, []);

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
            recognitionRef.current.stop();
        } else {
            setInput('');
            recognitionRef.current.start();
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
        "بقرأ استفسارك 🔍...",
        "بحوس بقاعدة البيانات 🧠...",
        "بدور على أفضل الخيارات إلك 📚...",
        "بحلل الخطة الدراسية ⏳...",
        "بجهزلك الرد 💡...",
        "لحظة صغيرة وبكون الرد جاهز 🚀..."
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
        if (typewriterTimeoutRef.current) {
            clearTimeout(typewriterTimeoutRef.current);
            typewriterTimeoutRef.current = null;
        }
        setActiveId(null); setMsgs([welcome]); setInput(''); setGenerating(false); setTyping(false); setSidebar(false); setTimeout(() => inputRef.current?.focus(), 100);
    }, [welcome]);

    const loadChat = useCallback(async (id) => {
        if (activeId === id) { setSidebar(false); return; }
        setLoadingChat(true); setActiveId(id); setGenerating(false); setSidebar(false);
        try {
            const r = await axios.get(route('ai.advisor.messages', id));
            setMsgs(r.data.map(m => {
                let c = m.content, sc = [], cr = [], fu = [], iw = null;
                if (m.role === 'ai') { try { const p = JSON.parse(m.content); if (p.reply) { c = p.reply; sc = p.suggested_courses || []; cr = p.courses_to_remove || []; fu = p.follow_up_suggestions || []; iw = p.interactive_widget || null; } } catch { } }
                const safeText = typeof c === 'string' ? c : String(c ?? '');
                return { id: m.id, role: m.role, content: safeText || 'ما وصلني رد واضح لهذه الرسالة.', suggested_courses: sc, courses_to_remove: cr, follow_up_suggestions: fu, interactive_widget: iw, isAnimating: false };
            }));
        } catch { setMsgs([{ id: 'err', role: 'ai', content: 'خطأ بتحميل المحادثة.', isAnimating: false }]); }
        finally { setLoadingChat(false); setTimeout(scroll, 150); }
    }, [activeId, scroll]);

    const send = useCallback(async (text) => {
        const t = text?.trim();
        if (!t || generating || typing) return;

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
        setMsgs(p => [...p, { id: userMsgId, role: 'user', content: t }]); setTyping(true);

        try {
            if (abortRef.current) abortRef.current.abort();
            abortRef.current = new AbortController();

            const pl = { message: t, filters: selectedFilters, difficulty, critical_path: criticalPath, wants_code: wantsCode };
            if (activeId) pl.chat_id = activeId;

            const res = await axios.post(route('ai.advisor.chat'), pl, {
                signal: abortRef.current.signal,
                timeout: 30000,
            });

            const data = res.data;
            setTyping(false);

            if (data.status === 'error') {
                if (data.daily_messages_remaining !== undefined) setRemaining(data.daily_messages_remaining);
                if (data.has_daily_limit !== undefined) setHasDailyLimit(!!data.has_daily_limit);
                setMsgs(p => [...p, { id: `e-${Date.now()}`, role: 'ai', content: data.message || 'خطأ غير متوقع.', isAnimating: false }]);
                return;
            }

            if (data.has_daily_limit !== undefined) setHasDailyLimit(!!data.has_daily_limit);
            if (data.daily_messages_remaining !== undefined) setRemaining(data.daily_messages_remaining);
            setIsFallback(!!data.is_fallback);

            const safeReply = typeof data.reply === 'string' && data.reply.trim() ? data.reply : 'ما وصلني رد واضح.';
            setGenerating(true);
            if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
            typewriterTimeoutRef.current = setTimeout(() => setGenerating(false), 12000);

            if (data.refresh_cart) {
                router.reload({ only: ['initialCartIds', 'studentStats'] });
            }

            setMsgs(p => [...p, {
                id: `ai-${Date.now()}`,
                role: 'ai',
                content: safeReply,
                suggested_courses: data.suggested_courses || [],
                courses_to_remove: data.courses_to_remove || [],
                follow_up_suggestions: data.follow_up_suggestions || [],
                interactive_widget: data.interactive_widget || null,
                isAnimating: true
            }]);

            if (!activeId && data.chat_id) {
                setActiveId(data.chat_id);
                setChats(p => [{ id: data.chat_id, title: data.chat_title || t.substring(0, 40) + '...', created_at: new Date().toISOString() }, ...p]);
            } else if (data.chat_title && data.chat_id) {
                setChats(p => p.map(c => c.id === data.chat_id ? { ...c, title: data.chat_title } : c));
            }

        } catch (err) {
            setTyping(false);
            if (axios.isCancel(err) || err?.name === 'AbortError') return;
            setMsgs(p => [...p, { id: `err-${Date.now()}`, role: 'ai', content: 'عذراً، حدث خطأ في الاتصال. حاول مرة أخرى.', isAnimating: false }]);
        } finally {
            setGenerating(false);
            setTimeout(scroll, 100);
        }
    }, [activeId, generating, typing, magicCommands, scroll, selectedFilters, difficulty, criticalPath]);


    const handleSend = e => { e.preventDefault(); send(input); };
    const stop = useCallback(() => finish(), [finish]);

    const regen = useCallback(async () => {
        if (!activeId || regenning || generating) return; setRegenning(true);
        setMsgs(p => { const c = [...p]; if (c.length > 0 && c[c.length - 1].role === 'ai') c.pop(); return c; }); setTyping(true);
        try {
            const r = await axios.post(route('ai.advisor.regenerate'), { chat_id: activeId, filters: selectedFilters, difficulty, critical_path: criticalPath, wants_code: wantsCode });
            if (r.data.status === 'success') {
                const safeReply = typeof r.data.reply === 'string' && r.data.reply.trim()
                    ? r.data.reply
                    : 'ما وصلني رد واضح هذه المرة. جرّب إعادة السؤال.';
                setGenerating(true);
                setMsgs(p => [...p, { id: `r-${Date.now()}`, role: 'ai', content: safeReply, suggested_courses: r.data.suggested_courses || [], courses_to_remove: r.data.courses_to_remove || [], follow_up_suggestions: r.data.follow_up_suggestions || [], interactive_widget: r.data.interactive_widget || null, isAnimating: true }]);
            }
        } catch { setMsgs(p => [...p, { id: `e-${Date.now()}`, role: 'ai', content: 'فشلت إعادة التوليد.', isAnimating: false }]); }
        finally { setTyping(false); setRegenning(false); }
    }, [activeId, regenning, generating]);

    const fb = useCallback(async (mid, r) => { try { await axios.post(route('ai.advisor.feedback'), { message_id: mid, rating: r }); } catch { } }, []);

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
            .sfr-md p { margin-bottom: .6rem; line-height: 1.85; color: #334155; }
            .sfr-md p:last-child { margin-bottom: 0; }
            .sfr-md p:first-child { background: linear-gradient(to left, rgba(59,130,246,0.06), transparent); border-right: 3px solid var(--sfr-primary); padding: .5rem .7rem; border-radius: 8px; font-weight: 600; color: #1e293b; margin-bottom: .8rem; }
            .sfr-md strong { color: #1d4ed8; font-weight: 800; background: rgba(59,130,246,0.08); padding: 0.15rem 0.4rem; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(59,130,246,0.15); margin: 0 0.1rem; }
            .sfr-md em { color: #4338ca; font-style: normal; font-weight: 700; background: rgba(99,102,241,0.08); padding: 0 0.2rem; border-radius: 4px; }
            .sfr-md ul { list-style: none; padding-right: .2rem; margin-bottom: .8rem; margin-top: .4rem; }
            .sfr-md li { position: relative; padding-right: 1.2rem; margin-bottom: .4rem; line-height: 1.7; color: #475569; }
            .sfr-md li::before { content: ""; position: absolute; right: .15rem; top: .6em; width: 6px; height: 6px; background: linear-gradient(135deg, var(--sfr-primary), var(--sfr-accent)); border-radius: 50%; box-shadow: 0 0 4px rgba(59,130,246,0.4); }
            @keyframes sfr-su { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
            .sfr-slide-up { animation: sfr-su .3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            @keyframes sfr-fu { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform: translateY(0); } }
            .sfr-fade-up { animation: sfr-fu .25s ease-out forwards; }
            @keyframes sfr-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,.2); } 50% { box-shadow: 0 0 0 5px rgba(59,130,246,0); } }
            .sfr-glow { animation: sfr-glow 3s infinite; }
            .sfr-action-btn { padding: 4px 6px; border-radius: 6px; font-size: 11px; transition: all .2s; cursor: pointer; color: #64748b; }
            .sfr-action-btn:hover { background: #f1f5f9; color: #334155; transform: scale(1.05); }
            .sfr-ai-shell { background: linear-gradient(135deg, rgba(59,130,246,0.4), rgba(99,102,241,0.3), rgba(14,165,233,0.4)); padding: 1.5px; border-radius: 20px; box-shadow: 0 4px 20px -10px rgba(59,130,246,0.4); margin-bottom: 0.2rem; }
            .sfr-ai-card { background: rgba(255,255,255,0.96); backdrop-filter: blur(10px); border-radius: 19px; padding: 1rem 1.1rem; }
        ` }} />

            <div className="py-2.5 md:py-5 pb-5 lg:pb-0 bg-[#f8f9fb] min-h-screen font-t" dir="rtl">
                <div className="max-w-[1600px] mx-auto px-2.5 md:px-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 lg:gap-4 items-start">

                    {/* === Mobile Sidebar Overlay === */}
                    {sidebar && <div className="lg:hidden fixed inset-0 z-[100] flex"><div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSidebar(false)} /><div className="relative w-[85%] max-w-[320px] bg-white h-full shadow-2xl overflow-y-auto p-5 space-y-4 sfr-scrollbar transition-transform translate-x-0"><div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2"><h3 className="font-black text-slate-800 text-[14px]">📂 المحادثات السابقة</h3><button onClick={() => setSidebar(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-500 transition-colors">✕</button></div><button onClick={() => { setSidebar(false); newChat(); }} className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white p-3.5 rounded-xl font-black text-[13px] shadow-md flex items-center justify-center gap-2 active:scale-[.97] transition-all mb-4">✨ محادثة جديدة</button>{chats.length > 0 ? chats.map(c => <ChatItem key={c.id} c={c} />) : <p className="text-center text-slate-400 text-[12px] py-8 font-bold">📭 لا يوجد محادثات سابقة</p>}</div></div>}

                    {/* === Sidebar === */}
                    <div className="hidden lg:flex flex-col gap-2.5 lg:sticky top-20 max-h-[calc(100vh-100px)]">
                        <button onClick={newChat} className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white p-3 rounded-2xl font-black text-[13px] shadow-md shadow-blue-500/30 flex items-center justify-center gap-2.5 active:scale-[.97] group transition-all">
                            <span className="group-hover:rotate-12 transition-transform">✨</span> محادثة جديدة
                        </button>

                        {/* Student Info Card */}
                        {st && (
                            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-3.5">
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
                                {/* 🆕 تحديث الساعات في Sidebar لتكون ديناميكية */}
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
                        <div className="px-4 py-2.5 border-b border-slate-100/70 bg-white shrink-0 flex items-center justify-between z-20">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-white border-2 border-blue-100 rounded-full flex items-center justify-center shadow-sm overflow-hidden sfr-glow"><img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-cover" onError={e => { e.target.outerHTML = '<span class="text-lg">🤖</span>'; }} /></div>
                                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-white rounded-full ${(isFallback || !isAiActive) ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-[15px] font-[900] text-slate-800 flex items-center gap-2">سنفور <span className={`text-[7px] ${(isFallback || !isAiActive) ? 'bg-rose-600' : 'bg-blue-600'} text-white px-1.5 py-0.5 rounded font-black tracking-wider uppercase`}>{(isFallback || !isAiActive) ? 'Local' : 'AI'}</span></h2>
                                    </div>
                                    {(isFallback || fallbackReason) && <p className="text-[8px] font-bold text-rose-500 mt-0.5">{fallbackReason === 'gemini_unavailable' ? 'المساعد السحابي غير متاح حالياً، لذلك نستخدم الوضع المحلي.' : fallbackReason === 'local_fallback_error' ? 'الفالباك المحلي احتاج معالجة إضافية.' : 'الوضع المحلي مفعل حالياً.'}</p>}
                                    <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${typing || generating ? 'bg-amber-400' : ((isFallback || !isAiActive) ? 'bg-rose-400' : 'bg-emerald-400')} animate-pulse`} />
                                        {typing ? 'يحلل سؤالك...' : generating ? 'يكتب الرد...' : ((isFallback || !isAiActive) ? 'مستشار سنفور (الوضع المحلي) 🔴' : 'مستشار سنفور (الوضع الذكي) 🟢')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
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
                                    {msgs.map(m => <Msg key={m.id} msg={m} name={st?.name} added={added} loading={loadId} onToggle={toggle} onDone={finish} scroll={scroll} isLast={m.id === lastAi} onRegen={regen} onFb={fb} onFollow={send} />)}
                                    {typing && <div className="flex justify-start items-end gap-2 sfr-slide-up"><div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-blue-50"><img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-cover" /></div><div className="bg-white border border-slate-200/50 p-3.5 rounded-2xl rounded-ss-sm shadow-sm flex gap-1.5 items-center"><div className="w-1.5 h-1.5 bg-blue-600 rounded-full typing-dot" /><div className="w-1.5 h-1.5 bg-blue-400 rounded-full typing-dot" /><div className="w-1.5 h-1.5 bg-sky-300 rounded-full typing-dot" />{regenning && <span className="text-[8px] text-slate-400 font-bold mr-1.5">يعيد...</span>}<span className="text-[12px] font-bold text-slate-500 animate-pulse transition-opacity duration-500 mr-2">{thinkingPhrases[thinkingIndex]}</span></div></div>}
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
                                    <p className="text-[9px] font-black text-slate-400 mb-2 px-1">⚡ أوامر سريعة — كل واحد يفتح أداة تفاعلية مختلفة:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {cmds.map((cmd, i) => (
                                            <button key={i} onClick={() => send(cmd.text)} className={`flex items-start gap-2.5 p-3 bg-${cmd.color}-50/50 border border-${cmd.color}-200/40 rounded-xl text-right hover:bg-${cmd.color}-100/50 hover:border-${cmd.color}-300/50 transition-all active:scale-[.98] group`}>
                                                <span className="text-lg shrink-0 mt-0.5">{cmd.icon}</span>
                                                <div>
                                                    <p className={`text-[11px] font-black text-${cmd.color}-700 leading-snug`}>{cmd.text}</p>
                                                    <p className={`text-[8px] font-bold text-${cmd.color}-400 mt-0.5`}>{cmd.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="p-2.5 md:p-3 relative z-50">
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

                                <form onSubmit={handleSend} className="relative flex items-center gap-2 z-50">
                                    {/* Plus Button */}
                                    <button
                                        type="button"
                                        onClick={() => setShowFiltersPopup(!showFiltersPopup)}
                                        className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border-2 ${showFiltersPopup ? 'bg-slate-800 border-slate-800 text-white rotate-45 scale-95 shadow-inner' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-300 active:scale-95'}`}
                                        title="إعدادات الذكاء"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </button>

                                    <div className="relative flex-1">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={input}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setInput(val);
                                                if (val.startsWith('/')) {
                                                    setShowCommandMenu(true);
                                                    setCommandFilter(val.slice(1));
                                                } else {
                                                    setShowCommandMenu(false);
                                                    setCommandFilter('');
                                                }
                                            }}
                                            placeholder={limitReached ? "⚠️ لقد استهلكت محاولاتك اليومية المتاحة. عد غداً ⏳" : isListening ? "جاري الاستماع..." : "اسأل سنفور أي شيء، أو اكتب / للأوامر السريعة..."}
                                            className={`w-full ${limitReached ? 'bg-red-50/50 border-red-200/50 text-red-800 placeholder-red-400' : 'bg-slate-50/70 border-slate-200/50 text-slate-800 placeholder-slate-400/60'} border-2 rounded-2xl py-3.5 pr-4 pl-[90px] focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-400 focus:bg-white transition-all font-bold text-[13px] shadow-inner`}
                                            disabled={typing || loadingChat || generating || limitReached}
                                        />
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <button type="button" onClick={toggleListening} disabled={typing || loadingChat || generating || limitReached} className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-[0.93] ${isListening ? 'bg-red-50 text-red-500 border border-red-200 animate-pulse' : 'bg-white/80 text-slate-500 hover:bg-slate-200 hover:text-blue-600 border border-slate-200/60'}`} title="تحدث بالصوت">
                                                {isListening ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" /></svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" /></svg>
                                                )}
                                            </button>
                                            <button type="submit" disabled={!input.trim() || typing || loadingChat || generating || limitReached} className="w-10 h-10 bg-gradient-to-tr from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-20 shadow-md shadow-blue-500/20 active:scale-[0.93] transition-all">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 rotate-180"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </form>
                                <p className="text-[7.5px] font-bold text-center mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                                    <span className="text-slate-400">النتائج استرشادية — سنفور بيحلل خطتك الحقيقية</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className="text-amber-500 font-black px-1.5 py-0.5 bg-amber-50 rounded">⚠️ هذه الميزة تحت التجربة (Beta) وقد تكون بعض الاقتراحات غير دقيقة</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black ${limitReached ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-700'}`}>
                                        {hasDailyLimit ? (limitReached ? '⚠️ انتهت رسائلك المتاحة اليوم' : `الرسائل المتبقية لليوم: ${remaining}/${5}`) : '♾️ رسائل غير محدودة'}
                                    </span>
                                </p>
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
