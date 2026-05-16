import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function QuizIndex({ courses = [], filters = {}, recentAttempts = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    
    const [search, setSearch] = useState(filters.search || '');
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
        all: 'الكل',
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
        all: 'All',
    };

    const applyFilter = (params) => {
        const current = { ...(filters || {}), ...(params || {}) };
        Object.keys(current || {}).forEach(k => { if (!current[k]) delete current[k]; });
        router.get(route('quiz.index'), current, { preserveState: true, preserveScroll: true });
    };

    const handleStart = (mode) => {
        if (!selectedCourse) return;
        router.get(route('quiz.start'), {
            course_id: selectedCourse.id,
            chapter_id: selectedChapter || null,
            mode,
            count: questionCount,
        });
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200 shadow-sm';
    const heading = isDark ? 'text-white' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';

    const inputCls = `w-full p-4 rounded-2xl border-2 transition-all outline-none font-bold text-sm ${
        isDark ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500 shadow-sm'
    }`;

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head title={t.title} />

            <div className="max-w-7xl mx-auto">
                <div className="relative mb-20 text-center">
                    <div className={`inline-block px-12 py-8 rounded-[2.5rem] border transition-all duration-700 shadow-2xl relative overflow-hidden group ${
                        isDark ? 'bg-slate-800/40 border-slate-700/50 shadow-indigo-500/10' : 'bg-white/80 border-slate-100 shadow-indigo-500/5'
                    }`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                        <h1 className={`text-4xl md:text-6xl font-black mb-3 relative z-10 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.title}</h1>
                        <p className={`text-lg md:text-xl font-bold opacity-70 relative z-10 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t.subtitle}</p>
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700" />
                        <div className="absolute -top-12 -left-12 w-32 h-32 bg-violet-500/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-700" />
                    </div>
                </div>

                {/* Search Row */}
                <div className="mb-12 max-w-2xl mx-auto relative group">
                    <div className={`absolute ${lang === 'ar' ? 'right-5' : 'left-5'} inset-y-0 flex items-center pointer-events-none text-xl opacity-40 group-focus-within:opacity-100 transition-opacity`}>
                        🔍
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onBlur={() => applyFilter({ search })}
                        onKeyDown={e => e.key === 'Enter' && applyFilter({ search })}
                        placeholder={t.searchPlaceholder}
                        className={`w-full ${lang === 'ar' ? 'pr-14 pl-6' : 'pl-14 pr-6'} py-5 rounded-[2rem] border-2 transition-all outline-none font-bold text-lg ${
                            isDark 
                                ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500/50 focus:bg-slate-900' 
                                : 'bg-white border-slate-100 text-slate-900 focus:border-indigo-500/30 shadow-xl shadow-indigo-500/5'
                        }`}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Course Selection Area */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {courses.map((course) => (
                                <button
                                    key={course.id}
                                    onClick={() => {
                                        setSelectedCourse(course);
                                        setSelectedChapter(null);
                                    }}
                                    className={`group p-6 rounded-[2rem] border-2 text-right transition-all duration-300 hover:-translate-y-1 ${
                                        selectedCourse?.id === course.id 
                                            ? 'border-indigo-500 bg-indigo-500/5 shadow-xl shadow-indigo-500/10' 
                                            : card + ' border-transparent hover:border-indigo-500/30'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg transition-transform group-hover:scale-110`}>
                                            📚
                                        </div>
                                        <div className="text-left">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${isDark ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                                {course.questions_count} Q
                                            </span>
                                        </div>
                                    </div>
                                    <h3 className={`text-lg font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{course.name}</h3>
                                    <p className="text-indigo-500 font-bold text-xs uppercase tracking-widest">{course.code}</p>
                                </button>
                            ))}
                        </div>

                        {courses.length === 0 && (
                            <div className="text-center py-20">
                                <div className="text-5xl mb-4 opacity-20">🏜️</div>
                                <p className={`text-lg font-black ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t.noResults}</p>
                            </div>
                        )}
                    </div>

                    {/* Config & Recent Area */}
                    <div className="space-y-6">
                        {selectedCourse ? (
                            <div className={`p-8 rounded-[3rem] border-2 border-indigo-500/30 sticky top-8 shadow-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                                <div className="mb-6">
                                    <p className="text-indigo-500 font-black text-xs tracking-widest uppercase mb-1">{selectedCourse.code}</p>
                                    <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedCourse.name}</h2>
                                </div>
                                
                                <div className="space-y-6 mb-8">
                                    <div>
                                        <label className={`block text-[11px] font-black uppercase mb-2 opacity-50 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.allChapters}</label>
                                        <select
                                            value={selectedChapter || ''}
                                            onChange={(e) => setSelectedChapter(e.target.value || null)}
                                            className={`w-full p-4 rounded-xl font-bold border-2 transition-all ${isDark ? 'bg-slate-900 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-100 text-slate-900 focus:border-indigo-500'}`}
                                        >
                                            <option value="">{t.allChapters}</option>
                                            {(selectedCourse.chapters || []).map(ch => (
                                                <option key={ch.id} value={ch.id}>{ch.title} ({ch.questions_count})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={`block text-[11px] font-black uppercase mb-2 opacity-50 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                            {lang === 'ar' ? 'عدد الأسئلة' : 'Question Count'}: {questionCount}
                                        </label>
                                        <input 
                                            type="range" min="5" max="50" step="5"
                                            value={questionCount}
                                            onChange={e => setQuestionCount(e.target.value)}
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={() => handleStart('quiz')} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg shadow-indigo-500/30 group">
                                        <span className="text-3xl group-hover:scale-125 transition-transform duration-300">🏆</span>
                                        <span className="font-[900] text-sm">{t.quiz}</span>
                                    </button>
                                    <button onClick={() => handleStart('practice')} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-lg group">
                                        <span className="text-3xl group-hover:scale-125 transition-transform duration-300">🧠</span>
                                        <span className="font-[900] text-sm">{t.practice}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className={`p-8 rounded-[3rem] border-2 border-dashed flex flex-col items-center justify-center text-center py-20 ${isDark ? 'border-slate-800 text-slate-600' : 'border-slate-200 text-slate-400'}`}>
                                <div className="text-5xl mb-4 opacity-20">👈</div>
                                <p className="font-black">{lang === 'ar' ? 'اختر مادة للبدء' : 'Select a course to start'}</p>
                            </div>
                        )}

                        <div className={`p-6 rounded-[2.5rem] border ${card}`}>
                            <h3 className={`text-lg font-black mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                <span>📜</span> {t.recentResults}
                            </h3>
                            <div className="space-y-3">
                                {recentAttempts.map(attempt => (
                                    <div key={attempt.id} className={`p-4 rounded-2xl border transition-all hover:bg-indigo-500/5 ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${attempt.mode === 'quiz' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {attempt.mode === 'quiz' ? t.modeQuiz : t.modePractice}
                                            </span>
                                            <span className="text-indigo-500 font-black text-sm">{attempt.score_percentage}%</span>
                                        </div>
                                        <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{attempt.course?.name}</p>
                                        <p className="text-[10px] font-bold text-slate-500 mt-1">{new Date(attempt.created_at).toLocaleDateString()}</p>
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
