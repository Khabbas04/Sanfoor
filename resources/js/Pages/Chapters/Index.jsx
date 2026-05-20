import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

// Simple debounce helper
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

export default function ChaptersIndex({ courses = [], filters = {} }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [search, setSearch] = useState(filters.search || '');
    const [selectedCourseId, setSelectedCourseId] = useState(null);

    const selectedCourse = useMemo(() => {
        return courses.find(c => c.id === selectedCourseId);
    }, [courses, selectedCourseId]);

    const t = lang === 'ar' ? {
        title: 'شابترز المواد',
        subtitle: 'تصفّح محتوى الشابترز وحمل الملفات الدراسية',
        searchPlaceholder: 'ابحث عن مادة أو شابتر معين...',
        chapters: 'شابتر',
        noChapters: 'لا توجد شابترز متاحة حالياً.',
        noResults: 'لا توجد نتائج مطابقة للبحث.',
        semester: 'الفصل',
        credits: 'ساعات',
        download: 'تحميل الشابتر',
        courseContent: 'محتوى المادة',
        back: 'رجوع للمواد',
        viewChapters: 'عرض الشباتر',
    } : {
        title: 'Course Chapters',
        subtitle: 'Browse chapters and download study materials',
        searchPlaceholder: 'Search for a course or chapter...',
        chapters: 'chapters',
        noChapters: 'No chapters available yet.',
        noResults: 'No results match your search.',
        semester: 'Semester',
        credits: 'credits',
        download: 'Download Chapter',
        courseContent: 'Course Content',
        back: 'Back to Courses',
        viewChapters: 'View Chapters',
    };

    // Debounced AJAX search
    const performSearch = useCallback(
        debounce((query) => {
            router.get(
                route('chapters.index'),
                { search: query },
                { preserveState: true, preserveScroll: true, replace: true }
            );
        }, 400),
        []
    );

    useEffect(() => {
        if (search !== (filters.search || '')) {
            performSearch(search);
        }
    }, [search]);

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm';
    const heading = isDark ? 'text-white' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head title={t.title} />
            
            <div className="max-w-7xl mx-auto">
                {selectedCourse ? (
                    /* Course Detail View */
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <button 
                            onClick={() => setSelectedCourseId(null)}
                            className={`mb-8 flex items-center gap-2 font-black text-sm px-5 py-2.5 rounded-xl transition-all ${
                                isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            <span className="text-lg">{lang === 'ar' ? '←' : '→'}</span> {t.back}
                        </button>

                        <div className={`rounded-[3rem] border overflow-hidden p-8 md:p-12 ${card}`}>
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-12">
                                <div>
                                    <p className="text-indigo-500 font-black text-sm tracking-[0.2em] uppercase mb-2">{selectedCourse.code}</p>
                                    <h2 className={`text-3xl md:text-5xl font-[900] ${heading}`}>{selectedCourse.name}</h2>
                                    <div className="flex items-center gap-4 mt-4">
                                        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase ${
                                            isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                        }`}>
                                            {selectedCourse.chapters?.length || 0} {t.chapters}
                                        </span>
                                    </div>
                                </div>
                                <div className="shrink-0 w-20 h-20 rounded-3xl flex items-center justify-center text-4xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-2xl shadow-indigo-500/30">
                                    📚
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${subtext} opacity-70`}>{t.courseContent}</p>
                                {(selectedCourse.chapters || []).map((chapter) => (
                                    <div key={chapter.id} className={`group flex items-center justify-between gap-4 p-6 rounded-3xl border transition-all duration-300 ${
                                        isDark 
                                            ? 'bg-slate-900/40 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60' 
                                            : 'bg-slate-50/50 border-slate-100 hover:border-indigo-500/30 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5'
                                    }`}>
                                        <div className="flex items-center gap-5 min-w-0">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 transition-transform group-hover:scale-110 ${
                                                isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-100 text-indigo-700'
                                            }`}>
                                                {chapter.order}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className={`text-lg font-[800] truncate ${heading}`}>{chapter.title}</h4>
                                                {chapter.description && <p className={`text-sm font-bold mt-0.5 truncate ${subtext}`}>{chapter.description}</p>}
                                            </div>
                                        </div>
                                        
                                        {chapter.google_drive_link && (
                                            <a 
                                                href={chapter.google_drive_link} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all ${
                                                    isDark 
                                                        ? 'bg-slate-800 text-indigo-400 hover:bg-slate-700 hover:text-white' 
                                                        : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-lg shadow-indigo-500/5'
                                                }`}
                                            >
                                                <span>📥</span>
                                                <span className="hidden sm:inline">{t.download}</span>
                                            </a>
                                        )}
                                    </div>
                                ))}

                                {(selectedCourse.chapters || []).length === 0 && (
                                    <div className={`py-16 text-center rounded-[2.5rem] border-2 border-dashed ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
                                        <div className="text-4xl mb-4 opacity-20 text-indigo-500">📖</div>
                                        <p className="text-lg font-black">{t.noChapters}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Course Grid View */
                    <>
                        {/* Hero Section */}
                        <section className="relative overflow-hidden py-10 sm:py-16 text-center mb-10">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none select-none z-0">
                                <span className={`text-[5rem] sm:text-[9rem] md:text-[12rem] font-black tracking-tighter whitespace-nowrap ${isDark ? 'text-white/[0.02]' : 'text-slate-900/[0.03]'}`}>
                                    {lang === 'ar' ? 'CHAPTERS' : 'الشباتر'}
                                </span>
                            </div>
                            <div className="relative z-10">
                                <h1 className={`text-4xl sm:text-5xl md:text-6xl font-[900] mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {t.title}
                                </h1>
                                <p className={`text-base sm:text-lg font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {t.subtitle}
                                </p>
                            </div>
                        </section>

                        {/* Search Bar */}
                        <div className="mb-12 max-w-2xl mx-auto relative group">
                            <div className={`absolute inset-y-0 ${lang === 'ar' ? 'right-5' : 'left-5'} flex items-center pointer-events-none text-xl opacity-40 group-focus-within:opacity-100 transition-opacity`}>
                                🔍
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t.searchPlaceholder}
                                className={`w-full ${lang === 'ar' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-5 rounded-[2rem] border-2 transition-all outline-none font-bold text-lg ${
                                    isDark 
                                        ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500/50 focus:bg-slate-900' 
                                        : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500/30 shadow-xl shadow-indigo-500/5'
                                }`}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {courses.map((course) => (
                                <div 
                                    key={course.id} 
                                    onClick={() => setSelectedCourseId(course.id)}
                                    className={`group cursor-pointer rounded-[2.5rem] border overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${
                                        isDark ? 'hover:shadow-indigo-500/10' : 'hover:shadow-indigo-500/10'
                                    } ${card}`}
                                >
                                    <div className="p-8">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="min-w-0">
                                                <h3 className={`text-xl font-[900] mb-1 truncate ${heading}`}>{course.name}</h3>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-indigo-500 font-black text-xs tracking-wider uppercase">{course.code}</p>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                    <p className={`text-[10px] font-black uppercase ${subtext}`}>
                                                        {course.chapters?.length || 0} {t.chapters}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform`}>
                                                📚
                                            </div>
                                        </div>

                                        <div className="space-y-2 mb-6">
                                            {(course.chapters || []).slice(0, 2).map((chapter) => (
                                                <div key={chapter.id} className={`flex items-center gap-2.5 p-3 rounded-xl ${isDark ? 'bg-slate-900/40 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                                                    <span className="text-[10px] w-5 h-5 rounded-md flex items-center justify-center bg-indigo-500 text-white font-bold">{chapter.order}</span>
                                                    <span className="text-[13px] font-bold truncate">{chapter.title}</span>
                                                </div>
                                            ))}
                                            {(course.chapters || []).length > 2 && (
                                                <p className={`text-[10px] font-black text-center mt-2 opacity-50 ${subtext}`}>
                                                    + {(course.chapters || []).length - 2} {lang === 'ar' ? 'شباتر إضافية' : 'more chapters'}
                                                </p>
                                            )}
                                        </div>

                                        <button className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-500/10 text-indigo-500 font-[900] text-sm transition-all group-hover:bg-indigo-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-500/30">
                                            {t.viewChapters}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Empty State */}
                        {courses.length === 0 && (
                            <div className="text-center py-32 animate-in fade-in zoom-in duration-700">
                                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl shadow-inner">
                                    🏜️
                                </div>
                                <p className={`text-2xl font-[900] mb-2 ${heading}`}>{t.noResults}</p>
                                <p className={`text-sm font-bold ${subtext}`}>{lang === 'ar' ? 'جرب البحث بكلمات أخرى' : 'Try searching with different keywords'}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

ChaptersIndex.layout = page => <MainLayout>{page}</MainLayout>;

