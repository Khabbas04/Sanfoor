import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

export default function ChaptersIndex({ courses = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    
    // Safety check for props
    courses = courses || [];

    const [search, setSearch] = useState('');
    const [expandedCourse, setExpandedCourse] = useState(null);

    const t = {
        ar: {
            title: 'شابترز المواد',
            subtitle: 'تصفّح محتوى الشابترز لكل مادة دراسية',
            searchPlaceholder: 'ابحث عن مادة...',
            chapters: 'شابتر',
            questions: 'سؤال',
            noChapters: 'لا توجد شابترز متاحة حالياً.',
            noResults: 'لا توجد نتائج مطابقة للبحث.',
            semester: 'الفصل',
            credits: 'ساعات',
            goToQuiz: 'ابدأ تدريب',
        },
        en: {
            title: 'Course Chapters',
            subtitle: 'Browse chapter content for each course',
            searchPlaceholder: 'Search for a course...',
            chapters: 'chapters',
            questions: 'questions',
            noChapters: 'No chapters available yet.',
            noResults: 'No results match your search.',
            semester: 'Semester',
            credits: 'credits',
            goToQuiz: 'Start Practice',
        },
    }[lang] || {
        title: 'شابترز المواد', subtitle: 'تصفّح محتوى الشابترز لكل مادة دراسية',
        searchPlaceholder: 'ابحث عن مادة...', chapters: 'شابتر', questions: 'سؤال',
        noChapters: 'لا توجد شابترز متاحة حالياً.', noResults: 'لا توجد نتائج مطابقة للبحث.',
        semester: 'الفصل', credits: 'ساعات', goToQuiz: 'ابدأ تدريب',
    };

    const filteredCourses = useMemo(() => {
        if (!search.trim()) return courses;
        const q = search.toLowerCase();
        return courses.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.code.toLowerCase().includes(q)
        );
    }, [courses, search]);

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const cardHover = isDark ? 'hover:border-indigo-500/50 hover:bg-slate-800' : 'hover:border-indigo-300 hover:shadow-lg';
    const heading = isDark ? 'text-white' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const chapterCard = isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200';

    return (
        <div className="min-h-screen" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head>
                <title>{t.title} | سنفور</title>
                <meta name="description" content={t.subtitle} />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/chapters`} />
            </Head>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-card { animation: fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes expandIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 2000px; } }
                .animate-expand { animation: expandIn 0.5s cubic-bezier(0.16,1,0.3,1) both; overflow: hidden; }
            ` }} />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                {/* Hero Section */}
                <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 shadow-[0_20px_60px_-32px_rgba(79,70,229,0.5)] mb-10">
                    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl" />
                    <div className="relative z-10 p-8 sm:p-12 text-center text-white">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-[11px] font-black tracking-widest uppercase mb-6 backdrop-blur-sm">
                            📖 {lang === 'ar' ? 'المكتبة الأكاديمية' : 'Academic Library'}
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-[900] tracking-tight mb-3">{t.title}</h1>
                        <p className="text-white/70 font-bold text-sm sm:text-base max-w-lg mx-auto">{t.subtitle}</p>
                    </div>
                </section>

                {/* Search */}
                <div className="mb-8">
                    <div className={`relative rounded-2xl border shadow-sm ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg opacity-40">🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t.searchPlaceholder}
                            className={`w-full py-4 pr-12 pl-5 rounded-2xl border-0 bg-transparent text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 ${heading}`}
                        />
                    </div>
                </div>

                {/* Courses List */}
                {filteredCourses.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4 opacity-30">📖</div>
                        <p className={`text-base font-bold ${subtext}`}>{search ? t.noResults : t.noChapters}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredCourses.map((course, idx) => {
                            const isExpanded = expandedCourse === course.id;
                            return (
                                <div
                                    key={course.id}
                                    className="animate-card"
                                    style={{ animationDelay: `${idx * 60}ms` }}
                                >
                                    {/* Course Header */}
                                    <button
                                        onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                                        className={`w-full text-right p-5 sm:p-6 rounded-[1.5rem] border shadow-sm transition-all duration-300 ${card} ${cardHover} ${isExpanded ? (isDark ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-indigo-300 ring-1 ring-indigo-200/50') : ''}`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 shadow-inner ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    {course.code?.slice(0, 2) || '📖'}
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className={`text-[15px] font-[900] truncate ${heading}`}>{course.name}</h3>
                                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                        <span className={`text-[11px] font-bold font-mono ${subtext}`}>{course.code}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{course.credit_hours} {t.credits}</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700'}`}>{course.chapters_count} {t.chapters}</span>
                                                        {course.questions_count > 0 && (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-700'}`}>{course.questions_count} {t.questions}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`text-xl transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                                                ▾
                                            </span>
                                        </div>
                                    </button>

                                    {/* Expanded Chapters */}
                                    {isExpanded && course.chapters && course.chapters.length > 0 && (
                                        <div className="animate-expand mt-2 pr-4 sm:pr-8 space-y-3">
                                            {course.chapters.map((chapter, cIdx) => (
                                                <div
                                                    key={chapter.id}
                                                    className={`p-5 rounded-2xl border transition-all duration-300 ${chapterCard} animate-card`}
                                                    style={{ animationDelay: `${cIdx * 80}ms` }}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${isDark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                                                            {chapter.order || cIdx + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className={`text-[14px] font-[800] ${heading}`}>{chapter.title}</h4>
                                                            {chapter.description && (
                                                                <p className={`text-[12px] font-bold mt-1.5 leading-relaxed ${subtext}`}>{chapter.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* Quiz CTA */}
                                            {course.questions_count > 0 && (
                                                <Link
                                                    href="/quiz"
                                                    className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-[800] text-[13px] shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-[0.97] mt-2"
                                                >
                                                    🧠 {t.goToQuiz} • {course.questions_count} {t.questions}
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

ChaptersIndex.layout = page => (
    <MainLayout>
        {page}
    </MainLayout>
);
