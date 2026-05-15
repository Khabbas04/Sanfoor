import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

export default function QuizIndex({ courses = [], recentAttempts = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [search, setSearch] = useState('');
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [questionCount, setQuestionCount] = useState(10);
    const [showConfig, setShowConfig] = useState(false);

    const t = lang === 'ar' ? {
        title: 'بنك الأسئلة',
        subtitle: 'اختبر نفسك بنظام الكويز والتدريب لكل مادة',
        searchPlaceholder: 'ابحث عن مادة...',
        questions: 'سؤال',
        quiz: '🏆 كويز',
        practice: '🧠 تدريب',
        quizDesc: 'اختبار حقيقي: شوف نتيجتك بالنهاية',
        practiceDesc: 'تعلّم: شوف الإجابة بعد كل سؤال',
        startQuiz: 'ابدأ الكويز',
        startPractice: 'ابدأ التدريب',
        allChapters: 'كل الشابترز',
        selectCourse: 'اختر مادة للبدء',
        noQuestions: 'لا توجد مواد تحتوي على أسئلة حالياً.',
        noResults: 'لا توجد نتائج مطابقة.',
        recentResults: 'آخر النتائج',
        score: 'النتيجة',
        correct: 'صحيح',
        of: 'من',
        questionCount: 'عدد الأسئلة',
        chooseChapter: 'اختر الشابتر',
        noAttempts: 'لم تخض أي اختبار بعد.',
        mode: 'النوع',
        modeQuiz: 'كويز',
        modePractice: 'تدريب',
        back: 'رجوع',
    } : {
        title: 'Quiz Bank',
        subtitle: 'Test yourself with quiz and practice modes',
        searchPlaceholder: 'Search for a course...',
        questions: 'questions',
        quiz: '🏆 Quiz',
        practice: '🧠 Practice',
        quizDesc: 'Real test: see your score at the end',
        practiceDesc: 'Learn: see the answer after each question',
        startQuiz: 'Start Quiz',
        startPractice: 'Start Practice',
        allChapters: 'All Chapters',
        selectCourse: 'Select a course to start',
        noQuestions: 'No courses with questions available.',
        noResults: 'No matching results.',
        recentResults: 'Recent Results',
        score: 'Score',
        correct: 'Correct',
        of: 'of',
        questionCount: 'Question count',
        chooseChapter: 'Choose chapter',
        noAttempts: 'No attempts yet.',
        mode: 'Mode',
        modeQuiz: 'Quiz',
        modePractice: 'Practice',
        back: 'Back',
    };

    const filteredCourses = useMemo(() => {
        if (!search.trim()) return courses;
        const q = search.toLowerCase();
        return courses.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }, [courses, search]);

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-white' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';

    const handleStart = (mode) => {
        if (!selectedCourse) return;
        router.post(route('quiz.start'), {
            course_id: selectedCourse.id,
            chapter_id: selectedChapter || null,
            mode,
            count: questionCount,
        });
    };

    const getScoreColor = (pct) => {
        if (pct >= 80) return 'text-emerald-500';
        if (pct >= 60) return 'text-amber-500';
        return 'text-rose-500';
    };

    const getScoreBg = (pct) => {
        if (pct >= 80) return isDark ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200';
        if (pct >= 60) return isDark ? 'bg-amber-500/15 border-amber-500/30' : 'bg-amber-50 border-amber-200';
        return isDark ? 'bg-rose-500/15 border-rose-500/30' : 'bg-rose-50 border-rose-200';
    };

    return (
        <div className="min-h-screen" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head>
                <title>{t.title} | سنفور</title>
                <meta name="description" content={t.subtitle} />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/quiz`} />
            </Head>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-card { animation: fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
                @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.3); } 50% { box-shadow: 0 0 20px 4px rgba(99, 102, 241, 0.15); } }
                .pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
            ` }} />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                {/* Hero */}
                <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 shadow-[0_20px_60px_-32px_rgba(99,102,241,0.5)] mb-10">
                    <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />
                    <div className="relative z-10 p-8 sm:p-12 text-center text-white">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-[11px] font-black tracking-widest uppercase mb-6 backdrop-blur-sm">
                            ❓ {lang === 'ar' ? 'مركز الاختبارات' : 'Quiz Center'}
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-[900] tracking-tight mb-3">{t.title}</h1>
                        <p className="text-white/70 font-bold text-sm sm:text-base max-w-lg mx-auto">{t.subtitle}</p>
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Course Selection */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Search */}
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

                        {filteredCourses.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="text-5xl mb-4 opacity-30">❓</div>
                                <p className={`text-base font-bold ${subtext}`}>{search ? t.noResults : t.noQuestions}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredCourses.map((course, idx) => {
                                    const isSelected = selectedCourse?.id === course.id;
                                    return (
                                        <button
                                            key={course.id}
                                            onClick={() => {
                                                setSelectedCourse(isSelected ? null : course);
                                                setSelectedChapter(null);
                                                setShowConfig(!isSelected);
                                            }}
                                            className={`animate-card text-right p-5 rounded-[1.5rem] border shadow-sm transition-all duration-300 ${card} hover:shadow-lg ${isSelected ? (isDark ? 'ring-2 ring-indigo-500 border-indigo-500/50' : 'ring-2 ring-indigo-400 border-indigo-300') : (isDark ? 'hover:border-indigo-500/40' : 'hover:border-indigo-200')}`}
                                            style={{ animationDelay: `${idx * 60}ms` }}
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    {course.code?.slice(0, 2) || '📝'}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className={`text-[13px] font-[900] truncate ${heading}`}>{course.name}</h3>
                                                    <p className={`text-[10px] font-bold font-mono mt-0.5 ${subtext}`}>{course.code}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-700'}`}>
                                                    {course.questions_count} {t.questions}
                                                </span>
                                                {course.chapters && course.chapters.length > 0 && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                                        {course.chapters.length} {lang === 'ar' ? 'شابتر' : 'chapters'}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Panel — Config + History */}
                    <div className="space-y-6">
                        {/* Quiz Config */}
                        {showConfig && selectedCourse ? (
                            <div className={`animate-card rounded-[2rem] border p-6 shadow-sm ${card}`}>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>🎯</div>
                                    <div>
                                        <h3 className={`text-[14px] font-[900] ${heading}`}>{selectedCourse.name}</h3>
                                        <p className={`text-[10px] font-bold ${subtext}`}>{selectedCourse.code}</p>
                                    </div>
                                </div>

                                {/* Chapter Select */}
                                {selectedCourse.chapters && selectedCourse.chapters.length > 0 && (
                                    <div className="mb-5">
                                        <label className={`text-[11px] font-black block mb-2 ${subtext}`}>{t.chooseChapter}</label>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setSelectedChapter(null)}
                                                className={`px-3 py-1.5 rounded-lg text-[11px] font-[800] border transition-all ${!selectedChapter ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : (isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200')}`}
                                            >
                                                {t.allChapters}
                                            </button>
                                            {selectedCourse.chapters.map(ch => (
                                                <button
                                                    key={ch.id}
                                                    onClick={() => setSelectedChapter(ch.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-[800] border transition-all ${selectedChapter === ch.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : (isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200')}`}
                                                >
                                                    {ch.title} {ch.questions_count > 0 && <span className="opacity-60">({ch.questions_count})</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Question Count */}
                                <div className="mb-6">
                                    <label className={`text-[11px] font-black block mb-2 ${subtext}`}>{t.questionCount}</label>
                                    <div className="flex gap-2">
                                        {[5, 10, 15, 20, 30].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setQuestionCount(n)}
                                                className={`flex-1 py-2 rounded-lg text-[12px] font-[800] border transition-all ${questionCount === n ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : (isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200')}`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Mode Buttons */}
                                <div className="space-y-3">
                                    <button
                                        onClick={() => handleStart('quiz')}
                                        className="w-full p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-[800] text-[13px] shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all active:scale-[0.97] pulse-glow"
                                    >
                                        <div className="text-lg mb-1">{t.quiz}</div>
                                        <div className="text-[10px] text-white/60 font-bold">{t.quizDesc}</div>
                                    </button>
                                    <button
                                        onClick={() => handleStart('practice')}
                                        className={`w-full p-4 rounded-2xl border font-[800] text-[13px] transition-all active:scale-[0.97] ${isDark ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
                                    >
                                        <div className="text-lg mb-1">{t.practice}</div>
                                        <div className={`text-[10px] font-bold ${subtext}`}>{t.practiceDesc}</div>
                                    </button>
                                </div>
                            </div>
                        ) : !showConfig && (
                            <div className={`rounded-[2rem] border p-8 text-center ${card}`}>
                                <div className="text-4xl mb-3 opacity-30">🎯</div>
                                <p className={`text-sm font-bold ${subtext}`}>{t.selectCourse}</p>
                            </div>
                        )}

                        {/* Recent Attempts */}
                        <div className={`rounded-[2rem] border p-6 shadow-sm ${card}`}>
                            <h3 className={`text-[14px] font-[900] mb-4 flex items-center gap-2 ${heading}`}>
                                📊 {t.recentResults}
                            </h3>
                            {recentAttempts.length === 0 ? (
                                <p className={`text-[12px] font-bold text-center py-6 ${subtext}`}>{t.noAttempts}</p>
                            ) : (
                                <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
                                    {recentAttempts.map(attempt => (
                                        <div key={attempt.id} className={`p-3.5 rounded-xl border transition-colors ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[12px] font-[800] truncate ${heading}`}>{attempt.course?.name || ''}</span>
                                                <span className={`text-[14px] font-[900] ${getScoreColor(attempt.score_percentage)}`}>{attempt.score_percentage}%</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getScoreBg(attempt.score_percentage)}`}>
                                                    {attempt.correct_answers} / {attempt.total_questions} {t.correct}
                                                </span>
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                                                    {attempt.mode === 'quiz' ? t.modeQuiz : t.modePractice}
                                                </span>
                                                {attempt.chapter && (
                                                    <span className={`text-[9px] font-bold ${subtext}`}>{attempt.chapter.title}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

QuizIndex.layout = page => (
    <MainLayout>
        {page}
    </MainLayout>
);
