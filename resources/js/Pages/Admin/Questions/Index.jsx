import React, { useState, useEffect, useMemo } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function AdminQuestions({ questions = [], courses = [], chapters = [], majors = [], filters = {}, stats = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();

    // Safety check for props that might be null
    questions = questions || [];
    courses = courses || [];
    chapters = chapters || [];
    majors = majors || [];
    filters = filters || {};
    stats = stats || {};

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [localSearch, setLocalSearch] = useState(filters.search || '');
    const [expandedQ, setExpandedQ] = useState(null);

    const t = lang === 'ar' ? {
        title: 'إدارة الأسئلة',
        addQuestion: 'إضافة سؤال',
        course: 'المادة',
        major: 'التخصص',
        chapter: 'الشابتر',
        questionText: 'نص السؤال',
        optionA: 'الخيار A',
        optionB: 'الخيار B',
        optionC: 'الخيار C',
        optionD: 'الخيار D',
        correctOption: 'الإجابة الصحيحة',
        explanation: 'الشرح (اختياري)',
        difficulty: 'الصعوبة',
        easy: 'سهل',
        medium: 'متوسط',
        hard: 'صعب',
        active: 'مفعّل',
        save: 'حفظ',
        update: 'تحديث',
        cancel: 'إلغاء',
        delete: 'حذف',
        edit: 'تعديل',
        confirmDelete: 'هل أنت متأكد من حذف هذا السؤال؟',
        noQuestions: 'لا يوجد أسئلة',
        noQuestionsDesc: 'ابدأ بإضافة سؤال لأي مادة من الزر أعلاه',
        all: 'الكل',
        searchPlaceholder: 'ابحث بنص السؤال...',
        totalQuestions: 'إجمالي الأسئلة',
        university: 'مواد الجامعة',
        selectMajor: 'اختر التخصص',
        selectCourse: 'اختر المادة',
        selectChapter: 'بدون شابتر',
        noChapter: 'عام',
        allDifficulties: 'كل الصعوبات',
        correct: 'الصحيحة',
        hidden: 'مخفي',
        markCorrect: 'حدد كإجابة صحيحة',
    } : {
        title: 'Manage Questions',
        addQuestion: 'Add Question',
        course: 'Course',
        major: 'Major',
        chapter: 'Chapter',
        questionText: 'Question text',
        optionA: 'Option A',
        optionB: 'Option B',
        optionC: 'Option C',
        optionD: 'Option D',
        correctOption: 'Correct answer',
        explanation: 'Explanation (optional)',
        difficulty: 'Difficulty',
        easy: 'Easy',
        medium: 'Medium',
        hard: 'Hard',
        active: 'Active',
        save: 'Save',
        update: 'Update',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        confirmDelete: 'Are you sure you want to delete this question?',
        noQuestions: 'No questions yet',
        noQuestionsDesc: 'Start by adding a question using the button above',
        all: 'All',
        searchPlaceholder: 'Search by question text...',
        totalQuestions: 'Total Questions',
        university: 'University Courses',
        selectMajor: 'Select major',
        selectCourse: 'Select course',
        selectChapter: 'No chapter',
        noChapter: 'General',
        allDifficulties: 'All difficulties',
        correct: 'Correct',
        hidden: 'Hidden',
        markCorrect: 'Mark as correct',
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = `w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    const { data, setData, post, put, processing, reset, errors } = useForm({
        course_id: '',
        chapter_id: '',
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'a',
        explanation: '',
        difficulty: 'medium',
        is_active: true,
    });

    // Filtered chapters for the form dropdown based on selected course
    const formChapters = useMemo(() => {
        if (!data.course_id) return [];
        return chapters.filter(ch => String(ch.course_id) === String(data.course_id));
    }, [data.course_id, chapters]);

    const openCreate = () => { reset(); setEditingId(null); setShowForm(true); };
    const openEdit = (q) => {
        setData({
            course_id: q.course_id,
            chapter_id: q.chapter_id || '',
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_option: q.correct_option,
            explanation: q.explanation || '',
            difficulty: q.difficulty,
            is_active: q.is_active,
        });
        setEditingId(q.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            put(`/admin/questions/${editingId}`, { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); setEditingId(null); } });
        } else {
            post('/admin/questions', { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); } });
        }
    };

    const handleDelete = (id) => { if (confirm(t.confirmDelete)) router.delete(`/admin/questions/${id}`, { preserveScroll: true }); };

    const applyFilter = (params) => {
        const current = { ...filters, ...params };
        if ('major_id' in params) { delete current.course_id; delete current.chapter_id; }
        if ('course_id' in params) { delete current.chapter_id; }
        Object.keys(current).forEach(k => { if (!current[k]) delete current[k]; });
        router.get('/admin/questions', current, { preserveState: true, preserveScroll: true });
    };

    const handleSearchSubmit = (e) => { e.preventDefault(); applyFilter({ search: localSearch }); };

    const diffBadge = (d) => {
        if (d === 'easy') return { cls: isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700', icon: '🌿', label: t.easy };
        if (d === 'hard') return { cls: isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700', icon: '🔥', label: t.hard };
        return { cls: isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700', icon: '⚖️', label: t.medium };
    };

    const optionLabels = { a: 'A', b: 'B', c: 'C', d: 'D' };

    return (
        <AdminLayout>
            <Head title={`${t.title} | سنفور`} />

            <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className={`text-2xl font-[900] flex items-center gap-3 ${heading}`}>
                            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center text-lg text-white shadow-lg">❓</span>
                            {t.title}
                        </h2>
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-pink-600 text-white rounded-xl font-[800] text-[12px] shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all active:scale-[0.97]">
                        <span className="text-lg">+</span> {t.addQuestion}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: t.totalQuestions, value: stats.total || 0, color: 'indigo', icon: '📝' },
                        { label: t.easy, value: stats.easy || 0, color: 'emerald', icon: '🌿' },
                        { label: t.medium, value: stats.medium || 0, color: 'amber', icon: '⚖️' },
                        { label: t.hard, value: stats.hard || 0, color: 'rose', icon: '🔥' },
                    ].map((s, i) => (
                        <div key={i} className={`rounded-2xl border p-3.5 text-center ${card}`}>
                            <span className="text-lg">{s.icon}</span>
                            <p className={`text-xl font-[900] mt-0.5 text-${s.color}-500`}>{s.value}</p>
                            <p className={`text-[9px] font-bold ${subtext}`}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className={`rounded-2xl border p-4 ${card}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                        <select value={filters.major_id || ''} onChange={e => applyFilter({ major_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.major}</option>
                            <option value="university">{t.university}</option>
                            {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <select value={filters.study_plan || ''} onChange={e => applyFilter({ study_plan: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.studyPlan}</option>
                            {(props.studyPlans || []).map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <select value={filters.course_id || ''} onChange={e => applyFilter({ course_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.course}</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code}) - {c.study_plan_version}</option>)}
                        </select>
                        <select value={filters.chapter_id || ''} onChange={e => applyFilter({ chapter_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.chapter}</option>
                            {chapters.map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
                        </select>
                        <select value={filters.difficulty || ''} onChange={e => applyFilter({ difficulty: e.target.value })} className={inputCls}>
                            <option value="">{t.allDifficulties}</option>
                            <option value="easy">🌿 {t.easy}</option>
                            <option value="medium">⚖️ {t.medium}</option>
                            <option value="hard">🔥 {t.hard}</option>
                        </select>
                        <form onSubmit={handleSearchSubmit} className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-40">🔍</span>
                            <input type="text" value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder={t.searchPlaceholder} className={`${inputCls} pr-9`} />
                        </form>
                    </div>
                </div>

                {/* Create / Edit Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className={`rounded-2xl border p-6 shadow-md space-y-5 ${card}`}>
                        <div className="flex items-center justify-between">
                            <h3 className={`text-[15px] font-[900] ${heading}`}>{editingId ? `✏️ ${t.update}` : `➕ ${t.addQuestion}`}</h3>
                            <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className="text-lg opacity-50 hover:opacity-100 transition-opacity">✕</button>
                        </div>

                        {/* Row 1: Course, Chapter, Difficulty */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.course} *</label>
                                <select value={data.course_id} onChange={e => { setData('course_id', e.target.value); setData('chapter_id', ''); }} className={inputCls} required>
                                    <option value="">— {t.selectCourse} —</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                </select>
                                {errors.course_id && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.course_id}</p>}
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.chapter}</label>
                                <select value={data.chapter_id} onChange={e => setData('chapter_id', e.target.value)} className={inputCls}>
                                    <option value="">{t.selectChapter}</option>
                                    {formChapters.map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.difficulty} *</label>
                                <div className="flex gap-2">
                                    {['easy', 'medium', 'hard'].map(d => {
                                        const b = diffBadge(d);
                                        return (
                                            <button key={d} type="button" onClick={() => setData('difficulty', d)} className={`flex-1 py-2.5 rounded-xl text-[11px] font-[800] border transition-all ${data.difficulty === d ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : (isDark ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200')}`}>
                                                {b.icon} {b.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Question Text */}
                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.questionText} *</label>
                            <textarea value={data.question_text} onChange={e => setData('question_text', e.target.value)} rows={3} className={inputCls} required placeholder="اكتب نص السؤال هنا..." />
                            {errors.question_text && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.question_text}</p>}
                        </div>

                        {/* Options with correct answer toggle */}
                        <div>
                            <label className={`text-[11px] font-black block mb-2 ${subtext}`}>الخيارات * — {lang === 'ar' ? 'اضغط ✓ لتحديد الإجابة الصحيحة' : 'Click ✓ to mark the correct answer'}</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {['a', 'b', 'c', 'd'].map(opt => (
                                    <div key={opt} className={`flex gap-2 items-center p-1 rounded-xl border transition-all ${data.correct_option === opt ? (isDark ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-emerald-400 bg-emerald-50/50') : (isDark ? 'border-slate-700' : 'border-slate-200')}`}>
                                        <span className={`w-8 text-center text-[12px] font-[900] shrink-0 ${data.correct_option === opt ? 'text-emerald-500' : subtext}`}>{optionLabels[opt]}</span>
                                        <input type="text" value={data[`option_${opt}`]} onChange={e => setData(`option_${opt}`, e.target.value)} className={`flex-1 bg-transparent border-0 outline-none text-sm font-bold py-2 ${heading}`} required placeholder={`${t[`option${opt.toUpperCase()}`]}...`} />
                                        <button type="button" onClick={() => setData('correct_option', opt)} title={t.markCorrect} className={`w-9 h-9 rounded-lg shrink-0 text-[13px] font-[900] transition-all ${data.correct_option === opt ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : (isDark ? 'bg-slate-800 text-slate-500 hover:bg-emerald-500/20' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100')}`}>
                                            ✓
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Explanation */}
                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.explanation}</label>
                            <textarea value={data.explanation} onChange={e => setData('explanation', e.target.value)} rows={2} className={inputCls} placeholder="شرح اختياري يظهر للطالب بعد الإجابة..." />
                        </div>

                        {/* Active toggle + Submit */}
                        <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <button type="button" onClick={() => setData('is_active', !data.is_active)} className={`w-12 h-7 rounded-full transition-all p-0.5 ${data.is_active ? 'bg-emerald-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')}`}>
                                    <span className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform ${data.is_active ? (lang === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`} />
                                </button>
                                <span className={`text-[12px] font-bold ${subtext}`}>{t.active}</span>
                            </label>

                            <div className="flex gap-3">
                                <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className={`px-6 py-2.5 rounded-xl font-[800] text-[12px] border transition-all ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.cancel}</button>
                                <button type="submit" disabled={processing} className="px-7 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 text-white rounded-xl font-[800] text-[12px] shadow-md disabled:opacity-50">{editingId ? t.update : t.save}</button>
                            </div>
                        </div>
                    </form>
                )}

                {/* Questions List */}
                {questions.length === 0 ? (
                    <div className={`rounded-2xl border p-16 text-center ${card}`}>
                        <div className="text-5xl mb-4 opacity-20">❓</div>
                        <p className={`text-base font-[800] ${heading}`}>{t.noQuestions}</p>
                        <p className={`text-[12px] font-bold mt-1 ${subtext}`}>{t.noQuestionsDesc}</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {questions.map((question) => {
                            const db = diffBadge(question.difficulty);
                            const isExpanded = expandedQ === question.id;
                            return (
                                <div key={question.id} className={`rounded-2xl border transition-all ${card} ${isExpanded ? (isDark ? 'ring-1 ring-indigo-500/30' : 'ring-1 ring-indigo-200') : ''}`}>
                                    {/* Question summary row */}
                                    <button onClick={() => setExpandedQ(isExpanded ? null : question.id)} className={`w-full text-right px-5 py-4 flex items-start gap-3.5`}>
                                        <span className={`shrink-0 mt-0.5 text-[10px] font-[900] px-2 py-1 rounded-lg ${db.cls}`}>{db.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[13px] font-[800] leading-relaxed line-clamp-2 ${heading}`}>{question.question_text}</p>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{question.course?.code}</span>
                                                {question.chapter && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>{question.chapter.title}</span>}
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>✓ {optionLabels[question.correct_option]}</span>
                                                {!question.is_active && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700'}`}>{t.hidden}</span>}
                                            </div>
                                        </div>
                                        <span className={`text-sm shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} ${subtext}`}>▾</span>
                                    </button>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className={`px-5 pb-5 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                {['a', 'b', 'c', 'd'].map(opt => (
                                                    <div key={opt} className={`px-3.5 py-2.5 rounded-xl border text-[12px] font-bold ${question.correct_option === opt ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800') : (isDark ? 'bg-slate-900/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')}`}>
                                                        <span className="font-[900] opacity-50">{optionLabels[opt]}.</span> {question[`option_${opt}`]}
                                                    </div>
                                                ))}
                                            </div>
                                            {question.explanation && (
                                                <div className={`mt-3 p-3 rounded-xl border text-[11px] font-bold leading-relaxed ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                                                    💡 {question.explanation}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 mt-4 justify-end">
                                                <button onClick={() => openEdit(question)} className={`px-4 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}>✏️ {t.edit}</button>
                                                <button onClick={() => handleDelete(question.id)} className={`px-4 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-600 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white'}`}>🗑️ {t.delete}</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
