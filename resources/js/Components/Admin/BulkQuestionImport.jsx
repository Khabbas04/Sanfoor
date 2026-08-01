import React from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    AlertTriangle, BookOpen, Check, CheckCircle2, ChevronLeft,
    ChevronRight, Circle, FileText, LoaderCircle, RotateCcw, Save, Trash2,
    UploadCloud, WandSparkles, X,
} from 'lucide-react';
import { useTheme } from '@/Contexts/ThemeContext';

const DIFFICULTY_LABELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const OPTION_KEYS = ['a', 'b', 'c', 'd'];
const PAGE_SIZE = 10;

const errorMessage = (error, fallback) => {
    const errors = error?.response?.data?.errors;
    if (errors && typeof errors === 'object') {
        return Object.values(errors).flat().find(Boolean) || fallback;
    }
    return error?.response?.data?.message || fallback;
};

function Step({ number, label, active, complete }) {
    return (
        <div className="flex min-w-0 items-center gap-2">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-black transition-colors ${complete ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-400 dark:border-white/10 dark:bg-slate-900'}`}>
                {complete ? <Check className="size-4" /> : number}
            </span>
            <span className={`truncate text-xs font-black ${active || complete ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{label}</span>
        </div>
    );
}

function Metric({ label, value, color }) {
    const colors = {
        emerald: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300',
        amber: 'text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300',
        rose: 'text-rose-700 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-300',
        violet: 'text-violet-700 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-300',
    };
    return <div className={`rounded-xl px-3 py-2.5 ${colors[color]}`}><p className="text-[10px] font-bold opacity-75">{label}</p><p className="mt-0.5 text-xl font-black tabular-nums">{value}</p></div>;
}

function QuestionEditor({ question, index, onChange, onRemove, error }) {
    return (
        <article className={`rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${error ? 'border-rose-400 ring-2 ring-rose-100 dark:ring-rose-500/10' : question.needs_review ? 'border-amber-300 dark:border-amber-500/40' : 'border-slate-200 dark:border-white/10'}`}>
            <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 transition hover:bg-slate-50 dark:hover:bg-white/5">
                        <input type="checkbox" checked={question.selected} onChange={(event) => onChange('selected', event.target.checked)} className="size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200">سؤال {index + 1}</span>
                    </label>
                    {question.needs_review && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle className="size-3" /> يحتاج مراجعة</span>}
                    <span className="text-[10px] font-bold text-slate-400">ثقة {Math.round(Number(question.confidence || 0) * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-500">
                        الصعوبة
                        <select value={question.difficulty} onChange={(event) => onChange('difficulty', event.target.value)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
                            {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                    <button type="button" onClick={onRemove} className="flex size-10 cursor-pointer items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:hover:bg-rose-500/10" aria-label={`استبعاد السؤال ${index + 1}`} title="استبعاد السؤال">
                        <Trash2 className="size-4" />
                    </button>
                </div>
            </header>

            <div className="space-y-4 p-4">
                {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
                <label className="block">
                    <span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-300">نص السؤال</span>
                    <textarea value={question.question_text} onChange={(event) => onChange('question_text', event.target.value)} rows="2" className="bulk-question-input resize-y" />
                </label>

                <fieldset>
                    <legend className="mb-2 text-xs font-black text-slate-700 dark:text-slate-300">الخيارات — اختر الدائرة بجانب الإجابة الصحيحة</legend>
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                        {OPTION_KEYS.map((option) => {
                            const correct = question.correct_option === option;
                            return (
                                <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-2 transition-colors ${correct ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10' : 'border-slate-200 bg-slate-50/50 hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.02]'}`}>
                                    <input type="radio" name={`correct-${question.preview_id}`} checked={correct} onChange={() => onChange('correct_option', option)} className="sr-only" />
                                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${correct ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300'}`}>{option.toUpperCase()}</span>
                                    <input value={question[`option_${option}`]} onChange={(event) => onChange(`option_${option}`, event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent px-1 text-base font-bold text-slate-800 outline-none focus:ring-0 dark:text-slate-100 sm:text-sm" />
                                    {correct ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <Circle className="size-4 shrink-0 text-slate-300" />}
                                </label>
                            );
                        })}
                    </div>
                </fieldset>

                <label className="block">
                    <span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-300">شرح الإجابة <span className="font-bold text-slate-400">(اختياري)</span></span>
                    <textarea value={question.explanation || ''} onChange={(event) => onChange('explanation', event.target.value)} rows="2" className="bulk-question-input resize-y" placeholder="سبب صحة الإجابة الذي سيظهر للطالب بعد الحل" />
                </label>

                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5">
                    <input type="checkbox" checked={question.is_active} onChange={(event) => onChange('is_active', event.target.checked)} className="size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    نشر السؤال مباشرة بعد الحفظ
                </label>
            </div>
        </article>
    );
}

