import React, { useState, useMemo } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function AdminChapters({ chapters = [], courses = [], majors = [], colleges = [], studyPlans = [], filters = {}, stats = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    
    // Safety check for props that might be null
    chapters = chapters || [];
    courses = courses || [];
    majors = majors || [];
    filters = filters || {};
    stats = stats || {};

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [localSearch, setLocalSearch] = useState(filters.search || '');
    const [isNewCourse, setIsNewCourse] = useState(courses.length === 0);

    const t = lang === 'ar' ? {
        title: 'إدارة الشابترز',
        addChapter: 'إضافة شابتر',
        course: 'المادة',
        major: 'التخصص',
        chapterTitle: 'عنوان الشابتر',
        description: 'الوصف (اختياري)',
        order: 'الترتيب',
        active: 'مفعّل',
        googleDriveLink: 'رابط قوقل درايف (تحميل الشابتر)',
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
        selectMajor: 'اختر التخصص',
        selectCourse: 'اختر المادة',
        selectCollege: 'اختر الكلية',
        selectStudyPlan: 'اختر الخطة',
        college: 'الكلية',
        studyPlan: 'الخطة الدراسية',
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
        googleDriveLink: 'Google Drive Link (Download)',
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
        selectMajor: 'Select major',
        selectCourse: 'Select course',
        selectCollege: 'Select college',
        selectStudyPlan: 'Select plan',
        college: 'College',
        studyPlan: 'Study Plan',
        hidden: 'Hidden',
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = `w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-indigo-500/30 ${isDark ? 'bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`;

    const { data, setData, post, put, processing, reset, errors } = useForm({
        course_name: '',
        course_code: '',
        college_id: '',
        title: '',
        description: '',
        google_drive_link: '',
        order: 0,
        is_active: true,
    });

    // Filtered lists for the form
    const [formCollegeId, setFormCollegeId] = useState('');
    const [formMajorId, setFormMajorId] = useState('');
    const [formStudyPlan, setFormStudyPlan] = useState('');

    const filteredMajors = useMemo(() => {
        if (!formCollegeId) return majors;
        return majors.filter(m => String(m.college_id) === String(formCollegeId));
    }, [majors, formCollegeId]);

    const formCourses = useMemo(() => {
        let list = courses;
        if (formMajorId) {
            if (formMajorId === 'university') list = list.filter(c => !c.major_id);
            else list = list.filter(c => String(c.major_id) === String(formMajorId));
        }
        if (formStudyPlan) {
            list = list.filter(c => String(c.study_plan_version) === String(formStudyPlan));
        }
        return list;
    }, [courses, formMajorId, formStudyPlan]);

    // Cascading filter for the main list
    const filterMajors = useMemo(() => {
        if (!filters.college_id) return majors;
        return majors.filter(m => String(m.college_id) === String(filters.college_id));
    }, [majors, filters.college_id]);

    const filterCourses = useMemo(() => {
        let list = courses;
        if (filters.major_id) {
            if (filters.major_id === 'university') list = list.filter(c => !c.major_id);
            else list = list.filter(c => String(c.major_id) === String(filters.major_id));
        }
        if (filters.study_plan) {
            list = list.filter(c => String(c.study_plan_version) === String(filters.study_plan));
        }
        return list;
    }, [courses, filters.major_id, filters.study_plan]);

    const openCreate = (course = null) => { 
        reset(); 
        setEditingId(null); 
        if (course) {
            setData({
                course_name: course.name,
                course_code: course.code,
                college_id: course.college_id || '',
                title: '',
                description: '',
                google_drive_link: '',
                order: 0,
                is_active: true,
            });
            setIsNewCourse(false);
        } else {
            setIsNewCourse(courses.length === 0);
        }
        setShowForm(true); 
    };
    const openEdit = (chapter) => {
        setData({ 
            course_name: chapter.course?.name || '', 
            course_code: chapter.course?.code || '',
            college_id: chapter.course?.college_id || '',
            title: chapter.title, 
            description: chapter.description || '', 
            google_drive_link: chapter.google_drive_link || '',
            order: chapter.order, 
            is_active: chapter.is_active 
        });
        setEditingId(chapter.id);
        setIsNewCourse(false);
        setShowForm(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            put(`/admin/chapters/${editingId}`, { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); setEditingId(null); } });
        } else {
            post('/admin/chapters', { preserveScroll: true, onSuccess: () => { setShowForm(false); reset(); } });
        }
    };

    const handleDelete = (id) => { if (confirm(t.confirmDelete)) router.delete(`/admin/chapters/${id}`, { preserveScroll: true }); };

    const applyFilter = (params) => {
        const current = { ...filters, ...params };
        // Reset dependent filters when parent changes
        if ('college_id' in params) { delete current.major_id; delete current.course_id; }
        if ('major_id' in params) { delete current.course_id; }
        if ('study_plan' in params) { delete current.course_id; }
        
        Object.keys(current).forEach(k => { if (!current[k]) delete current[k]; });
        router.get('/admin/chapters', current, { preserveState: true, preserveScroll: true });
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
                    <button onClick={() => openCreate()} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-[800] text-[12px] shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-[0.97]">
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <select value={filters.college_id || ''} onChange={e => applyFilter({ college_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.college}</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>

                        <select value={filters.major_id || ''} onChange={e => applyFilter({ major_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.major}</option>
                            <option value="university">{lang === 'ar' ? 'مواد جامعة' : 'University'}</option>
                            {filterMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>

                        <select value={filters.study_plan || ''} onChange={e => applyFilter({ study_plan: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.studyPlan}</option>
                            {studyPlans.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>

                        <select value={filters.course_id || ''} onChange={e => applyFilter({ course_id: e.target.value })} className={inputCls}>
                            <option value="">{t.all} — {t.course}</option>
                            {filterCourses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                        </select>

                        <form onSubmit={handleSearchSubmit} className="relative col-span-2 md:col-span-1">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm opacity-40">🔍</span>
                            <input type="text" value={localSearch} onChange={e => setLocalSearch(e.target.value)} placeholder={t.searchPlaceholder} className={`${inputCls} pr-9`} />
                        </form>
                    </div>
                </div>

                {/* Create / Edit Form */}
                {showForm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
                        <div className={`w-full max-w-2xl rounded-2xl border p-6 shadow-2xl my-8 transition-all scale-100 ${card}`}>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="flex items-center justify-between">
                                    <h3 className={`text-[15px] font-[900] ${heading}`}>{editingId ? `✏️ ${t.update}` : `➕ ${t.addChapter}`}</h3>
                                    <button type="button" onClick={() => { setShowForm(false); reset(); setEditingId(null); }} className={`text-lg opacity-50 hover:opacity-100 transition-opacity`}>✕</button>
                                </div>

                        {/* Course selection toggle */}
                        {!editingId && courses.length > 0 && (
                            <div className="flex gap-3 mb-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNewCourse(false);
                                        setData(prev => ({ ...prev, course_name: '', course_code: '' }));
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${!isNewCourse ? 'bg-indigo-600 text-white shadow-md' : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}
                                >
                                    {lang === 'ar' ? 'اختر مادة موجودة' : 'Select Existing Course'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsNewCourse(true);
                                        setData(prev => ({ ...prev, course_name: '', course_code: '' }));
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${isNewCourse ? 'bg-indigo-600 text-white shadow-md' : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}`}
                                >
                                    {lang === 'ar' ? 'إنشاء مادة جديدة' : 'إنشاء مادة جديدة'}
                                </button>
                            </div>
                        )}

                        <div className={`grid grid-cols-1 ${isNewCourse || editingId ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.course} *</label>
                                {!isNewCourse && !editingId ? (
                                    <div className="flex gap-2 items-center">
                                        <select
                                            value={data.course_name}
                                            onChange={e => {
                                                const c = courses.find(x => x.name === e.target.value);
                                                setData(prev => ({
                                                    ...prev,
                                                    course_name: e.target.value,
                                                    course_code: c ? c.code : '',
                                                    college_id: c ? c.college_id : ''
                                                }));
                                            }}
                                            className={inputCls}
                                            required
                                        >
                                            <option value="">{lang === 'ar' ? 'اختر المادة...' : 'Select course...'}</option>
                                            {courses.map(c => <option key={c.id} value={c.name}>{c.name} ({c.code})</option>)}
                                        </select>
                                        
                                        {data.course_name && (
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const c = courses.find(x => x.name === data.course_name);
                                                    if(c && confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه المادة نهائياً؟ سيتم حذف كل الشباتر والأسئلة المتعلقة بها!' : 'Are you sure you want to delete this course completely?')) {
                                                        router.delete(`/admin/courses/${c.id}`, {
                                                            preserveScroll: true,
                                                            onSuccess: () => {
                                                                setData(prev => ({ ...prev, course_name: '', course_code: '' }));
                                                            }
                                                        });
                                                    }
                                                }}
                                                className="px-4 py-3 bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl font-bold transition-all border border-rose-200 hover:border-rose-500 flex items-center justify-center shrink-0"
                                                title={lang === 'ar' ? 'حذف المادة نهائياً' : 'Delete course permanently'}
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
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
                                        placeholder="مثلاً: برمجة 1..."
                                        list="existing-courses-chapters"
                                        disabled={!!editingId}
                                    />
                                )}
                                <datalist id="existing-courses-chapters">
                                    {courses.map(c => <option key={c.id} value={c.name} />)}
                                </datalist>
                                {errors.course_name && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.course_name}</p>}
                            </div>
                            <div>
                                <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>رقم المادة *</label>
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
                            {(isNewCourse || editingId) && (
                                <div>
                                    <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{lang === 'ar' ? 'الكلية' : 'College'} *</label>
                                    <select
                                        value={data.college_id}
                                        onChange={e => setData('college_id', e.target.value)}
                                        className={inputCls}
                                        required
                                    >
                                        <option value="">{lang === 'ar' ? 'اختر الكلية...' : 'Select college...'}</option>
                                        {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {errors.college_id && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.college_id}</p>}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.chapterTitle} *</label>
                            <input type="text" value={data.title} onChange={e => setData('title', e.target.value)} className={inputCls} required placeholder="Chapter 1: Introduction" />
                            {errors.title && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.title}</p>}
                        </div>

                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.description}</label>
                            <textarea value={data.description} onChange={e => setData('description', e.target.value)} rows={2} className={inputCls} placeholder="وصف مختصر لمحتوى الشابتر..." />
                        </div>

                        <div>
                            <label className={`text-[11px] font-black block mb-1.5 ${subtext}`}>{t.googleDriveLink}</label>
                            <input type="url" value={data.google_drive_link} onChange={e => setData('google_drive_link', e.target.value)} className={inputCls} placeholder="https://drive.google.com/..." />
                            {errors.google_drive_link && <p className="text-[10px] text-rose-500 mt-1 font-bold">{errors.google_drive_link}</p>}
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
                    </div>
                </div>
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
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => openCreate(group.course)} 
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                                                isDark 
                                                    ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white' 
                                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white'
                                            }`}
                                        >
                                            + {lang === 'ar' ? 'إضافة شابتر لهذه المادة' : 'Add Chapter to Course'}
                                        </button>
                                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                                            {group.chapters.length} {lang === 'ar' ? 'شابتر' : 'chapters'}
                                        </span>
                                    </div>
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
                                                        {chapter.google_drive_link && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>🔗 Drive</span>}
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
