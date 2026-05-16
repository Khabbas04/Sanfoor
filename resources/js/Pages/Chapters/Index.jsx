import React, { useState, useEffect, useCallback } from 'react';
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

    const t = lang === 'ar' ? {
        title: 'شابترز المواد',
        subtitle: 'تصفّح محتوى الشابترز وحمل الملفات الدراسية',
        searchPlaceholder: 'ابحث عن مادة أو شابتر معين...',
        chapters: 'شابتر',
        noChapters: 'لا توجد شابترز متاحة حالياً.',
        noResults: 'لا توجد نتائج مطابقة للبحث.',
        semester: 'الفصل',
        credits: 'ساعات',
        goToQuiz: 'بنك الأسئلة',
        download: 'تحميل الشابتر',
        courseContent: 'محتوى المادة',
    } : {
        title: 'Course Chapters',
        subtitle: 'Browse chapters and download study materials',
        searchPlaceholder: 'Search for a course or chapter...',
        chapters: 'chapters',
        noChapters: 'No chapters available yet.',
        noResults: 'No results match your search.',
        semester: 'Semester',
        credits: 'credits',
        goToQuiz: 'Question Bank',
        download: 'Download Chapter',
        courseContent: 'Course Content',
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
                {/* Hero Section */}
                <div className="relative mb-16 text-center">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -z-10" />
                    <h1 className={`text-4xl md:text-5xl font-[900] mb-4 bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent`}>
                        {t.title}
                    </h1>
                    <p className={`text-lg font-bold ${subtext}`}>{t.subtitle}</p>
                </div>

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

                {/* Course Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {courses.map((course) => (
                        <div key={course.id} className={`group rounded-[2.5rem] border overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${
                            isDark ? 'hover:shadow-indigo-500/10' : 'hover:shadow-indigo-500/10'
                        } ${card}`}>
                            <div className="p-8">
                                {/* Course Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="min-w-0">
                                        <h3 className={`text-xl font-[900] mb-1 truncate ${heading}`}>{course.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <p className="text-indigo-500 font-black text-xs tracking-wider uppercase">{course.code}</p>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                            <p className={`text-[10px] font-black uppercase ${subtext}`}>
                                                {t.semester} {course.semester}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20`}>
                                        📚
                                    </div>
                                </div>

                                {/* Chapters List */}
                                <div className="space-y-3 mb-8">
                                    <p className={`text-[11px] font-black uppercase tracking-widest mb-4 ${subtext} opacity-70`}>{t.courseContent}</p>
                                    {(course.chapters || []).map((chapter) => (
                                        <div key={chapter.id} className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                                            isDark 
                                                ? 'bg-slate-900/40 border-slate-700/50 hover:border-indigo-500/30' 
                                                : 'bg-slate-50/50 border-slate-100 hover:border-indigo-500/20'
                                        }`}>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${
                                                    isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                                                }`}>
                                                    {chapter.order}
                                                </div>
                                                <span className={`text-sm font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{chapter.title}</span>
                                            </div>
                                            
                                            {chapter.google_drive_link && (
                                                <a 
                                                    href={chapter.google_drive_link} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    title={t.download}
                                                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                                        isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400' : 'text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-md'
                                                    }`}
                                                >
                                                    📥
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                    
                                    {(course.chapters || []).length === 0 && (
                                        <div className={`py-8 text-center rounded-2xl border-2 border-dashed ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'}`}>
                                            <p className="text-sm font-bold">{t.noChapters}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <Link
                                        href={route('quiz.index', { course: course.id })}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-[900] text-sm transition-all shadow-xl shadow-indigo-600/20 active:scale-95 hover:opacity-90"
                                    >
                                        <span>🎯</span> {t.goToQuiz}
                                    </Link>
                                </div>
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
            </div>
        </div>
    );
}

ChaptersIndex.layout = page => <MainLayout>{page}</MainLayout>;

