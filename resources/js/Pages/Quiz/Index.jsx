import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function QuizIndex(props) {
    // Ultra-safe props extraction
    const courses = Array.isArray(props.courses) ? props.courses : [];
    const recentAttempts = Array.isArray(props.recentAttempts) ? props.recentAttempts : [];

    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [search, setSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [questionCount, setQuestionCount] = useState(10);

    const t = lang === 'ar' ? {
        title: 'بنك الأسئلة',
        subtitle: 'اختبر نفسك بنظام الكويز والتدريب لكل مادة',
        searchPlaceholder: 'ابحث عن مادة...',
        quiz: '🏆 كويز',
        practice: '🧠 تدريب',
        start: 'ابدأ الآن',
        allChapters: 'كل الشابترز',
        noResults: 'لا توجد نتائج مطابقة.',
        recentResults: 'آخر النتائج',
        correct: 'صحيح',
        modeQuiz: 'كويز',
        modePractice: 'تدريب',
    } : {
        title: 'Question Bank',
        subtitle: 'Test yourself with Quiz or Practice modes',
        searchPlaceholder: 'Search for a course...',
        quiz: '🏆 Quiz',
        practice: '🧠 Practice',
        start: 'Start Now',
        allChapters: 'All Chapters',
        noResults: 'No results found.',
        recentResults: 'Recent Results',
        correct: 'Correct',
        modeQuiz: 'Quiz',
        modePractice: 'Practice',
    };

    const filteredCourses = useMemo(() => {
        const q = (search || '').toLowerCase().trim();
        if (!q) return courses;
        return courses.filter(c => 
            (c?.name || '').toLowerCase().includes(q) || 
            (c?.code || '').toLowerCase().includes(q)
        );
    }, [courses, search]);

    const handleStart = (mode) => {
        if (!selectedCourse) return;
        router.post(route('quiz.start'), {
            course_id: selectedCourse.id,
            chapter_id: selectedChapter || null,
            mode,
            count: questionCount,
        });
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <Head title={t.title} />

            <div className="max-w-7xl mx-auto">
                <div className="mb-12 text-center">
                    <h1 className={`text-4xl font-black mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.title}</h1>
                    <p className={`text-lg font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.subtitle}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Course Selection Area */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">🔍</div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={t.searchPlaceholder}
                                className={`w-full pl-12 pr-6 py-4 rounded-2xl border-2 transition-all outline-none font-bold ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredCourses.map((course) => (
                                <button
                                    key={course.id}
                                    onClick={() => {
                                        setSelectedCourse(course);
                                        setSelectedChapter(null);
                                    }}
                                    className={`p-6 rounded-3xl border-2 text-right transition-all hover:scale-[1.02] active:scale-95 ${selectedCourse?.id === course.id ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/10' : card + ' border-transparent'}`}
                                >
                                    <h3 className={`text-lg font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{course.name}</h3>
                                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{course.code}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Config & Recent Area */}
                    <div className="space-y-6">
                        {selectedCourse && (
                            <div className={`p-8 rounded-[2.5rem] border-2 border-indigo-500/30 sticky top-8 ${isDark ? 'bg-slate-800' : 'bg-white shadow-xl'}`}>
                                <h2 className={`text-2xl font-black mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedCourse.name}</h2>
                                
                                <div className="space-y-4 mb-8">
                                    <select
                                        value={selectedChapter || ''}
                                        onChange={(e) => setSelectedChapter(e.target.value || null)}
                                        className={`w-full p-4 rounded-xl font-bold border-2 ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'}`}
                                    >
                                        <option value="">{t.allChapters}</option>
                                        {(selectedCourse.chapters || []).map(ch => (
                                            <option key={ch.id} value={ch.id}>{ch.title}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => handleStart('quiz')} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all group">
                                        <span className="text-2xl group-hover:scale-110 transition-transform">🏆</span>
                                        <span className="font-black text-sm">{t.quiz}</span>
                                    </button>
                                    <button onClick={() => handleStart('practice')} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white transition-all group">
                                        <span className="text-2xl group-hover:scale-110 transition-transform">🧠</span>
                                        <span className="font-black text-sm">{t.practice}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`p-6 rounded-[2rem] border ${card}`}>
                            <h3 className={`text-lg font-black mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                <span>📜</span> {t.recentResults}
                            </h3>
                            <div className="space-y-3">
                                {recentAttempts.map(attempt => (
                                    <div key={attempt.id} className={`p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs font-black px-2 py-0.5 rounded ${attempt.mode === 'quiz' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {attempt.mode === 'quiz' ? t.modeQuiz : t.modePractice}
                                            </span>
                                            <span className="text-indigo-500 font-black text-sm">{attempt.score_percentage}%</span>
                                        </div>
                                        <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{attempt.course?.name}</p>
                                    </div>
                                ))}
                                {recentAttempts.length === 0 && (
                                    <p className="text-center py-4 text-slate-500 font-bold text-sm">No attempts yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

QuizIndex.layout = page => <MainLayout>{page}</MainLayout>;