export default function BulkQuestionImport({ courses = [], chapters = [], initialCourseId = '', onClose, onSaved }) {
    const { isDark } = useTheme();
    const [stage, setStage] = React.useState('source');
    const [courseId, setCourseId] = React.useState(String(initialCourseId || ''));
    const [chapterId, setChapterId] = React.useState('');
    const [sourceText, setSourceText] = React.useState('');
    const [file, setFile] = React.useState(null);
    const [dragging, setDragging] = React.useState(false);
    const [analyzing, setAnalyzing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [questions, setQuestions] = React.useState([]);
    const [warnings, setWarnings] = React.useState([]);
    const [destination, setDestination] = React.useState(null);
    const [rowErrors, setRowErrors] = React.useState({});
    const [page, setPage] = React.useState(1);
    const fileInput = React.useRef(null);

    const availableChapters = React.useMemo(() => chapters.filter((chapter) => String(chapter.course_id) === String(courseId)), [chapters, courseId]);
    const selectedCount = questions.filter((question) => question.selected).length;
    const needsReview = questions.filter((question) => question.selected && question.needs_review).length;
    const difficultySummary = React.useMemo(() => ({
        easy: questions.filter((question) => question.selected && question.difficulty === 'easy').length,
        medium: questions.filter((question) => question.selected && question.difficulty === 'medium').length,
        hard: questions.filter((question) => question.selected && question.difficulty === 'hard').length,
    }), [questions]);
    const totalPages = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));
    const pageQuestions = questions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    React.useEffect(() => {
        if (availableChapters.length === 1) setChapterId(String(availableChapters[0].id));
        else if (!availableChapters.some((chapter) => String(chapter.id) === chapterId)) setChapterId('');
    }, [availableChapters, chapterId]);

    const acceptFile = (candidate) => {
        if (!candidate) return;
        const allowed = ['pdf', 'txt', 'csv', 'json', 'jpg', 'jpeg', 'png', 'webp'];
        const extension = String(candidate.name || '').split('.').pop().toLowerCase();
        if (!allowed.includes(extension)) {
            setError('نوع الملف غير مدعوم. استخدم PDF، صورة، TXT، CSV أو JSON.');
            return;
        }
        if (candidate.size > 8 * 1024 * 1024) {
            setError('حجم الملف أكبر من 8MB. قسّمه إلى ملف أصغر ثم حاول مجدداً.');
            return;
        }
        setFile(candidate);
        setError('');
    };

    const analyze = async () => {
        if (!chapterId) {
            setError('اختر المادة والشابتر الذي ستُحفظ فيه الأسئلة.');
            return;
        }
        if (!file && !sourceText.trim()) {
            setError('ارفع ملفاً أو الصق نص الأسئلة مع الإجابات.');
            return;
        }

        setAnalyzing(true);
        setError('');
        const payload = new FormData();
        payload.append('chapter_id', chapterId);
        if (file) payload.append('file', file);
        if (sourceText.trim()) payload.append('source_text', sourceText.trim());

        try {
            const response = await axios.post(route('admin.questions.bulk.analyze'), payload, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 90000,
            });
            const extracted = Array.isArray(response.data?.questions) ? response.data.questions : [];
            setQuestions(extracted);
            setWarnings(Array.isArray(response.data?.warnings) ? response.data.warnings : []);
            setDestination(response.data?.destination || null);
            setStage('review');
            setPage(1);
            if (extracted.length === 0) setError('انتهى التحليل لكن لم يتم العثور على أسئلة مكتملة. راجع التحذيرات أو جرّب صيغة أوضح.');
        } catch (requestError) {
            setError(errorMessage(requestError, 'تعذر تحليل المصدر. حاول مرة أخرى.'));
        } finally {
            setAnalyzing(false);
        }
    };

    const updateQuestion = (previewId, field, value) => {
        setQuestions((current) => current.map((question) => question.preview_id === previewId ? { ...question, [field]: value } : question));
        setRowErrors((current) => ({ ...current, [previewId]: undefined }));
    };

    const excludeQuestion = (previewId) => {
        setQuestions((current) => current.map((question) => question.preview_id === previewId ? { ...question, selected: false } : question));
    };

    const validateSelected = () => {
        const errors = {};
        questions.filter((question) => question.selected).forEach((question) => {
            const required = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option'];
            if (required.some((field) => !String(question[field] || '').trim())) errors[question.preview_id] = 'أكمل نص السؤال والخيارات وحدد الإجابة الصحيحة.';
        });
        setRowErrors(errors);
        if (Object.keys(errors).length) {
            const firstIndex = questions.findIndex((question) => errors[question.preview_id]);
            setPage(Math.floor(firstIndex / PAGE_SIZE) + 1);
            setError('يوجد سؤال غير مكتمل. تم نقلك إلى الصفحة التي تحتاج مراجعة.');
            return false;
        }
        return true;
    };

    const save = async () => {
        const selected = questions.filter((question) => question.selected);
        if (!selected.length) {
            setError('اختر سؤالاً واحداً على الأقل للحفظ.');
            return;
        }
        if (!validateSelected()) return;

        setSaving(true);
        setError('');
        try {
            const response = await axios.post(route('admin.questions.bulk.store'), {
                chapter_id: destination?.chapter_id || chapterId,
                questions: selected.map(({ question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, is_active }) => ({
                    question_text, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, is_active,
                })),
            });
            await Swal.fire({
                icon: 'success',
                title: 'تم إنشاء بنك الأسئلة',
                text: `${response.data.message}${response.data.skipped_duplicates ? ` تم تجاوز ${response.data.skipped_duplicates} مكرر.` : ''}`,
                confirmButtonText: 'ممتاز',
            });
            onSaved?.(response.data);
        } catch (requestError) {
            setError(errorMessage(requestError, 'تعذر حفظ الأسئلة. راجع البيانات وحاول مجدداً.'));
        } finally {
            setSaving(false);
        }
    };

    const setAllSelected = (selected) => setQuestions((current) => current.map((question) => ({ ...question, selected })));
    const setSelectedDifficulty = (difficulty) => setQuestions((current) => current.map((question) => question.selected ? { ...question, difficulty } : question));

    return (
        <div className={`fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6 ${isDark ? 'dark' : ''}`} role="dialog" aria-modal="true" aria-labelledby="bulk-import-title" dir="rtl">
            <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center">
                <section className="my-3 w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-white/10 dark:bg-slate-950 sm:my-6">
                    <header className="border-b border-slate-200 bg-white px-5 py-5 dark:border-white/10 dark:bg-slate-900 sm:px-7">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"><WandSparkles className="size-5" /></span>
                                <div><h2 id="bulk-import-title" className="text-xl font-black text-slate-950 dark:text-white">إضافة الأسئلة بالذكاء الاصطناعي</h2><p className="mt-1 text-xs font-bold leading-5 text-slate-500">ارفع الأسئلة مع الإجابات، راجع التحليل، ثم احفظ الدفعة كاملة.</p></div>
                            </div>
                            <button type="button" onClick={onClose} disabled={analyzing || saving} className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5" aria-label="إغلاق"><X className="size-5" /></button>
                        </div>
                        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
                            <Step number="1" label="الوجهة والمصدر" active={stage === 'source'} complete={stage === 'review'} />
                            <Step number="2" label="المراجعة والتوزيع" active={stage === 'review'} complete={false} />
                            <Step number="3" label="الحفظ النهائي" active={false} complete={false} />
                        </div>
                    </header>

                    <div className="max-h-[calc(100dvh-235px)] overflow-y-auto p-4 sm:p-7">
                        {error && <div role="alert" aria-live="assertive" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><span>{error}</span></div>}

                        {stage === 'source' ? (
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                                <div className="space-y-5 lg:col-span-2">
                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
                                        <div className="mb-4 flex items-center gap-2"><BookOpen className="size-5 text-violet-600" /><h3 className="text-sm font-black text-slate-900 dark:text-white">1. اختر مكان حفظ الأسئلة</h3></div>
                                        <label className="block"><span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-300">المادة</span><select value={courseId} onChange={(event) => { setCourseId(event.target.value); setChapterId(''); }} className="bulk-question-input"><option value="">اختر المادة…</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name} ({course.code})</option>)}</select></label>
                                        <label className="mt-4 block"><span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-300">الشابتر</span><select value={chapterId} onChange={(event) => setChapterId(event.target.value)} disabled={!courseId} className="bulk-question-input disabled:cursor-not-allowed disabled:opacity-50"><option value="">اختر الشابتر…</option>{availableChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
                                        {courseId && availableChapters.length === 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">لا يوجد شابتر لهذه المادة. أنشئ شابتر أولاً من صفحة إدارة الشابترز.</p>}
                                    </section>

                                    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-500/20 dark:bg-violet-500/10">
                                        <h3 className="text-sm font-black text-violet-900 dark:text-violet-200">ماذا سيفعل التحليل؟</h3>
                                        <ul className="mt-3 space-y-2 text-xs font-bold leading-5 text-violet-800/80 dark:text-violet-200/80">
                                            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> يستخرج الأسئلة والإجابات من PDF أو الصور والنص.</li>
                                            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> يحوّل سؤال/جواب إلى أربعة خيارات منطقية.</li>
                                            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> يوزع الصعوبة ومواقع الإجابات الصحيحة بشكل متوازن.</li>
                                            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> يستبعد المكرر ولا يحفظ شيئاً قبل مراجعتك.</li>
                                        </ul>
                                    </section>
                                </div>

                                <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900 lg:col-span-3">
                                    <div className="mb-4 flex items-center gap-2"><FileText className="size-5 text-violet-600" /><h3 className="text-sm font-black text-slate-900 dark:text-white">2. أرفق الأسئلة مع الإجابات</h3></div>
                                    <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }} className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : file ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-slate-300 bg-slate-50/60 dark:border-white/15 dark:bg-white/[0.02]'}`}>
                                        <input ref={fileInput} type="file" accept=".pdf,.txt,.csv,.json,.jpg,.jpeg,.png,.webp" onChange={(event) => acceptFile(event.target.files?.[0])} className="sr-only" />
                                        {file ? <><CheckCircle2 className="mx-auto size-9 text-emerald-600" /><p className="mt-3 break-all text-sm font-black text-slate-900 dark:text-white">{file.name}</p><p className="mt-1 text-xs font-bold text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={() => fileInput.current?.click()} className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">تغيير الملف</button><button type="button" onClick={() => setFile(null)} className="min-h-11 cursor-pointer rounded-xl px-4 text-xs font-black text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-rose-300 dark:hover:bg-rose-500/10">إزالة</button></div></> : <><UploadCloud className="mx-auto size-10 text-violet-500" /><p className="mt-3 text-sm font-black text-slate-900 dark:text-white">اسحب الملف هنا أو اختره من جهازك</p><p className="mt-2 text-xs font-bold text-slate-500">PDF، صور، TXT، CSV أو JSON — حتى 8MB</p><button type="button" onClick={() => fileInput.current?.click()} className="mt-4 min-h-11 cursor-pointer rounded-xl bg-violet-600 px-5 text-xs font-black text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2">اختيار ملف</button></>}
                                    </div>

                                    <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /><span className="text-[11px] font-black text-slate-400">أو الصق النص مباشرة</span><span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                                    <label className="block"><span className="mb-2 block text-xs font-black text-slate-700 dark:text-slate-300">نص الأسئلة والإجابات</span><textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows="10" className="bulk-question-input resize-y leading-7" placeholder={'مثال:\n1. ما وظيفة وحدة المعالجة؟\nA) تخزين الملفات\nB) تنفيذ التعليمات\nC) عرض الصور\nD) الاتصال بالشبكة\nالإجابة: B\nالشرح: تنفذ وحدة المعالجة تعليمات البرامج.'} /></label>
                                </section>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900 sm:p-5">
                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                        <div><p className="text-[11px] font-black text-violet-600">وجهة الحفظ</p><h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">{destination?.course_name} · {destination?.chapter_title}</h3><p className="mt-1 text-xs font-bold text-slate-500">اختر الأسئلة المطلوبة وعدّل أي محتوى قبل الحفظ.</p></div>
                                        <div className="grid grid-cols-4 gap-2"><Metric label="سهل" value={difficultySummary.easy} color="emerald" /><Metric label="متوسط" value={difficultySummary.medium} color="amber" /><Metric label="صعب" value={difficultySummary.hard} color="rose" /><Metric label="للمراجعة" value={needsReview} color="violet" /></div>
                                    </div>
                                </section>

                                {warnings.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10"><h3 className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200"><AlertTriangle className="size-4" /> ملاحظات التحليل</h3><ul className="mt-2 list-inside list-disc space-y-1 text-xs font-bold leading-5 text-amber-800 dark:text-amber-200/80">{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></section>}

                                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                                    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setAllSelected(true)} className="bulk-secondary-button">تحديد الكل</button><button type="button" onClick={() => setAllSelected(false)} className="bulk-secondary-button">إلغاء التحديد</button><select defaultValue="" onChange={(event) => { if (event.target.value) setSelectedDifficulty(event.target.value); event.target.value = ''; }} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"><option value="">تغيير صعوبة المحدد…</option>{Object.entries(DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                                    <p className="text-xs font-black text-slate-600 dark:text-slate-300">تم اختيار {selectedCount} من {questions.length}</p>
                                </div>

                                {questions.length ? <div className="space-y-4">{pageQuestions.map((question, localIndex) => <QuestionEditor key={question.preview_id} question={question} index={(page - 1) * PAGE_SIZE + localIndex} onChange={(field, value) => updateQuestion(question.preview_id, field, value)} onRemove={() => excludeQuestion(question.preview_id)} error={rowErrors[question.preview_id]} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-white/10 dark:bg-slate-900"><FileText className="mx-auto size-9 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-600 dark:text-slate-300">لم يتم استخراج أسئلة مكتملة.</p></div>}

                                {totalPages > 1 && <nav className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900" aria-label="صفحات معاينة الأسئلة"><button type="button" disabled={page === 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); document.querySelector('[aria-labelledby=bulk-import-title]')?.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bulk-secondary-button disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="size-4" /> السابق</button><span className="text-xs font-black text-slate-500">صفحة {page} من {totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="bulk-secondary-button disabled:cursor-not-allowed disabled:opacity-40">التالي <ChevronLeft className="size-4" /></button></nav>}
                            </div>
                        )}
                    </div>

                    <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                        <button type="button" onClick={onClose} disabled={analyzing || saving} className="min-h-11 cursor-pointer rounded-xl px-5 text-xs font-black text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/5">إلغاء</button>
                        {stage === 'source' ? <button type="button" onClick={analyze} disabled={analyzing || !chapterId || (!file && !sourceText.trim())} className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45">{analyzing ? <LoaderCircle className="size-5 animate-spin" /> : <WandSparkles className="size-5" />}{analyzing ? 'يتم تحليل الأسئلة وتدقيقها…' : 'تحليل وإنشاء المعاينة'}</button> : <div className="flex flex-col-reverse gap-2 sm:flex-row"><button type="button" onClick={() => { setStage('source'); setError(''); }} disabled={saving} className="bulk-secondary-button"><RotateCcw className="size-4" /> تغيير المصدر</button><button type="button" onClick={save} disabled={saving || selectedCount === 0} className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45">{saving ? <LoaderCircle className="size-5 animate-spin" /> : <Save className="size-5" />}{saving ? 'جارٍ حفظ الدفعة…' : `حفظ ${selectedCount} سؤال`}</button></div>}
                    </footer>
                </section>
            </div>

            <style>{`
                .bulk-question-input { width: 100%; min-height: 44px; border-radius: .75rem; border: 1px solid #cbd5e1; background: #fff; padding: .7rem .85rem; font-size: 1rem; font-weight: 700; color: #0f172a; outline: none; transition: border-color 150ms, box-shadow 150ms; }
                .bulk-question-input:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,.14); }
                .bulk-secondary-button { display: inline-flex; min-height: 44px; cursor: pointer; align-items: center; justify-content: center; gap: .4rem; border-radius: .75rem; border: 1px solid #e2e8f0; background: #fff; padding: 0 .9rem; font-size: .75rem; font-weight: 900; color: #475569; transition: background-color 150ms, border-color 150ms; }
                .bulk-secondary-button:hover { border-color: #c4b5fd; background: #faf5ff; }
                .bulk-secondary-button:focus { outline: 2px solid #7c3aed; outline-offset: 2px; }
                .dark .bulk-question-input { border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.035); color: #f8fafc; }
                .dark .bulk-secondary-button { border-color: rgba(255,255,255,.1); background: rgba(255,255,255,.035); color: #e2e8f0; }
                .dark .bulk-secondary-button:hover { border-color: rgba(167,139,250,.5); background: rgba(124,58,237,.1); }
                @media (min-width: 640px) { .bulk-question-input { font-size: .875rem; } }
                @media (prefers-reduced-motion: reduce) { .bulk-question-input, .bulk-secondary-button { transition-duration: .01ms !important; } }
            `}</style>
        </div>
    );
}
