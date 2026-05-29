import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Swal from 'sweetalert2';

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
                const speed = safeContent.length > 700 ? 28 : safeContent.length > 350 ? 20 : 12;
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
    return <ReactMarkdown>{txt}</ReactMarkdown>;
};


// Reusable button used to add or remove suggested courses from the simulator cart.
const CourseButton = ({ course, isAdded, isLoading, onToggle, variant = 'add' }) => {
    const rm = variant === 'remove';
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
                            {active && (
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
                                {!inCart && (
                                    <button onClick={() => onToggleCourse(c.id, c.name, c.credit_hours)} disabled={loadingCourseId === c.id} className="text-[9px] bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white px-2.5 py-1 rounded-lg font-black active:scale-95 transition-all shadow-sm shadow-blue-500/30">
                                        {loadingCourseId === c.id ? '⏳' : '➕ إضافة'}
                                    </button>
                                )}

                                {/* المادة بالتسجيل التجريبي + الـ AI يطلب حذفها → زر حذف أحمر تحذيري */}
                                {inCart && c.verdict === 'remove' && (
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
            <div className={`flex max-w-[95%] md:max-w-[80%] gap-2 ${u ? 'flex-row-reverse' : ''} items-end`}>
                {u ? <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-[10px] font-black text-white shrink-0 mb-1 shadow ring-2 ring-white">{name?.charAt(0)||'أ'}</div>
                    : <div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center shrink-0 mb-1 overflow-hidden shadow-sm ring-2 ring-blue-50"><img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-cover" onError={e=>{e.target.outerHTML='<span class="text-xs">🤖</span>';}}/></div>}
                <div className={`group/m ${u ? 'bg-gradient-to-tr from-sky-400 to-blue-500 text-white rounded-2xl rounded-se-sm shadow-lg shadow-blue-500/10 p-3.5' : 'bg-white border border-slate-200/50 text-slate-700 rounded-2xl rounded-ss-sm w-full shadow-sm p-3.5'}`}>
                    {u ? <p className="font-bold leading-relaxed text-[12.5px] whitespace-pre-wrap">{msg.content}</p> : (
                        <div className="w-full">
                            <div className="sfr-ai-shell">
                                <div className="sfr-ai-card">
                                    <div className="sfr-md text-[12.5px] font-medium">
                                        <Typewriter content={msg.content} isAnimating={msg.isAnimating} onScroll={scroll} onComplete={onDone}/>
                                    </div>
                                </div>
                            </div>
                            {!msg.isAnimating && msg.suggested_courses?.length > 0 && <div className="mt-3 pt-2.5 border-t border-blue-100/40 sfr-fade-up"><p className="text-[9px] font-black text-blue-500 mb-2">✨ مواد مقترحة:</p><div className="space-y-1.5">{msg.suggested_courses.map(c=><CourseButton key={c.id} course={c} isAdded={!!added[c.id]} isLoading={loading===c.id} onToggle={onToggle}/>)}</div></div>}
                            {!msg.isAnimating && msg.courses_to_remove?.length > 0 && <div className="mt-2.5 pt-2.5 border-t border-red-100/40 sfr-fade-up"><p className="text-[9px] font-black text-red-500 mb-2">⚠️ تخفيف العبء:</p><div className="space-y-1.5">{msg.courses_to_remove.map(c=><CourseButton key={`r-${c.id}`} course={c} isAdded={!!added[c.id]} isLoading={loading===c.id} onToggle={onToggle} variant="remove"/>)}</div></div>}
                            {!msg.isAnimating && msg.interactive_widget && <Widget widget={msg.interactive_widget} addedCourses={added} onToggleCourse={onToggle} loadingCourseId={loading} onSubmit={onFollow}/>}
                            {!msg.isAnimating && msg.follow_up_suggestions?.length > 0 && <div className="mt-3 pt-2.5 border-t border-slate-100/50 sfr-fade-up"><div className="flex flex-wrap gap-1.5">{msg.follow_up_suggestions.map((q,i)=><button key={i} onClick={()=>onFollow(q)} className="px-3 py-1.5 bg-slate-50 border border-slate-200/50 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all active:scale-95">{q}</button>)}</div></div>}
                            {!msg.isAnimating && msg.id !== 'welcome' && <Actions msg={msg} isLast={isLast} onRegen={onRegen} onFeedback={onFb}/>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ========== ProgressRing ==========
const Ring = ({pct, size=40, s=3.5}) => {
    const r=(size-s)/2, c=2*Math.PI*r;
    return <svg width={size} height={size} className="-rotate-90"><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={s}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#rg)" strokeWidth={s} strokeDasharray={c} strokeDashoffset={c-(pct/100)*c} strokeLinecap="round" className="transition-all duration-700"/><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#38bdf8"/><stop offset="100%" stopColor="#3b82f6"/></linearGradient></defs></svg>;
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
            personalMsg = `أقدر أساعدك بـ:\n* 📊 تحليل معدلك وساعاتك\n* 🛒 اقتراح مواد وإضافتها بضغطة\n* ⚡ بناء أفضل خطة للفصل\n* 📋 مراجعة التسجيل التجريبي وتخفيف العبء\n\n`;
            suggestedActions = ['اقترح لي مواد تفتح مواد أخرى', 'كم ساعة أسجل هالفصل؟', 'قارن لي أفضل المواد'];
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

    const [chats, setChats] = useState(initChats||[]);
    const [activeId, setActiveId] = useState(null);
    const [msgs, setMsgs] = useState([welcome]);
    const [input, setInput] = useState('');
    const [typing, setTyping] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [loadingChat, setLoadingChat] = useState(false);
    const [sidebar, setSidebar] = useState(false);
    const [regenning, setRegenning] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

    // 🆕 State الساعات الديناميكية
    const [cartHours, setCartHours] = useState(st?.cart_hours || 0);

    // الأوامر السحرية
    const [showCommandMenu, setShowCommandMenu] = useState(false);
    const [commandFilter, setCommandFilter] = useState('');

    const magicCommands = [
        { cmd: '/خطة', label: '📋 بناء خطة فصل', message: 'ابنِ لي خطة فصل كاملة بناءً على وضعي الأكاديمي', icon: '📋' },
        { cmd: '/تجريبي', label: '🛒 مراجعة التسجيل التجريبي', message: 'راجع التسجيل التجريبي الحالي وقيّمه واقترح تعديلات', icon: '🛒' },
        { cmd: '/معدل', label: '📊 تحليل المعدل', message: 'كم معدلي التراكمي حالياً وكيف أرفعه؟', icon: '📊' },
        { cmd: '/مقارنة', label: '⚖️ مقارنة المواد', message: 'قارن لي أفضل المواد المتاحة للتسجيل', icon: '⚖️' },
        { cmd: '/ساعات', label: '⏱️ عدد الساعات', message: 'كم ساعة أسجل هالفصل؟', icon: '⏱️' },
        { cmd: '/تخفيف', label: '😮‍💨 تخفيف العبء', message: 'حاسس العبء كبير، شو أحذف من التسجيل التجريبي؟', icon: '😮‍💨' },
        { cmd: '/حرج', label: '🚨 المسار الحرج', message: 'شو المواد الحرجة اللي لازم أسجلها هالفصل؟', icon: '🚨' },
        { cmd: '/تخرج', label: '🎓 خطة التخرج', message: 'كم فصل باقي على تخرجي وشو المواد المتبقية؟', icon: '🎓' },
    ];

    const initAdded = useMemo(() => { const s = {}; initialCartIds?.forEach(id => { s[id] = true; }); return s; }, [initialCartIds]);
    const [added, setAdded] = useState(initAdded);
    const [loadId, setLoadId] = useState(null);

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
        setActiveId(null); setMsgs([welcome]); setInput(''); setGenerating(false); setTyping(false); setSidebar(false); setTimeout(() => inputRef.current?.focus(), 100); }, [welcome]);

    const loadChat = useCallback(async (id) => {
        if (activeId === id) { setSidebar(false); return; }
        setLoadingChat(true); setActiveId(id); setGenerating(false); setSidebar(false);
        try {
            const r = await axios.get(route('ai.advisor.messages', id));
            setMsgs(r.data.map(m => { let c=m.content, sc=[], cr=[], fu=[], iw=null;
                if (m.role==='ai') { try { const p=JSON.parse(m.content); if(p.reply){ c=p.reply; sc=p.suggested_courses||[]; cr=p.courses_to_remove||[]; fu=p.follow_up_suggestions||[]; iw=p.interactive_widget||null; }} catch{} }
                const safeText = typeof c === 'string' ? c : String(c ?? '');
                return { id:m.id, role:m.role, content:safeText || 'ما وصلني رد واضح لهذه الرسالة.', suggested_courses:sc, courses_to_remove:cr, follow_up_suggestions:fu, interactive_widget:iw, isAnimating:false };
            }));
        } catch { setMsgs([{ id:'err', role:'ai', content:'خطأ بتحميل المحادثة.', isAnimating:false }]); }
        finally { setLoadingChat(false); setTimeout(scroll, 150); }
    }, [activeId, scroll]);

    const send = useCallback(async (text) => {
        const t = text?.trim(); 
        if (!t || generating || typing) return;

        // معالجة الأوامر السحرية
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
        setMsgs(p => [...p, { id:`u-${Date.now()}`, role:'user', content:t }]); setTyping(true);
        try {
            if (abortRef.current) abortRef.current.abort(); abortRef.current = new AbortController();
            const pl = { message:t }; if (activeId) pl.chat_id = activeId;
            const r = await axios.post(route('ai.advisor.chat'), pl, { signal: abortRef.current.signal });
            if (r.data.status === 'success') {
                if (r.data.has_daily_limit !== undefined) {
                    setHasDailyLimit(!!r.data.has_daily_limit);
                }
                if (r.data.daily_messages_remaining !== undefined) {
                    setRemaining(r.data.daily_messages_remaining);
                }
                setIsFallback(!!r.data.is_fallback);

                const safeReply = typeof r.data.reply === 'string' && r.data.reply.trim()
                    ? r.data.reply
                    : 'ما وصلني رد واضح هذه المرة. حاول إعادة الصياغة بسؤال أقصر.';
                setGenerating(true);
                if (typewriterTimeoutRef.current) clearTimeout(typewriterTimeoutRef.current);
                typewriterTimeoutRef.current = setTimeout(() => setGenerating(false), 12000);
                setMsgs(p => [...p, { id:`ai-${Date.now()}`, role:'ai', content:safeReply, suggested_courses:r.data.suggested_courses||[], courses_to_remove:r.data.courses_to_remove||[], follow_up_suggestions:r.data.follow_up_suggestions||[], interactive_widget:r.data.interactive_widget||null, isAnimating:true }]);
                if (!activeId && r.data.chat_id) { setActiveId(r.data.chat_id); setChats(p => [{ id:r.data.chat_id, title:r.data.chat_title||t.substring(0,40)+'...', created_at:new Date().toISOString() }, ...p]); }
                if (r.data.chat_title && r.data.chat_id) setChats(p => p.map(c => c.id===r.data.chat_id ? {...c, title:r.data.chat_title} : c));
            } else { 
                setGenerating(false); 
                setMsgs(p => [...p, { id:`e-${Date.now()}`, role:'ai', content:r.data.message || 'الخادم مشغول، حاول ثانية. 🔄', isAnimating:false }]); 
            }
        } catch(e) { 
            if (axios.isCancel?.(e)) return; 
            setGenerating(false); 
            if (e?.response?.data?.has_daily_limit !== undefined) {
                setHasDailyLimit(!!e.response.data.has_daily_limit);
            }
            if (e?.response?.data?.daily_messages_remaining !== undefined) {
                setRemaining(e.response.data.daily_messages_remaining);
            }
            setMsgs(p => [...p, { id:`e-${Date.now()}`, role:'ai', content:e?.response?.data?.message || 'انقطع الاتصال. 📡', isAnimating:false }]); 
        }
        finally { setTyping(false); }
    }, [activeId, generating, typing, magicCommands]);

    const handleSend = e => { e.preventDefault(); send(input); };
    const stop = useCallback(() => finish(), [finish]);
    
    const regen = useCallback(async () => {
        if (!activeId || regenning || generating) return; setRegenning(true);
        setMsgs(p => { const c=[...p]; if(c.length>0&&c[c.length-1].role==='ai')c.pop(); return c; }); setTyping(true);
        try { const r=await axios.post(route('ai.advisor.regenerate'),{chat_id:activeId});
            if(r.data.status==='success'){
                const safeReply = typeof r.data.reply === 'string' && r.data.reply.trim()
                    ? r.data.reply
                    : 'ما وصلني رد واضح هذه المرة. جرّب إعادة السؤال.';
                setGenerating(true);
                setMsgs(p=>[...p,{id:`r-${Date.now()}`,role:'ai',content:safeReply,suggested_courses:r.data.suggested_courses||[],courses_to_remove:r.data.courses_to_remove||[],follow_up_suggestions:r.data.follow_up_suggestions||[],interactive_widget:r.data.interactive_widget||null,isAnimating:true}]);
            }
        } catch{setMsgs(p=>[...p,{id:`e-${Date.now()}`,role:'ai',content:'فشلت إعادة التوليد.',isAnimating:false}]);}
        finally{setTyping(false);setRegenning(false);}
    },[activeId,regenning,generating]);

    const fb = useCallback(async(mid,r)=>{try{await axios.post(route('ai.advisor.feedback'),{message_id:mid,rating:r});}catch{}},[]);
    
    const maxCartHours = Math.min(18, st?.max_allowed_hours ?? 18);

    // 🆕 تحديث دالة الـ Toggle لتدعم الساعات الديناميكية
    const toggle = useCallback(async(cid, cn, chours = 0)=>{
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
        try{
            const r = await axios.post(route('cart.toggle.single'),{course_id:cid});
            if(r.data.status === 'added'){
                setAdded(p=>({...p,[cid]:true}));
                setCartHours(prev => prev + Number(chours)); // 🆕 إضافة الساعات
                Swal.fire({icon:'success',title:'أضيفت! 🚀',text:`"${cn}" بالتسجيل التجريبي.`,timer:1500,showConfirmButton:false,...swal});
            } else if(r.data.status === 'removed'){
                setAdded(p=>({...p,[cid]:false}));
                setCartHours(prev => Math.max(0, prev - Number(chours))); // 🆕 خصم الساعات
                Swal.fire({icon:'info',title:'أزيلت',text:`"${cn}" شُطبت.`,timer:1500,showConfirmButton:false,...swal});
            }
        }catch(error){
            Swal.fire({
                icon:'error',
                title:'تعذر الإضافة',
                text:error?.response?.data?.message || error?.response?.data?.msg || 'خطأ غير متوقع.',
                ...swal
            });
        }finally{
            setLoadId(null);
        }
    },[added, cartHours, maxCartHours]);

    const delChat = useCallback(async(id,e)=>{e.stopPropagation();const r=await Swal.fire({title:'حذف المحادثة؟',icon:'warning',showCancelButton:true,confirmButtonText:'احذف',cancelButtonText:'لا',...swal});if(r.isConfirmed){try{await axios.delete(route('ai.advisor.delete',id));setChats(p=>p.filter(c=>c.id!==id));if(activeId===id)newChat();}catch{}}},[activeId,newChat]);
    const delAll = useCallback(async()=>{if(!chats.length)return;const r=await Swal.fire({title:`حذف ${chats.length} محادثة؟`,icon:'warning',showCancelButton:true,confirmButtonText:'احذف الكل',cancelButtonText:'لا',...swal});if(r.isConfirmed){try{await axios.delete(route('ai.advisor.delete.all'));setChats([]);newChat();}catch{}}},[chats.length,newChat]);

    useEffect(()=>{
        const fn=e=>{
            if(e.ctrlKey&&e.shiftKey&&e.key==='N'){e.preventDefault();newChat();}
            if(e.key==='Escape'&&generating)stop();
            // إغلاق قائمة الأوامر بـ Esc
            if (e.key === 'Escape' && showCommandMenu) {
                setShowCommandMenu(false);
                setCommandFilter('');
            }
        };
        window.addEventListener('keydown',fn);
        return()=>window.removeEventListener('keydown',fn);
    },[newChat,generating,stop,showCommandMenu]);

    const cmds = [
        { text: "قارن لي أفضل المواد المتاحة", icon: "📊", desc: "بطاقات مقارنة", color: "blue" },
        { text: "شو أولويتي هالفصل؟", icon: "🗳️", desc: "استطلاع سريع", color: "sky" },
        { text: "كم ساعة أسجل هالفصل؟", icon: "⏱️", desc: "سلايدر الساعات", color: "teal" },
        { text: "راجع التسجيل التجريبي وقيّمه", icon: "📋", desc: "مراجعة تفاعلية", color: "slate" },
    ];

    const grouped = useMemo(() => {
        const n=new Date(), td=new Date(n.getFullYear(),n.getMonth(),n.getDate()), yd=new Date(td); yd.setDate(yd.getDate()-1); const wk=new Date(td); wk.setDate(wk.getDate()-7);
        const g={today:[],yesterday:[],week:[],older:[]};
        chats.forEach(c=>{const d=new Date(c.created_at);if(d>=td)g.today.push(c);else if(d>=yd)g.yesterday.push(c);else if(d>=wk)g.week.push(c);else g.older.push(c);});return g;
    },[chats]);
    const addedCount = useMemo(() => Object.values(added).filter(Boolean).length, [added]);
    const lastAi = useMemo(() => { for(let i=msgs.length-1;i>=0;i--)if(msgs[i].role==='ai'&&msgs[i].id!=='welcome')return msgs[i].id; return null; }, [msgs]);

    const ChatItem = ({c}) => (
        <div className="relative group/i">
            <button onClick={()=>loadChat(c.id)} className={`w-full text-right p-2.5 rounded-xl transition-all flex items-center gap-2 ${activeId===c.id?'bg-blue-50 border border-blue-200/50':'hover:bg-slate-50 border border-transparent'}`}>
                <span className={`text-[10.5px] font-bold truncate flex-1 ${activeId===c.id?'text-blue-700':'text-slate-500'}`}>{c.title}</span>
            </button>
            <button onClick={e=>delChat(c.id,e)} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/i:opacity-100 p-1 hover:bg-red-50 rounded transition-all text-[10px] text-red-400">✕</button>
        </div>
    );
    const Grp = ({label, items}) => items.length === 0 ? null : <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-wider px-2.5 pt-2 pb-1">{label}</p>{items.map(c=><ChatItem key={c.id} c={c}/>)}</div>;

    return (
        <MainLayout><Head>
            <title>المستشار الأكاديمي الذكي | سنفور</title>
            <meta name="description" content="مساعد ذكي داخل سنفور لتحليل وضعك الأكاديمي واقتراح مواد مناسبة بناءً على خطتك وسجلك." />
            <meta name="robots" content="noindex,nofollow,noarchive" />
            <link rel="canonical" href={`${siteUrl}/ai-advisor`} />
        </Head>
        <style dangerouslySetInnerHTML={{ __html: `
            :root { --sfr-primary: #3b82f6; --sfr-accent: #06b6d4; }
            .sfr-scrollbar::-webkit-scrollbar { width: 3px; }
            .sfr-scrollbar::-webkit-scrollbar-thumb { background: rgba(186,230,253,.3); border-radius: 10px; }
            .sfr-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(186,230,253,.5); }
            .typing-dot { animation: sfr-bounce 1.4s infinite ease-in-out both; }
            .typing-dot:nth-child(1) { animation-delay: -.32s; }
            .typing-dot:nth-child(2) { animation-delay: -.16s; }
            @keyframes sfr-bounce { 0%,80%,100% { transform: scale(.4); opacity: .25; } 40% { transform: scale(1); opacity: 1; } }
            .sfr-md p { margin-bottom: .4rem; line-height: 1.8; }
            .sfr-md p:last-child { margin-bottom: 0; }
            .sfr-md p:first-child { background: rgba(59,130,246,.10); border-right: 3px solid #3b82f6; padding: .35rem .5rem; border-radius: 10px; }
            .sfr-md strong { color: #1e1b4b; font-weight: 900; background: rgba(253,224,71,.35); padding: 0 .2rem; border-radius: 6px; }
            .sfr-md em { color: #0f766e; font-style: normal; font-weight: 800; }
            .sfr-md ul { list-style: none; padding-right: .15rem; margin-bottom: .4rem; }
            .sfr-md li { position: relative; padding-right: 1.1rem; margin-bottom: .25rem; line-height: 1.75; }
            .sfr-md li::before { content: ""; position: absolute; right: .1rem; top: .65em; width: 4px; height: 4px; background: var(--sfr-primary); border-radius: 50%; }
            @keyframes sfr-su { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform: translateY(0); } }
            .sfr-slide-up { animation: sfr-su .25s ease-out forwards; }
            @keyframes sfr-fu { from { opacity:0; transform: translateY(5px); } to { opacity:1; transform: translateY(0); } }
            .sfr-fade-up { animation: sfr-fu .2s ease-out forwards; }
            @keyframes sfr-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(59,130,246,.2); } 50% { box-shadow: 0 0 0 5px rgba(59,130,246,0); } }
            .sfr-glow { animation: sfr-glow 3s infinite; }
            .sfr-action-btn { padding: 4px 6px; border-radius: 6px; font-size: 11px; transition: all .15s; cursor: pointer; }
            .sfr-action-btn:hover { background: #f1f5f9; }
            .sfr-ai-shell { background: linear-gradient(135deg, rgba(253,230,138,.55), rgba(199,210,254,.45), rgba(167,243,208,.45)); padding: 1px; border-radius: 18px; }
            .sfr-ai-card { background: rgba(255,255,255,.98); border-radius: 18px; padding: .8rem .9rem; border: 1px solid rgba(59,130,246,.12); box-shadow: 0 18px 40px -28px rgba(15,23,42,.55); }
        ` }} />

        <div className="py-2.5 md:py-5 pb-5 lg:pb-0 bg-[#f8f9fb] min-h-screen font-t" dir="rtl">
        <div className="max-w-7xl mx-auto px-2.5 md:px-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 lg:gap-4 items-start">

        {/* === Mobile === */}
        <div className="lg:hidden sticky top-2 z-30 flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/90 p-2 shadow-sm backdrop-blur-sm">
            <button onClick={()=>setSidebar(true)} className="flex items-center gap-1.5 p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-sm active:scale-95 text-[11px] font-black text-slate-600"><svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>المحادثات</button>
            <button onClick={newChat} className="flex-1 bg-gradient-to-r from-sky-400 to-blue-500 text-white py-2.5 rounded-xl font-black text-[12px] shadow-md flex items-center justify-center gap-2 active:scale-[.97] shadow-blue-500/20">✨ محادثة جديدة</button>
        </div>
        {sidebar&&<div className="lg:hidden fixed inset-0 z-50 flex"><div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={()=>setSidebar(false)}/><div className="relative w-[80%] max-w-[280px] bg-white h-full shadow-2xl overflow-y-auto p-4 space-y-3 sfr-scrollbar"><div className="flex items-center justify-between"><h3 className="font-black text-slate-700 text-[13px]">📂 المحادثات</h3><button onClick={()=>setSidebar(false)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">✕</button></div>{chats.length>0?chats.map(c=><ChatItem key={c.id} c={c}/>):<p className="text-center text-slate-400 text-[11px] py-8">📭 فارغ</p>}</div></div>}

        {/* === Sidebar === */}
        <div className="hidden lg:flex flex-col gap-2.5 lg:sticky top-20 max-h-[calc(100vh-100px)]">
            <button onClick={newChat} className="w-full bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white p-3 rounded-2xl font-black text-[13px] shadow-md shadow-blue-500/30 flex items-center justify-center gap-2.5 active:scale-[.97] group transition-all">
                <span className="group-hover:rotate-12 transition-transform">✨</span> محادثة جديدة
            </button>

            {/* Student Info Card */}
            {st && (
                <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-3.5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center text-lg font-black text-blue-700 shrink-0">{st.name?.charAt(0)||'أ'}</div>
                        <div className="min-w-0"><p className="font-black text-[13px] text-slate-800 truncate">{st.name}</p><p className="text-[9px] text-slate-400 font-bold">{st.major||'—'}</p></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {st.gpa != null && <div className="text-center bg-slate-50/80 rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase">المعدل %</p><p className="text-[15px] font-black text-blue-700">{st.has_academic_records ? `${st.gpa}%` : 'لا يوجد بعد'}</p>{st.is_probation&&<span className="text-[6px] bg-red-100 text-red-600 px-1 rounded font-black">إنذار</span>}</div>}
                        {st.hours_completed!=null && <div className="text-center bg-slate-50/80 rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase">منجزة</p><p className="text-[15px] font-black text-sky-700">{st.hours_completed}</p>{st.total_plan_hours&&<p className="text-[7px] text-slate-400">/{st.total_plan_hours}</p>}</div>}
                        {st.progress_percent!=null && <div className="flex flex-col items-center bg-slate-50/80 rounded-xl p-2"><p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5">التخرج</p><Ring pct={st.progress_percent} size={32} s={3}/><p className="text-[9px] font-black text-slate-700 mt-0.5">{st.progress_percent}%</p></div>}
                    </div>
                    {/* 🆕 تحديث الساعات في Sidebar لتكون ديناميكية */}
                    {addedCount>0 && <div className="mt-2 bg-emerald-50/80 rounded-xl p-2 flex items-center gap-2"><span className="text-sm">🛒</span><p className="text-[10px] font-black text-emerald-700">{addedCount} مادة بالتسجيل التجريبي</p>{cartHours > 0 && <span className="mr-auto text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">{cartHours}س</span>}</div>}
                </div>
            )}

            {/* Chat History */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="p-2.5 border-b border-slate-100/80 shrink-0 flex items-center justify-between">
                    <h3 className="font-black text-slate-600 text-[10px]">📂 المحادثات</h3>
                    {chats.length>0&&<button onClick={delAll} className="text-[8px] text-red-400 hover:text-red-600 font-bold transition-colors">مسح الكل</button>}
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 sfr-scrollbar">
                    {chats.length>0?<><Grp label="اليوم" items={grouped.today}/><Grp label="أمس" items={grouped.yesterday}/><Grp label="هالأسبوع" items={grouped.week}/><Grp label="أقدم" items={grouped.older}/></>:<div className="py-8 flex flex-col items-center text-slate-400 opacity-40"><span className="text-xl">📭</span></div>}
                </div>
            </div>

            <p className="text-[8px] text-slate-400 font-bold text-center"><kbd className="bg-slate-100 px-1 py-0.5 rounded text-[7px] font-mono">Ctrl+Shift+N</kbd> جديدة · <kbd className="bg-slate-100 px-1 py-0.5 rounded text-[7px] font-mono">Esc</kbd> إيقاف</p>
        </div>

        {/* === Chat === */}
        <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm flex flex-col h-[calc(100dvh-150px)] sm:h-[calc(100dvh-140px)] lg:h-[calc(100vh-64px)] min-h-[420px] overflow-hidden relative">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-slate-100/70 bg-white shrink-0 flex items-center justify-between z-20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 bg-white border-2 border-blue-100 rounded-full flex items-center justify-center shadow-sm overflow-hidden sfr-glow"><img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-cover" onError={e=>{e.target.outerHTML='<span class="text-lg">🤖</span>';}}/></div>
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-white rounded-full ${(isFallback || !isAiActive) ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}/>
                    </div>
                    <div>
                        <h2 className="text-[15px] font-[900] text-slate-800 flex items-center gap-2">سنفور <span className={`text-[7px] ${(isFallback || !isAiActive) ? 'bg-rose-600' : 'bg-blue-600'} text-white px-1.5 py-0.5 rounded font-black tracking-wider uppercase`}>{(isFallback || !isAiActive) ? 'Local' : 'AI'}</span></h2>
                        <p className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${typing||generating?'bg-amber-400':((isFallback || !isAiActive) ? 'bg-rose-400' : 'bg-emerald-400')} animate-pulse`}/>
                            {typing ? 'يحلل سؤالك...' : generating ? 'يكتب الرد...' : ((isFallback || !isAiActive) ? 'مستشار سنفور (الوضع المحلي) 🔴' : 'مستشار سنفور (الوضع الذكي) 🟢')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isMobileViewport && (
                        <button onClick={newChat} className="md:hidden bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg text-[10px] font-black active:scale-95 transition-all">✨ جديدة</button>
                    )}
                    {st&&<div className="hidden md:flex items-center gap-2">
                        {st.gpa&&<div className="bg-slate-50 rounded-lg px-3 py-1.5 text-center border border-slate-100"><p className="text-[7px] font-bold text-slate-400">GPA</p><p className="text-[13px] font-black text-blue-700">{st.gpa}</p></div>}
                        {st.progress_percent!=null&&<div className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100"><Ring pct={st.progress_percent} size={24} s={2.5}/><span className="text-[10px] font-black text-slate-700">{st.progress_percent}%</span></div>}
                        {/* 🆕 تحديث الساعات في Header لتكون ديناميكية */}
                        {addedCount>0&&<div className="bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-100"><span className="text-[10px] font-black text-emerald-700">🛒 {addedCount} مواد • {cartHours}س</span></div>}
                    </div>}
                </div>
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 md:p-5 pb-5 space-y-3 bg-[#fafbfc] sfr-scrollbar">
                {loadingChat ? <div className="h-full flex flex-col items-center justify-center text-blue-400"><div className="w-7 h-7 border-[3px] border-blue-100 border-t-blue-600 rounded-full animate-spin mb-2"/><p className="font-bold text-[10px]">جاري التحميل...</p></div> : (
                <div className="space-y-3">
                    {msgs.map(m=><Msg key={m.id} msg={m} name={st?.name} added={added} loading={loadId} onToggle={toggle} onDone={finish} scroll={scroll} isLast={m.id===lastAi} onRegen={regen} onFb={fb} onFollow={send}/>)}
                    {typing&&<div className="flex justify-start items-end gap-2 sfr-slide-up"><div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-blue-50"><img src="/images/aiwidget.png" alt="AI Widget" className="w-full h-full object-cover"/></div><div className="bg-white border border-slate-200/50 p-3.5 rounded-2xl rounded-ss-sm shadow-sm flex gap-1.5 items-center"><div className="w-1.5 h-1.5 bg-blue-600 rounded-full typing-dot"/><div className="w-1.5 h-1.5 bg-blue-400 rounded-full typing-dot"/><div className="w-1.5 h-1.5 bg-sky-300 rounded-full typing-dot"/>{regenning&&<span className="text-[8px] text-slate-400 font-bold mr-1.5">يعيد...</span>}</div></div>}
                </div>)}<div className="h-2"/>
            </div>

            {generating&&<div className="absolute bottom-[80px] left-1/2 -translate-x-1/2 z-30 sfr-fade-up"><button onClick={stop} className="bg-slate-900 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black shadow-xl flex items-center gap-1.5 transition-all active:scale-95"><span className="w-1.5 h-1.5 bg-white rounded-sm"/>إيقاف</button></div>}

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
                <div className="p-2.5 md:p-3">
                    <form onSubmit={handleSend} className="relative flex items-center">
                        <input 
                            ref={inputRef} 
                            type="text" 
                            value={input} 
                            onChange={e => {
                                const val = e.target.value;
                                setInput(val);
                                // إظهار قائمة الأوامر إذا كتب /
                                if (val.startsWith('/')) {
                                    setShowCommandMenu(true);
                                    setCommandFilter(val.slice(1));
                                } else {
                                    setShowCommandMenu(false);
                                    setCommandFilter('');
                                }
                            }} 
                            placeholder={limitReached ? "⚠️ لقد استهلكت محاولاتك اليومية المتاحة. عد غداً ⏳" : "اسأل سنفور أي شيء، أو اكتب / للأوامر السريعة..."}
                            className={`w-full ${limitReached ? 'bg-red-50/50 border-red-200/50 text-red-800 placeholder-red-400' : 'bg-slate-50/70 border-slate-200/50 text-slate-800 placeholder-slate-400/60'} border-2 rounded-xl py-3 pr-4 pl-14 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 focus:bg-white transition-all font-bold text-[12.5px]`} 
                            disabled={typing||loadingChat||generating||limitReached}
                        />
                        <button type="submit" disabled={!input.trim()||typing||loadingChat||generating||limitReached} className="absolute left-2 w-9 h-9 bg-gradient-to-tr from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white rounded-lg flex items-center justify-center disabled:opacity-20 shadow-md active:scale-90 transition-all">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 rotate-180"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z"/></svg>
                        </button>
                    </form>
                    <p className="text-[7.5px] font-bold text-center mt-1.5 flex items-center justify-center gap-1.5">
                        <span className="text-slate-400">النتائج استرشادية — سنفور بيحلل خطتك الحقيقية</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"/>
                        <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black ${limitReached ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-700'}`}>
                            {hasDailyLimit ? (limitReached ? '⚠️ انتهت رسائلك المتاحة اليوم' : `الرسائل المتبقية لليوم: ${remaining}/${5}`) : '♾️ رسائل غير محدودة'}
                        </span>
                    </p>
                </div>
            </div>
        </div>
        </div></div>
        </MainLayout>
    );
}