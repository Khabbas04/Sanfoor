import React, { useState, useEffect, useCallback } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function QuizSession({ questions: questionsProp = [], course: courseProp, chapter, mode = 'quiz' }) {
    const questions = Array.isArray(questionsProp) ? questionsProp : [];
    const course = courseProp || { id: 0, name: '' };
    const { isDark } = useTheme();
    const { lang } = useLanguage();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showResult, setShowResult] = useState(false);
    const [results, setResults] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [startTime] = useState(Date.now());
    const [elapsed, setElapsed] = useState(0);
    // Practice mode: show answer immediately after selecting
    const [practiceRevealed, setPracticeRevealed] = useState(false);
    const [practiceResult, setPracticeResult] = useState(null);

    const isPractice = mode === 'practice';
    const total = questions.length;
    const currentQ = questions[currentIndex];

    const t = lang === 'ar' ? {
        quizTitle: 'كويز',
        practiceTitle: 'تدريب',
        question: 'سؤال',
        of: 'من',
        next: 'التالي',
        previous: 'السابق',
        submit: 'إرسال الإجابات',
        submitting: 'جاري التقييم...',
        score: 'النتيجة',
        correct: 'إجابة صحيحة',
        wrong: 'إجابة خاطئة',
        resultTitle: '📊 نتيجة الاختبار',
        backToQuiz: 'العودة لبنك الأسئلة',
        tryAgain: 'إعادة المحاولة',
        explanation: 'الشرح',
        correctAnswer: 'الإجابة الصحيحة',
        yourAnswer: 'إجابتك',
        timeSpent: 'الوقت المستغرق',
        minutes: 'دقيقة',
        seconds: 'ثانية',
        excellent: 'ممتاز! 🌟',
        good: 'جيد جداً! 👍',
        average: 'لا بأس 💪',
        needsWork: 'تحتاج مراجعة 📖',
        nextQuestion: 'السؤال التالي',
        noQuestions: 'لا توجد أسئلة كافية',
        unanswered: 'لم يتم الإجابة على كل الأسئلة. هل تريد المتابعة؟',
    } : {
        quizTitle: 'Quiz',
        practiceTitle: 'Practice',
        question: 'Question',
        of: 'of',
        next: 'Next',
        previous: 'Previous',
        submit: 'Submit Answers',
        submitting: 'Evaluating...',
        score: 'Score',
        correct: 'correct',
        wrong: 'wrong',
        resultTitle: '📊 Quiz Results',
        backToQuiz: 'Back to Quiz Bank',
        tryAgain: 'Try Again',
        explanation: 'Explanation',
        correctAnswer: 'Correct answer',
        yourAnswer: 'Your answer',
        timeSpent: 'Time spent',
        minutes: 'min',
        seconds: 'sec',
        excellent: 'Excellent! 🌟',
        good: 'Great job! 👍',
        average: 'Not bad 💪',
        needsWork: 'Needs review 📖',
        nextQuestion: 'Next Question',
        noQuestions: 'Not enough questions',
        unanswered: 'Not all questions answered. Continue anyway?',
    };

    // Timer
    useEffect(() => {
        if (showResult) return;
        const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [startTime, showResult]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const selectOption = useCallback((option) => {
        if (showResult) return;
        if (isPractice && practiceRevealed) return;

        setAnswers(prev => ({ ...prev, [currentQ.id]: option }));

        if (isPractice) {
            // In practice mode, submit this single answer immediately
            setPracticeRevealed(true);
            fetch('/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content },
                body: JSON.stringify({
                    course_id: course.id,
                    chapter_id: chapter?.id || null,
                    mode: 'practice',
                    answers: { [currentQ.id]: option },
                    time_spent_seconds: null,
                }),
            })
                .then(r => r.json())
                .then(data => {
                    setPracticeResult(data.results?.[currentQ.id] || null);
                })
                .catch(() => {});
        }
    }, [showResult, isPractice, practiceRevealed, currentQ, course, chapter]);

    const goNext = () => {
        if (isPractice) {
            setPracticeRevealed(false);
            setPracticeResult(null);
        }
        if (currentIndex < total - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const goPrev = () => {
        if (isPractice) {
            setPracticeRevealed(false);
            setPracticeResult(null);
        }
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        const answeredCount = Object.keys(answers).length;
        if (answeredCount < total) {
            if (!confirm(t.unanswered)) return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content },
                body: JSON.stringify({
                    course_id: course.id,
                    chapter_id: chapter?.id || null,
                    mode: 'quiz',
                    answers,
                    time_spent_seconds: elapsed,
                }),
            });
            const data = await res.json();
            setResults(data);
            setShowResult(true);
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const getScoreMessage = (pct) => {
        if (pct >= 85) return t.excellent;
        if (pct >= 70) return t.good;
        if (pct >= 50) return t.average;
        return t.needsWork;
    };

    const getScoreColor = (pct) => {
        if (pct >= 80) return 'text-emerald-500';
        if (pct >= 60) return 'text-amber-500';
        return 'text-rose-500';
    };

    const optionLabels = { a: 'A', b: 'B', c: 'C', d: 'D' };
    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-white' : 'text-slate-900';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';

    if (questions.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="text-center">
                    <div className="text-5xl mb-4">😕</div>
                    <p className={`text-lg font-bold ${subtext}`}>{t.noQuestions}</p>
                    <button onClick={() => router.visit('/quiz')} className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-[800] text-sm">{t.backToQuiz}</button>
                </div>
            </div>
        );
    }

    // ═══ RESULTS SCREEN ═══
    if (showResult && results) {
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        return (
            <div className="min-h-screen py-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <Head><title>{t.resultTitle} | سنفور</title></Head>
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes scoreReveal { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
                    .score-reveal { animation: scoreReveal 0.6s cubic-bezier(0.16,1,0.3,1) both; }
                    @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                    .animate-card { animation: fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
                ` }} />
                <div className="max-w-3xl mx-auto px-4">
                    {/* Score Card */}
                    <div className={`rounded-[2.5rem] border p-8 sm:p-10 text-center shadow-xl mb-8 ${card}`}>
                        <h2 className={`text-xl font-[900] mb-6 ${heading}`}>{t.resultTitle}</h2>
                        <div className={`score-reveal text-7xl sm:text-8xl font-[900] mb-3 ${getScoreColor(results.score_percentage)}`}>
                            {results.score_percentage}%
                        </div>
                        <p className={`text-lg font-[800] mb-2 ${heading}`}>{getScoreMessage(results.score_percentage)}</p>
                        <p className={`text-sm font-bold ${subtext}`}>
                            {results.correct} {t.correct} {t.of} {results.total} • {t.timeSpent}: {m} {t.minutes} {s} {t.seconds}
                        </p>

                        {/* Progress ring */}
                        <div className="flex justify-center gap-4 mt-6">
                            <div className={`px-5 py-3 rounded-xl border ${isDark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
                                <span className="text-2xl font-[900] text-emerald-500">{results.correct}</span>
                                <span className={`block text-[10px] font-bold ${subtext}`}>✅ {t.correct}</span>
                            </div>
                            <div className={`px-5 py-3 rounded-xl border ${isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50 border-rose-200'}`}>
                                <span className="text-2xl font-[900] text-rose-500">{results.total - results.correct}</span>
                                <span className={`block text-[10px] font-bold ${subtext}`}>❌ {t.wrong}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-center mt-8">
                            <button onClick={() => router.visit('/quiz')} className={`px-6 py-3 rounded-xl font-[800] text-[12px] border transition-all ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {t.backToQuiz}
                            </button>
                            <button onClick={() => { setShowResult(false); setResults(null); setAnswers({}); setCurrentIndex(0); }} className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-[800] text-[12px] shadow-md">
                                {t.tryAgain}
                            </button>
                        </div>
                    </div>

                    {/* Question Review */}
                    <div className="space-y-4">
                        {questions.map((q, idx) => {
                            const r = results.results?.[q.id];
                            if (!r) return null;
                            const isCorrect = r.is_correct;
                            return (
                                <div key={q.id} className={`animate-card rounded-2xl border p-5 ${card}`} style={{ animationDelay: `${idx * 50}ms` }}>
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-[900] ${isCorrect ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700')}`}>
                                            {isCorrect ? '✓' : '✗'}
                                        </span>
                                        <p className={`text-[13px] font-[800] leading-relaxed ${heading}`}>{q.question_text}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                        {['a', 'b', 'c', 'd'].map(opt => {
                                            const isChosen = r.chosen === opt;
                                            const isCorrectOpt = r.correct === opt;
                                            let cls = isDark ? 'bg-slate-900/40 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600';
                                            if (isCorrectOpt) cls = isDark ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-800';
                                            if (isChosen && !isCorrectOpt) cls = isDark ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 line-through' : 'bg-rose-50 border-rose-300 text-rose-800 line-through';
                                            return (
                                                <div key={opt} className={`px-3 py-2 rounded-xl border text-[12px] font-bold ${cls}`}>
                                                    <span className="font-[900] opacity-50 ml-1">{optionLabels[opt]}.</span> {q[`option_${opt}`]}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {r.explanation && (
                                        <div className={`p-3 rounded-xl border text-[11px] font-bold leading-relaxed ${isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}>
                                            💡 {t.explanation}: {r.explanation}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    // ═══ QUESTION SCREEN ═══
    const progress = ((currentIndex + 1) / total) * 100;

    return (
        <div className="min-h-screen" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <Head><title>{isPractice ? t.practiceTitle : t.quizTitle} — {course.name} | سنفور</title></Head>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .slide-in { animation: slideIn 0.35s cubic-bezier(0.16,1,0.3,1) both; }
            ` }} />

            <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className={`text-lg font-[900] ${heading}`}>{course.name}</h2>
                        <p className={`text-[11px] font-bold ${subtext}`}>
                            {isPractice ? `🧠 ${t.practiceTitle}` : `🏆 ${t.quizTitle}`}
                            {chapter && ` • ${chapter.title}`}
                        </p>
                    </div>
                    <div className={`text-right`}>
                        <span className={`text-xl font-[900] font-mono ${heading}`}>{formatTime(elapsed)}</span>
                        <span className={`block text-[10px] font-bold ${subtext}`}>{t.question} {currentIndex + 1} {t.of} {total}</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className={`w-full h-2 rounded-full mb-8 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>

                {/* Question Card */}
                <div key={currentQ.id} className={`slide-in rounded-[2rem] border p-6 sm:p-8 shadow-sm mb-6 ${card}`}>
                    {/* Difficulty badge */}
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${currentQ.difficulty === 'easy' ? (isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700') : currentQ.difficulty === 'hard' ? (isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700') : (isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700')}`}>
                            {currentQ.difficulty === 'easy' ? '🌿' : currentQ.difficulty === 'hard' ? '🔥' : '⚖️'} {currentQ.difficulty === 'easy' ? (lang === 'ar' ? 'سهل' : 'Easy') : currentQ.difficulty === 'hard' ? (lang === 'ar' ? 'صعب' : 'Hard') : (lang === 'ar' ? 'متوسط' : 'Medium')}
                        </span>
                    </div>

                    <p className={`text-[15px] sm:text-[16px] font-[800] leading-relaxed mb-6 ${heading}`}>{currentQ.question_text}</p>

                    {/* Options */}
                    <div className="space-y-3">
                        {['a', 'b', 'c', 'd'].map(opt => {
                            const isSelected = answers[currentQ.id] === opt;
                            let optCls;

                            if (isPractice && practiceRevealed && practiceResult) {
                                const isCorrectOpt = practiceResult.correct === opt;
                                const isChosenWrong = isSelected && !practiceResult.is_correct;
                                if (isCorrectOpt) {
                                    optCls = isDark ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-200 ring-2 ring-emerald-500/30' : 'bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-300';
                                } else if (isChosenWrong) {
                                    optCls = isDark ? 'bg-rose-500/20 border-rose-500/50 text-rose-200' : 'bg-rose-50 border-rose-400 text-rose-800';
                                } else {
                                    optCls = isDark ? 'bg-slate-900/40 border-slate-700 text-slate-400 opacity-50' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-50';
                                }
                            } else if (isSelected) {
                                optCls = isDark ? 'bg-indigo-500/20 border-indigo-500/50 text-white ring-2 ring-indigo-500/30' : 'bg-indigo-50 border-indigo-400 text-indigo-800 ring-2 ring-indigo-300';
                            } else {
                                optCls = isDark ? 'bg-slate-900/40 border-slate-700 text-slate-200 hover:border-indigo-500/40 hover:bg-indigo-500/10' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50';
                            }

                            return (
                                <button
                                    key={opt}
                                    onClick={() => selectOption(opt)}
                                    disabled={isPractice && practiceRevealed}
                                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 text-right ${optCls}`}
                                >
                                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-[900] shrink-0 ${isSelected ? (isDark ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white') : (isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}>
                                        {optionLabels[opt]}
                                    </span>
                                    <span className="text-[13px] font-[700]">{currentQ[`option_${opt}`]}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Practice mode feedback */}
                    {isPractice && practiceRevealed && practiceResult && (
                        <div className={`mt-5 p-4 rounded-xl border ${practiceResult.is_correct ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200') : (isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200')}`}>
                            <p className={`text-[13px] font-[800] mb-1 ${practiceResult.is_correct ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {practiceResult.is_correct ? '✅ إجابة صحيحة!' : `❌ الإجابة الصحيحة: ${optionLabels[practiceResult.correct]}`}
                            </p>
                            {practiceResult.explanation && (
                                <p className={`text-[11px] font-bold leading-relaxed ${subtext}`}>💡 {practiceResult.explanation}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={goPrev}
                        disabled={currentIndex === 0}
                        className={`px-5 py-3 rounded-xl text-[12px] font-[800] border transition-all disabled:opacity-30 ${isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-slate-700 border-slate-200'}`}
                    >
                        {t.previous}
                    </button>

                    {/* Question dots */}
                    <div className="flex gap-1.5 overflow-x-auto hide-scrollbar px-2">
                        {questions.map((q, idx) => (
                            <button
                                key={q.id}
                                onClick={() => { setCurrentIndex(idx); if (isPractice) { setPracticeRevealed(false); setPracticeResult(null); } }}
                                className={`w-3 h-3 rounded-full shrink-0 transition-all ${idx === currentIndex ? 'bg-indigo-500 scale-125' : answers[q.id] ? (isDark ? 'bg-indigo-500/40' : 'bg-indigo-300') : (isDark ? 'bg-slate-600' : 'bg-slate-300')}`}
                            />
                        ))}
                    </div>

                    {currentIndex < total - 1 ? (
                        <button
                            onClick={goNext}
                            className="px-5 py-3 rounded-xl text-[12px] font-[800] bg-indigo-600 text-white shadow-md transition-all hover:bg-indigo-700"
                        >
                            {isPractice ? t.nextQuestion : t.next}
                        </button>
                    ) : !isPractice ? (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-6 py-3 rounded-xl text-[12px] font-[800] bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-60"
                        >
                            {submitting ? t.submitting : t.submit}
                        </button>
                    ) : (
                        <button
                            onClick={() => router.visit('/quiz')}
                            className="px-5 py-3 rounded-xl text-[12px] font-[800] bg-indigo-600 text-white shadow-md transition-all"
                        >
                            {t.backToQuiz}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

QuizSession.layout = page => (
    <MainLayout>
        {page}
    </MainLayout>
);
