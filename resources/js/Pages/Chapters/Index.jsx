import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function ChaptersIndex(props) {
    // Ultra-safe props extraction
    const courses = Array.isArray(props.courses) ? props.courses : [];
    
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [search, setSearch] = useState('');
    const [expandedCourse, setExpandedCourse] = useState(null);

    const t = lang === 'ar' ? {
        title: 'شابترز المواد',
        subtitle: 'تصفّح محتوى الشابترز لكل مادة دراسية',
        searchPlaceholder: 'ابحث عن مادة...',
        chapters: 'شابتر',
        noChapters: 'لا توجد شابترز متاحة حالياً.',
        noResults: 'لا توجد نتائج مطابقة للبحث.',
        semester: 'الفصل',
        credits: 'ساعات',
        goToQuiz: 'ابدأ تدريب',
    } : {
        title: 'Course Chapters',
        subtitle: 'Browse chapter content for each course',
        searchPlaceholder: 'Search for a course...',
        chapters: 'chapters',
        noChapters: 'No chapters available yet.',
        noResults: 'No results match your search.',
        semester: 'Semester',
        credits: 'credits',
        goToQuiz: 'Start Practice',
    };

    const filteredCourses = useMemo(() => {
        const q = (search || '').toLowerCase().trim();
        if (!q) return courses;
        return courses.filter(c => 
            (c?.name || '').toLowerCase().includes(q) || 
            (c?.code || '').toLowerCase().includes(q)
        );
    }, [courses, search]);

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm';

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <Head title={t.title} />
            
            <div className="max-w-7xl mx-auto">
                <div className="mb-12 text-center">
                    <h1 className={`text-4xl font-black mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.title}</h1>
                    <p className={`text-lg font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.subtitle}</p>
                </div>

                <div className="mb-8 max-w-2xl mx-auto relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-xl">🔍</div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t.searchPlaceholder}
                        className={`w-full pl-12 pr-6 py-4 rounded-2xl border-2 transition-all outline-none font-bold ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500 shadow-lg shadow-indigo-500/5'}`}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourses.map((course) => (
                        <div key={course.id} className={`rounded-[2rem] border overflow-hidden transition-all duration-300 hover:-translate-y-1 ${card}`}>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className={`text-xl font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{course.name}</h3>
                                        <p className="text-indigo-500 font-black text-sm tracking-wider uppercase">{course.code}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isDark ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                        {t.semester} {course.semester}
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    {(course.chapters || []).slice(0, 3).map((chapter) => (
                                        <div key={chapter.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                            <span className="text-lg">📄</span>
                                            <span className={`text-sm font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{chapter.title}</span>
                                        </div>
                                    ))}
                                    {(course.chapters || []).length > 3 && (
                                        <p className="text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">+ {(course.chapters || []).length - 3} more chapters</p>
                                    )}
                                    {(course.chapters || []).length === 0 && (
                                        <p className="text-sm font-bold text-slate-400 italic">{t.noChapters}</p>
                                    )}
                                </div>

                                <Link
                                    href={route('quiz.index', { course: course.id })}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                                >
                                    <span>🎯</span> {t.goToQuiz}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredCourses.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🏜️</div>
                        <p className={`text-xl font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.noResults}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

ChaptersIndex.layout = page => <MainLayout>{page}</MainLayout>;
