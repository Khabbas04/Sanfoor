import React, { useState, useMemo } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function AdminChapters({ chapters = [], courses = [], majors = [], filters = {}, stats = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [localSearch, setLocalSearch] = useState(filters.search || '');

    const t = lang === 'ar' ? {
        title: 'إدارة الشابترز',
        addChapter: 'إضافة شابتر',
        course: 'المادة',
        major: 'التخصص',
        chapterTitle: 'عنوان الشابتر',
        description: 'الوصف (اختياري)',
        order: 'الترتيب',
        active: 'مفعّل',
        save: 'حفظ',
        update: 'تحديث',
        cancel: 'إلغاء',
        delete: 'حذف',
        edit: 'تعديل',
        confirmDelete: 'هل أنت متأكد من حذف هذا الشابتر؟',
        noChapters: 'لا يوجد شابترز',
        noChaptersDesc: 'ابدأ بإضافة شابتر لأي مادة من الزر أعلاه',
        all: 'الكل',
        questions: 'سؤال',
        searchPlaceholder: 'ابحث بالعنوان أو اسم المادة...',
        totalChapters: 'إجمالي الشابترز',
        activeChapters: 'المفعّلة',
        withQuestions: 'لها أسئلة',
        university: 'مواد الجامعة',
        selectMajor: 'اختر التخصص',
        selectCourse: 'اختر المادة',
        hidden: 'مخفي',
    } : {
        title: 'Manage Chapters',
        addChapter: 'Add Chapter',
        course: 'Course',
        major: 'Major',
        chapterTitle: 'Chapter Title',
        description: 'Description (optional)',
        order: 'Order',
        active: 'Active',
        save: 'Save',
        update: 'Update',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        confirmDelete: 'Are you sure you want to delete this chapter?',
        noChapters: 'No chapters yet',
        noChaptersDesc: 'Start by adding a chapter for any course using the button above',
        all: 'All',
        questions: 'questions',
        searchPlaceholder: 'Search by title or course name...',
        totalChapters: 'Total Chapters',
        activeChapters: 'Active',
        withQuestions: 'With Questions',
        university: 'University Courses',
        selectMajor: 'Select major',
        selectCourse: 'Select course',
        hidden: 'Hidden',
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = `w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    const { data, setData, post, put, processing, reset, errors } = useForm({
        course_id: '',
        title: '',
        description: '',
        order: 0,
        is_active: true,
    });

    // Cascading filter: when major changes, filter courses in the form dropdown too
    const formCourses = useMemo(() => {
        if (filters.major_id && filters.major_id !== 'university') {
            return courses.filter(c => String(c.major_id) === String(filters.major_id));
        }
        if (filters.major_id === 'university') {
            return courses.filter(c => !c.major_id);
        }
        return courses;
    }, [courses, filters.major_id]);

    const openCreate = () => { reset(); setEditingId(null); setShowForm(true); };
    const openEdit = (chapter) => {
        setData({ course_id: chapter.course_id, title: chapter.title, description: chapter.description || '', order: chapter.order, is_active: chapter.is_active });
        setEditingId(chapter.id);
        setShowForm(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            put(route('admin.chapters.update', editingId), { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); setEditingId(null); } });
        } else {
            post(route('admin.chapters.store'), { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); } });
        }
    };

    const handleDelete = (id) => { if (confirm(t.confirmDelete)) router.delete(route('admin.chapters.destroy', id), { preserveScroll: true }); };

    const applyFilter = (params) => {
        const current = { ...filters, ...params };
        // Reset dependent filters when parent changes
        if ('major_id' in params) { delete current.course_id; }
        Object.keys(current).forEach(k => { if (!current[k]) delete current[k]; });
        router.get(route('admin.chapters.index'), current, { preserveState: true, preserveScroll: true });
    };

    const handleSearchSubmit = (e) => { e.preventDefault(); applyFilter({ search: localSearch }); };

    // Group chapters by course for a cleaner display
    const grouped = useMemo(() => {
        const map = {};
        chapters.forEach(ch => {
            const key = ch.course_id;
            if (!map[key]) map[key] = { course: ch.course, chapters: [] };
            map[key].chapters.push(ch);
        });
        return Object.values(map);
    }, [chapters]);

    return (
        <AdminLayout>
            <Head title={`${t.title} | سنفور`} />

            <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Header + Action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className={`text-2xl font-[900] flex items-center gap-3 ${heading}`}>
                            <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg text-white shadow-lg">📖</span>
                            {t.title}
                        </h2>
                    </div>
                    <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-[800] text-[12px] shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-[0.97]">
                        <span className="text-lg">+</span> {t.addChapter}
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: t.totalChapters, value: stats.total || 0, color: 'indigo', icon: '📖' },
                        { label: t.activeChapters, value: stats.active || 0, color: 'emerald', icon: '✅' },
                        { label: t.withQuestions, value: stats.with_questions || 0, color: 'violet', icon: '❓' },
                    ].map((s, i) => (
                        <div key={i} className={`rounded-2xl border p-4 text-center ${card}`}>
                            <span className="text-xl">{s.icon}</span>
                            <p className={`text-2xl font-[900] mt-1 text-${s.color}-500`}>{s.value}</p>
                            <p className={`text-[10px] font-bold ${subtext}`}>{s.label}</p>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className={`rounded-2xl border p-4 ${card}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Major filter */}
                        <select value={filters.major_id || ''} onChange={e => applyFilter({ major_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.major}</option>
                            <option value="university">{t.university}</option>
                            {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>

                        {/* Course filter */}
                        <select value={filters.course_id || ''} onChange={e => applyFilter({ course_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.course}</option>
                            {formCourses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                        </select>

                        {/* Search */}
                        <form onSubmit={handleSearchSubmit} className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-40">🔍</span>
                            <input type="text" value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder={t.searchPlaceholder} className={`${inputCls} pr-9`} />
                        </form>
                    </div>
                </div>

                {/* Create / Edit Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className={`rounded-2xl border p-6 shadow-sm space-y-5 ${card}`}>
                        <div className="flex items-center justify-between">
                            <h3 className={`text-[15px] font-[900] ${heading}`}>{editingId ? `✏️ ${t.update}` : `➕ ${t.addChapter}`}</h3>
                            <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className={`text-lg opacity-50 hover:opacity-100 transition-opacity`}>✕</button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.course} *</label>
                                <select value={data.course_id} onChange={e => setData('course_id', e.target.value)} className={inputCls} required disabled={!!editingId}>
                                    <option value="">— {t.selectCourse} —</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                </select>
                                {errors.course_id && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.course_id}</p>}
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.chapterTitle} *</label>
                                <input type="text" value={data.title} onChange={e => setData('title', e.target.value)} className={inputCls} required placeholder="Chapter 1: Introduction" />
                                {errors.title && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.title}</p>}
                            </div>
                        </div>

                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.description}</label>
                            <textarea value={data.description} onChange={e => setData('description', e.target.value)} rows={2} className={inputCls} placeholder="وصف مختصر لمحتوى الشابتر..." />
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="w-28">
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.order}</label>
                                <input type="number" min="0" value={data.order} onChange={e => setData('order', parseInt(e.target.value) || 0)} className={inputCls} />
                            </div>
                            <div className="pt-5">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <button type="button" onClick={() => setData('is_active', !data.is_active)} className={`w-12 h-7 rounded-full transition-all p-0.5 ${data.is_active ? 'bg-emerald-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')}`}>
                                        <span className={`block w-6 h-6 rounded-full bg-white shadow-md transition-transform ${data.is_active ? (lang === 'ar' ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'}`} />
                                    </button>
                                    <span className={`text-[12px] font-bold ${subtext}`}>{t.active}</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button type="submit" disabled={processing} className="px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-[800] text-[12px] shadow-md disabled:opacity-50 transition-all">
                                {editingId ? t.update : t.save}
                            </button>
                            <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className={`px-6 py-2.5 rounded-xl font-[800] text-[12px] border transition-all ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}>
                                {t.cancel}
                            </button>
                        </div>
                    </form>
                )}

                {/* Chapters grouped by course */}
                {chapters.length === 0 ? (
                    <div className={`rounded-2xl border p-16 text-center ${card}`}>
                        <div className="text-5xl mb-4 opacity-20">📖</div>
                        <p className={`text-base font-[800] ${heading}`}>{t.noChapters}</p>
                        <p className={`text-[12px] font-bold mt-1 ${subtext}`}>{t.noChaptersDesc}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {grouped.map(group => (
                            <div key={group.course?.id} className={`rounded-2xl border overflow-hidden ${card}`}>
                                {/* Course header */}
                                <div className={`px-5 py-3.5 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-[900] ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                                            {group.course?.code?.slice(0, 3) || '—'}
                                        </div>
                                        <div>
                                            <h4 className={`text-[13px] font-[900] ${heading}`}>{group.course?.name}</h4>
                                            <span className={`text-[10px] font-bold font-mono ${subtext}`}>{group.course?.code}</span>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                                        {group.chapters.length} {lang === 'ar' ? 'شابتر' : 'chapters'}
                                    </span>
                                </div>

                                {/* Chapter rows */}
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {group.chapters.map(chapter => (
                                        <div key={chapter.id} className={`px-5 py-4 flex items-center justify-between gap-4 transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-indigo-50/30'}`}>
                                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-[900] shrink-0 ${isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                                                    {chapter.order}
                                                </div>
                                                <div className="min-w-0">
                                                    <h5 className={`text-[13px] font-[800] truncate ${heading}`}>{chapter.title}</h5>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        {chapter.description && <span className={`text-[10px] font-bold truncate max-w-[200px] ${subtext}`}>{chapter.description}</span>}
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-50 text-violet-700'}`}>{chapter.questions_count || 0} {t.questions}</span>
                                                        {!chapter.is_active && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700'}`}>{t.hidden}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button onClick={() => openEdit(chapter)} className={`px-3 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'text-indigo-400 hover:bg-indigo-600 hover:text-white' : 'text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}>{t.edit}</button>
                                                <button onClick={() => handleDelete(chapter.id)} className={`px-3 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'text-rose-400 hover:bg-rose-600 hover:text-white' : 'text-rose-500 hover:bg-rose-600 hover:text-white'}`}>{t.delete}</button>
                                            </div>
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
