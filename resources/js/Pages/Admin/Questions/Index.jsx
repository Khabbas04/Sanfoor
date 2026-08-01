import React, { useState, useEffect, useMemo } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';
import { ChevronDown, Flame, Gauge, HelpCircle, Lightbulb, ListChecks, Pencil, Plus, Search, Sprout, Trash2, WandSparkles, X } from 'lucide-react';
import BulkQuestionImport from '@/Components/Admin/BulkQuestionImport';

export default function AdminQuestions({ questions = [], courses = [], chapters = [], colleges = [], filters = {}, stats = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();

    // Safety check for props that might be null
    questions = questions || [];
    courses = courses || [];
    chapters = chapters || [];
    colleges = colleges || [];
    filters = filters || {};
    stats = stats || {};

    const [showForm, setShowForm] = useState(false);
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [localSearch, setLocalSearch] = useState(filters.search || '');
    const [expandedQ, setExpandedQ] = useState(null);
    const [isNewCourse, setIsNewCourse] = useState(courses.length === 0);



    const t = lang === 'ar' ? {
        title: 'إدارة الأسئلة',
        addQuestion: 'إضافة سؤال',
        bulkImport: 'إضافة دفعة بالذكاء الاصطناعي',

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
        course: 'اسم المادة',
        courseCode: 'رقم المادة',
        selectCourse: 'ابحث عن مادة...',
        selectChapter: 'اختر الشابتر...',
        newCourse: 'مادة جديدة',
        allDifficulties: 'كل الصعوبات',
        correct: 'الصحيحة',
        hidden: 'مخفي',
        markCorrect: 'حدد كإجابة صحيحة',
        studyPlan: 'الخطة الدراسية',
        allPlans: 'كل الخطط',
    } : {
        title: 'Manage Questions',
        addQuestion: 'Add Question',
        bulkImport: 'AI Bulk Import',

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
        course: 'Course Name',
        courseCode: 'Course Code',
        selectCourse: 'Search course...',
        selectChapter: 'Select chapter...',
        newCourse: 'New Course',
        allDifficulties: 'All difficulties',
        correct: 'Correct',
        hidden: 'Hidden',
        markCorrect: 'Mark as correct',
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = `min-h-11 w-full rounded-xl border px-4 py-3 text-base font-bold outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 sm:text-sm ${isDark ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    const { data, setData, post, put, processing, reset, errors } = useForm({
        course_name: '',
        course_code: '',
        college_id: '',
        chapter_title: '',
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



    const openCreate = () => { reset(); setEditingId(null); setIsNewCourse(courses.length === 0); setShowForm(true); };
    const openEdit = (q) => {
        setData({
            course_name: q.course?.name || '',
            course_code: q.course?.code || '',
            college_id: q.course?.college_id || '',
            chapter_title: q.chapter?.title || '',
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
        setIsNewCourse(false);
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
        if (d === 'easy') return { cls: isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700', Icon: Sprout, label: t.easy };
        if (d === 'hard') return { cls: isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700', Icon: Flame, label: t.hard };
        return { cls: isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700', Icon: Gauge, label: t.medium };
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
                            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-600 flex items-center justify-center text-white shadow-lg"><HelpCircle className="size-5" /></span>
                            {t.title}
                        </h2>
                    </div>
                    <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                        <button onClick={openCreate} className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 ${isDark ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                            <Plus className="size-4" /> {t.addQuestion}
                        </button>
                        <button onClick={() => setShowBulkImport(true)} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-xs font-black text-white shadow-lg shadow-violet-600/20 transition-colors hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2">
                            <WandSparkles className="size-4" /> {t.bulkImport}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[
                        { label: t.totalQuestions, value: stats.total || 0, colorClass: 'text-indigo-500', Icon: ListChecks },
                        { label: t.easy, value: stats.easy || 0, colorClass: 'text-emerald-500', Icon: Sprout },
                        { label: t.medium, value: stats.medium || 0, colorClass: 'text-amber-500', Icon: Gauge },
                        { label: t.hard, value: stats.hard || 0, colorClass: 'text-rose-500', Icon: Flame },
                    ].map((s, i) => (
                        <div key={i} className={`rounded-2xl border p-3.5 text-center ${card}`}>
                            <s.Icon className={`mx-auto size-5 ${s.colorClass}`} />
                            <p className={`text-xl font-[900] mt-0.5 ${s.colorClass}`}>{s.value}</p>
                            <p className={`text-[9px] font-bold ${subtext}`}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className={`rounded-2xl border p-4 ${card}`}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <select value={filters.course_id || ''} onChange={e => applyFilter({ course_id: e.target.value })} className={inputCls}>
                            <option value="">{t.selectCourse}</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={filters.chapter_id || ''} onChange={e => applyFilter({ chapter_id: e.target.value })} className={inputCls}>
                            <option value="">{t.selectChapter}</option>
                            {chapters.filter(ch => !filters.course_id || String(ch.course_id) === String(filters.course_id)).map(ch => (
                                <option key={ch.id} value={ch.id}>{ch.title}</option>
                            ))}
                        </select>
                        <select value={filters.difficulty || ''} onChange={e => applyFilter({ difficulty: e.target.value })} className={inputCls}>
                            <option value="">{t.allDifficulties}</option>
                            <option value="easy">{t.easy}</option>
                            <option value="medium">{t.medium}</option>
                            <option value="hard">{t.hard}</option>
                        </select>
                        <form onSubmit={handleSearchSubmit} className="relative">
                            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                            <input type="text" value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder={t.searchPlaceholder} className={`${inputCls} pr-9`} />
                        </form>
                    </div>
                </div>

                {/* Create / Edit Form */}
                {showForm && (
                    <div className="fixed inset-0 z-50 flex min-h-dvh items-stretch justify-center overflow-y-auto bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                        <div className={`my-0 min-h-dvh w-full max-w-2xl rounded-none border p-4 shadow-2xl transition-all sm:my-8 sm:min-h-0 sm:rounded-2xl sm:p-6 ${card}`}>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className={`flex items-center gap-2 text-[15px] font-[900] ${heading}`}>{editingId ? <Pencil className="size-4" /> : <Plus className="size-4" />}{editingId ? t.update : t.addQuestion}</h3>
                                    <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className="flex size-11 cursor-pointer items-center justify-center rounded-xl opacity-60 transition hover:bg-slate-100 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:hover:bg-white/5" aria-label={t.cancel}><X className="size-5" /></button>
                                </div>
                                {Object.keys(errors).length > 0 && (
                                    <div role="alert" className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-xs font-bold text-rose-600">
                                        <p className="mb-2 font-black">راجع الحقول التالية:</p>
                                        <ul className="list-inside list-disc space-y-1">{Object.values(errors).map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}</ul>
                                    </div>
                                )}

                        {/* Course selection toggle */}
                        {!editingId && courses.length > 0 && (
                            <div className="mb-2 grid grid-cols-1 gap-2 px-1 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNewCourse(false);
                                        setData('course_name', '');
                                        setData('course_code', '');
                                        setData('college_id', '');
                                    }}
                                    className={`min-h-11 px-4 py-2 rounded-xl text-xs font-black transition-all ${!isNewCourse ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-md' : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}
                                >
                                    {lang === 'ar' ? 'اختر مادة موجودة' : 'Select Existing Course'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNewCourse(true);
                                        setData('course_name', '');
                                        setData('course_code', '');
                                        setData('college_id', '');
                                    }}
                                    className={`min-h-11 px-4 py-2 rounded-xl text-xs font-black transition-all ${isNewCourse ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-md' : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}
                                >
                                    {lang === 'ar' ? 'إنشاء مادة جديدة' : 'Create New Course'}
                                </button>
                            </div>
                        )}

                        {/* Row 1: Course Name, Course Code, Chapter Title, Difficulty */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="sm:col-span-1">
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.course} *</label>
                                {!isNewCourse && !editingId ? (
                                    <select
                                        value={data.course_name}
                                        onChange={e => {
                                            const val = e.target.value;
                                            setData('course_name', val);
                                            const c = courses.find(x => String(x.name) === String(val));
                                            if (c) {
                                                setData('course_code', c.code || '');
                                                setData('college_id', c.college_id ? String(c.college_id) : '');
                                            } else {
                                                setData('course_code', '');
                                                setData('college_id', '');
                                            }
                                        }}
                                        className={inputCls}
                                        required
                                    >
                                        <option value="">{lang === 'ar' ? 'اختر المادة...' : 'Select course...'}</option>
                                        {courses.map(c => <option key={c.id} value={c.name}>{c.name} ({c.code})</option>)}
                                    </select>
                                ) : (
                                    <input 
                                        type="text" 
                                        value={data.course_name} 
                                        onChange={e => {
                                            setData('course_name', e.target.value);
                                            const c = courses.find(x => x.name === e.target.value);
                                            if (c) setData('course_code', c.code);
                                        }} 
                                        className={inputCls} 
                                        required 
                                        placeholder="برمجة 1..."
                                        list="existing-courses"
                                        disabled={!!editingId}
                                    />
                                )}
                                <datalist id="existing-courses">
                                    {courses.map(c => <option key={c.id} value={c.name} />)}
                                </datalist>
                                {errors.course_name && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.course_name}</p>}
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.courseCode} *</label>
                                <input 
                                    type="text" 
                                    value={data.course_code} 
                                    onChange={e => setData('course_code', e.target.value)} 
                                    className={inputCls} 
                                    required 
                                    placeholder="مثلاً: 0306101"
                                    disabled={!isNewCourse || !!editingId}
                                />
                                {errors.course_code && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.course_code}</p>}
                            </div>

                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.chapter}</label>
                                <input 
                                    type="text" 
                                    value={data.chapter_title} 
                                    onChange={e => setData('chapter_title', e.target.value)} 
                                    className={inputCls} 
                                    placeholder="اختياري: اسم الشابتر..."
                                    list="existing-chapters"
                                />
                                <datalist id="existing-chapters">
                                    {chapters.filter(ch => {
                                        const course = courses.find(c => c.name === data.course_name);
                                        return course && String(ch.course_id) === String(course.id);
                                    }).map(ch => <option key={ch.id} value={ch.title} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.difficulty} *</label>
                                <div className="flex gap-2">
                                    {['easy', 'medium', 'hard'].map(d => {
                                        const b = diffBadge(d);
                                        return (
                                            <button key={d} type="button" onClick={() => setData('difficulty', d)} className={`min-h-11 flex-1 py-2.5 rounded-xl text-[11px] font-[800] border transition-all ${data.difficulty === d ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-sky-400 shadow-md' : (isDark ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200')}`}>
                                                <span className="inline-flex items-center justify-center gap-1.5"><b.Icon className="size-3.5" /> {b.label}</span>
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
                                        <input type="text" value={data[`option_${opt}`]} onChange={e => setData(`option_${opt}`, e.target.value)} className={`min-w-0 flex-1 bg-transparent border-0 outline-none text-base font-bold py-2 sm:text-sm ${heading}`} required placeholder={`${t[`option${opt.toUpperCase()}`]}...`} />
                                        <button type="button" onClick={() => setData('correct_option', opt)} title={t.markCorrect} aria-label={`${t.markCorrect}: ${optionLabels[opt]}`} className={`size-11 rounded-lg shrink-0 text-[13px] font-[900] transition-all ${data.correct_option === opt ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : (isDark ? 'bg-slate-800 text-slate-500 hover:bg-emerald-500/20' : 'bg-slate-100 text-slate-400 hover:bg-emerald-100')}`}>
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
                        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <button type="button" onClick={() => setData('is_active', !data.is_active)} className={`w-12 h-7 rounded-full transition-all p-0.5 ${data.is_active ? 'bg-emerald-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')}`}>
                                    <span className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform ${data.is_active ? (lang === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`} />
                                </button>
                                <span className={`text-[12px] font-bold ${subtext}`}>{t.active}</span>
                            </label>

                                <div className="grid grid-cols-2 gap-3 sm:flex">
                                    <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className={`min-h-11 px-6 py-2.5 rounded-xl font-[800] text-[12px] border transition-all ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.cancel}</button>
                                    <button type="submit" disabled={processing} className="min-h-11 px-7 py-2.5 bg-gradient-to-r from-sky-400 to-blue-500 text-white rounded-xl font-[800] text-[12px] shadow-md disabled:opacity-50">{editingId ? t.update : t.save}</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                )}

                {/* Questions List */}
                {questions.length === 0 ? (
                    <div className={`rounded-2xl border p-16 text-center ${card}`}>
                        <HelpCircle className="mx-auto mb-4 size-12 text-slate-300" />
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
                                    <button onClick={() => setExpandedQ(isExpanded ? null : question.id)} aria-expanded={isExpanded} className="flex min-h-11 w-full items-start gap-3 px-3 py-4 text-right sm:px-5 sm:gap-3.5">
                                        <span className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${db.cls}`} title={db.label}><db.Icon className="size-3.5" /></span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`line-clamp-2 text-sm font-[800] leading-relaxed sm:text-[13px] ${heading}`}>{question.question_text}</p>
                                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{question.course?.code}</span>
                                                {question.chapter && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>{question.chapter.title}</span>}
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>✓ {optionLabels[question.correct_option]}</span>
                                                {!question.is_active && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700'}`}>{t.hidden}</span>}
                                            </div>
                                        </div>
                                        <ChevronDown className={`size-4 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} ${subtext}`} />
                                    </button>

                                    {/* Expanded details */}
                                    {isExpanded && (
                                        <div className={`border-t px-3 pb-4 sm:px-5 sm:pb-5 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {['a', 'b', 'c', 'd'].map(opt => (
                                                    <div key={opt} className={`px-3.5 py-2.5 rounded-xl border text-[12px] font-bold ${question.correct_option === opt ? (isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800') : (isDark ? 'bg-slate-900/40 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600')}`}>
                                                        <span className="font-[900] opacity-50">{optionLabels[opt]}.</span> {question[`option_${opt}`]}
                                                    </div>
                                                ))}
                                            </div>
                                            {question.explanation && (
                                                <div className={`mt-3 p-3 rounded-xl border text-[11px] font-bold leading-relaxed ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                                                    <span className="flex items-start gap-2"><Lightbulb className="mt-0.5 size-4 shrink-0" />{question.explanation}</span>
                                                </div>
                                            )}
                                            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
                                                <button onClick={() => openEdit(question)} className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-[800] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}><Pencil className="size-3.5" /> {t.edit}</button>
                                                <button onClick={() => handleDelete(question.id)} className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-[800] transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 ${isDark ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-600 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white'}`}><Trash2 className="size-3.5" /> {t.delete}</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {showBulkImport && (
                    <BulkQuestionImport
                        courses={courses}
                        chapters={chapters}
                        initialCourseId={filters.course_id || ''}
                        onClose={() => setShowBulkImport(false)}
                        onSaved={() => {
                            setShowBulkImport(false);
                            router.reload({ only: ['questions', 'stats'], preserveScroll: true });
                        }}
                    />
                )}
            </div>
        </AdminLayout>
    );
}
