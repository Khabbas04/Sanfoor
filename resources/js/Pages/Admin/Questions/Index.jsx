import React, { useState, useEffect } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function AdminQuestions({ questions = [], courses = [], chapters = [], filters = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [filteredChapters, setFilteredChapters] = useState(chapters);

    const t = lang === 'ar' ? {
        title: 'إدارة الأسئلة',
        addQuestion: '+ إضافة سؤال',
        course: 'المادة',
        chapter: 'الشابتر (اختياري)',
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
        noQuestions: 'لا يوجد أسئلة. أضف أول سؤال!',
        filterAll: 'الكل',
        correct: 'الصحيحة',
        allChapters: 'بدون شابتر',
        allDifficulties: 'كل الصعوبات',
    } : {
        title: 'Manage Questions',
        addQuestion: '+ Add Question',
        course: 'Course',
        chapter: 'Chapter (optional)',
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
        noQuestions: 'No questions yet. Add the first one!',
        filterAll: 'All',
        correct: 'Correct',
        allChapters: 'No chapter',
        allDifficulties: 'All difficulties',
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = `w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

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

    // Update filtered chapters when course changes in form
    useEffect(() => {
        if (data.course_id) {
            setFilteredChapters(chapters.filter(ch => String(ch.course_id) === String(data.course_id)));
        } else {
            setFilteredChapters(chapters);
        }
    }, [data.course_id, chapters]);

    const openCreate = () => {
        reset();
        setEditingId(null);
        setShowForm(true);
    };

    const openEdit = (question) => {
        setData({
            course_id: question.course_id,
            chapter_id: question.chapter_id || '',
            question_text: question.question_text,
            option_a: question.option_a,
            option_b: question.option_b,
            option_c: question.option_c,
            option_d: question.option_d,
            correct_option: question.correct_option,
            explanation: question.explanation || '',
            difficulty: question.difficulty,
            is_active: question.is_active,
        });
        setEditingId(question.id);
        setShowForm(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const payload = { ...data };
        if (!payload.chapter_id) payload.chapter_id = null;

        if (editingId) {
            put(route('admin.questions.update', editingId), { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); setEditingId(null); } });
        } else {
            post(route('admin.questions.store'), { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); } });
        }
    };

    const handleDelete = (id) => {
        if (!confirm(t.confirmDelete)) return;
        router.delete(route('admin.questions.destroy', id), { preserveScroll: true });
    };

    const handleFilter = (params) => {
        const current = { ...filters, ...params };
        Object.keys(current).forEach(k => { if (!current[k]) delete current[k]; });
        router.get(route('admin.questions.index'), current, { preserveState: true, preserveScroll: true });
    };

    const difficultyBadge = (d) => {
        if (d === 'easy') return isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700';
        if (d === 'hard') return isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700';
        return isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700';
    };

    const optionLabels = { a: 'A', b: 'B', c: 'C', d: 'D' };

    return (
        <AdminLayout>
            <Head title={`${t.title} | سنفور`} />

            <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className={`text-2xl font-[900] ${heading}`}>❓ {t.title}</h2>
                        <p className={`text-[12px] font-bold mt-1 ${subtext}`}>{questions.length} سؤال</p>
                    </div>
                    <button onClick={openCreate} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-[800] text-[12px] shadow-md hover:bg-indigo-700 transition-all">
                        {t.addQuestion}
                    </button>
                </div>

                {/* Filters */}
                <div className="flex gap-3 flex-wrap">
                    <select value={filters.course_id || ''} onChange={e => handleFilter({ course_id: e.target.value, chapter_id: '' })} className={`${inputCls} max-w-[220px]`}>
                        <option value="">{t.filterAll} — {t.course}</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                    </select>
                    <select value={filters.difficulty || ''} onChange={e => handleFilter({ difficulty: e.target.value })} className={`${inputCls} max-w-[180px]`}>
                        <option value="">{t.allDifficulties}</option>
                        <option value="easy">{t.easy}</option>
                        <option value="medium">{t.medium}</option>
                        <option value="hard">{t.hard}</option>
                    </select>
                </div>

                {/* Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className={`rounded-[2rem] border p-6 shadow-sm space-y-4 ${card}`}>
                        <h3 className={`text-[14px] font-[900] ${heading}`}>{editingId ? t.update : t.addQuestion}</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.course}</label>
                                <select value={data.course_id} onChange={e => setData('course_id', e.target.value)} className={inputCls} required>
                                    <option value="">—</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                </select>
                                {errors.course_id && <p className="text-[10px] text-rose-500 mt-1">{errors.course_id}</p>}
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.chapter}</label>
                                <select value={data.chapter_id} onChange={e => setData('chapter_id', e.target.value)} className={inputCls}>
                                    <option value="">{t.allChapters}</option>
                                    {filteredChapters.map(ch => <option key={ch.id} value={ch.id}>{ch.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.difficulty}</label>
                                <select value={data.difficulty} onChange={e => setData('difficulty', e.target.value)} className={inputCls}>
                                    <option value="easy">{t.easy}</option>
                                    <option value="medium">{t.medium}</option>
                                    <option value="hard">{t.hard}</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.questionText}</label>
                            <textarea value={data.question_text} onChange={e => setData('question_text', e.target.value)} rows={3} className={inputCls} required />
                            {errors.question_text && <p className="text-[10px] text-rose-500 mt-1">{errors.question_text}</p>}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {['a', 'b', 'c', 'd'].map(opt => (
                                <div key={opt}>
                                    <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t[`option${opt.toUpperCase()}`]}</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={data[`option_${opt}`]} onChange={e => setData(`option_${opt}`, e.target.value)} className={`${inputCls} flex-1`} required />
                                        <button
                                            type="button"
                                            onClick={() => setData('correct_option', opt)}
                                            className={`w-10 h-10 rounded-xl shrink-0 text-[12px] font-[900] transition-all ${data.correct_option === opt ? 'bg-emerald-500 text-white shadow-md' : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}
                                            title={t.correct}
                                        >
                                            ✓
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.explanation}</label>
                            <textarea value={data.explanation} onChange={e => setData('explanation', e.target.value)} rows={2} className={inputCls} />
                        </div>

                        <div className="flex items-center gap-6 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <button type="button" onClick={() => setData('is_active', !data.is_active)} className={`w-12 h-7 rounded-full transition-colors p-1 ${data.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                    <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${data.is_active ? '' : (lang === 'ar' ? 'translate-x-0' : '-translate-x-5')}`} />
                                </button>
                                <span className={`text-[12px] font-bold ${subtext}`}>{t.active}</span>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={processing} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-[800] text-[12px] disabled:opacity-50">{editingId ? t.update : t.save}</button>
                            <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className={`px-6 py-2.5 rounded-xl font-[800] text-[12px] border ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.cancel}</button>
                        </div>
                    </form>
                )}

                {/* Questions List */}
                {questions.length === 0 ? (
                    <div className={`rounded-[2rem] border p-12 text-center ${card}`}>
                        <div className="text-4xl mb-3 opacity-30">❓</div>
                        <p className={`text-sm font-bold ${subtext}`}>{t.noQuestions}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {questions.map((question, idx) => (
                            <div key={question.id} className={`rounded-2xl border p-5 transition-colors ${card} ${isDark ? 'hover:border-indigo-500/40' : 'hover:border-indigo-200'}`}>
                                <div className="flex items-start justify-between gap-4 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[13px] font-[800] leading-relaxed ${heading}`}>{question.question_text}</p>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            <span className={`text-[10px] font-bold font-mono ${subtext}`}>{question.course?.code}</span>
                                            {question.chapter && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{question.chapter.title}</span>}
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${difficultyBadge(question.difficulty)}`}>
                                                {question.difficulty === 'easy' ? t.easy : question.difficulty === 'hard' ? t.hard : t.medium}
                                            </span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                                                ✓ {optionLabels[question.correct_option]}
                                            </span>
                                            {!question.is_active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Hidden</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => openEdit(question)} className={`px-3 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-indigo-600 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white'}`}>{t.edit}</button>
                                        <button onClick={() => handleDelete(question.id)} className={`px-3 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'bg-slate-700 text-rose-400 hover:bg-rose-600 hover:text-white' : 'bg-slate-100 text-rose-500 hover:bg-rose-600 hover:text-white'}`}>{t.delete}</button>
                                    </div>
                                </div>
                                {/* Options preview */}
                                <div className="grid grid-cols-2 gap-2">
                                    {['a', 'b', 'c', 'd'].map(opt => (
                                        <div key={opt} className={`px-3 py-2 rounded-xl border text-[11px] font-bold ${question.correct_option === opt ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800') : (isDark ? 'bg-slate-900/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')}`}>
                                            <span className="font-[900] opacity-50">{optionLabels[opt]}.</span> {question[`option_${opt}`]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
