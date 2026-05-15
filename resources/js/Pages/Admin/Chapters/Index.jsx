import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function AdminChapters({ chapters = [], courses = [], filters = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const t = lang === 'ar' ? {
        title: 'إدارة الشابترز',
        addChapter: '+ إضافة شابتر',
        course: 'المادة',
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
        noChapters: 'لا يوجد شابترز. أضف أول شابتر!',
        filterByCourse: 'فلتر حسب المادة',
        all: 'الكل',
        questions: 'سؤال',
    } : {
        title: 'Manage Chapters',
        addChapter: '+ Add Chapter',
        course: 'Course',
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
        noChapters: 'No chapters yet. Add the first one!',
        filterByCourse: 'Filter by course',
        all: 'All',
        questions: 'questions',
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = `w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    const { data, setData, post, put, processing, reset, errors } = useForm({
        course_id: '',
        title: '',
        description: '',
        order: 0,
        is_active: true,
    });

    const openCreate = () => {
        reset();
        setEditingId(null);
        setShowForm(true);
    };

    const openEdit = (chapter) => {
        setData({
            course_id: chapter.course_id,
            title: chapter.title,
            description: chapter.description || '',
            order: chapter.order,
            is_active: chapter.is_active,
        });
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

    const handleDelete = (id) => {
        if (!confirm(t.confirmDelete)) return;
        router.delete(route('admin.chapters.destroy', id), { preserveScroll: true });
    };

    const handleFilter = (courseId) => {
        router.get(route('admin.chapters.index'), courseId ? { course_id: courseId } : {}, { preserveState: true, preserveScroll: true });
    };

    return (
        <AdminLayout>
            <Head title={`${t.title} | سنفور`} />

            <div className="space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className={`text-2xl font-[900] ${heading}`}>📖 {t.title}</h2>
                        <p className={`text-[12px] font-bold mt-1 ${subtext}`}>{chapters.length} شابتر</p>
                    </div>
                    <button onClick={openCreate} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-[800] text-[12px] shadow-md hover:bg-indigo-700 transition-all">
                        {t.addChapter}
                    </button>
                </div>

                {/* Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <button onClick={() => handleFilter(null)} className={`px-4 py-2 rounded-xl text-[11px] font-[800] border whitespace-nowrap transition-all ${!filters.course_id ? 'bg-indigo-600 text-white border-indigo-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200')}`}>
                        {t.all}
                    </button>
                    {courses.map(c => (
                        <button key={c.id} onClick={() => handleFilter(c.id)} className={`px-4 py-2 rounded-xl text-[11px] font-[800] border whitespace-nowrap transition-all ${String(filters.course_id) === String(c.id) ? 'bg-indigo-600 text-white border-indigo-600' : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200')}`}>
                            {c.code}
                        </button>
                    ))}
                </div>

                {/* Form */}
                {showForm && (
                    <form onSubmit={handleSubmit} className={`rounded-[2rem] border p-6 shadow-sm space-y-4 ${card}`}>
                        <h3 className={`text-[14px] font-[900] ${heading}`}>{editingId ? t.update : t.addChapter}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.course}</label>
                                <select value={data.course_id} onChange={e => setData('course_id', e.target.value)} className={inputCls} required>
                                    <option value="">—</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                </select>
                                {errors.course_id && <p className="text-[10px] text-rose-500 mt-1">{errors.course_id}</p>}
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.chapterTitle}</label>
                                <input type="text" value={data.title} onChange={e => setData('title', e.target.value)} className={inputCls} required />
                                {errors.title && <p className="text-[10px] text-rose-500 mt-1">{errors.title}</p>}
                            </div>
                        </div>
                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.description}</label>
                            <textarea value={data.description} onChange={e => setData('description', e.target.value)} rows={3} className={inputCls} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.order}</label>
                                <input type="number" min="0" value={data.order} onChange={e => setData('order', parseInt(e.target.value) || 0)} className={inputCls} />
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <button type="button" onClick={() => setData('is_active', !data.is_active)} className={`w-12 h-7 rounded-full transition-colors p-1 ${data.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${data.is_active ? '' : (lang === 'ar' ? 'translate-x-0' : '-translate-x-5')}`} />
                                    </button>
                                    <span className={`text-[12px] font-bold ${subtext}`}>{t.active}</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button type="submit" disabled={processing} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-[800] text-[12px] disabled:opacity-50">{editingId ? t.update : t.save}</button>
                            <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className={`px-6 py-2.5 rounded-xl font-[800] text-[12px] border ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.cancel}</button>
                        </div>
                    </form>
                )}

                {/* Table */}
                {chapters.length === 0 ? (
                    <div className={`rounded-[2rem] border p-12 text-center ${card}`}>
                        <div className="text-4xl mb-3 opacity-30">📖</div>
                        <p className={`text-sm font-bold ${subtext}`}>{t.noChapters}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {chapters.map(chapter => (
                            <div key={chapter.id} className={`rounded-2xl border p-5 flex items-center justify-between gap-4 transition-colors ${card} ${isDark ? 'hover:border-indigo-500/40' : 'hover:border-indigo-200'}`}>
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-[900] shrink-0 ${isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>
                                        {chapter.order}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className={`text-[13px] font-[800] truncate ${heading}`}>{chapter.title}</h4>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className={`text-[10px] font-bold font-mono ${subtext}`}>{chapter.course?.code}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{chapter.questions_count || 0} {t.questions}</span>
                                            {!chapter.is_active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Hidden</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => openEdit(chapter)} className={`px-3 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'bg-slate-700 text-slate-200 hover:bg-indigo-600 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white'}`}>{t.edit}</button>
                                    <button onClick={() => handleDelete(chapter.id)} className={`px-3 py-2 rounded-lg text-[11px] font-[800] transition-all ${isDark ? 'bg-slate-700 text-rose-400 hover:bg-rose-600 hover:text-white' : 'bg-slate-100 text-rose-500 hover:bg-rose-600 hover:text-white'}`}>{t.delete}</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
