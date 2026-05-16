import React, { useState, useEffect, useCallback } from 'react';
import { Head, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function QuizSession({ questions: questionsProp = [], course: courseProp, chapter: chapterProp, mode: modeProp = 'quiz', results: resultsProp = null }) {
    try {
        const questions = Array.isArray(questionsProp) ? questionsProp : [];
        const course = courseProp || { id: 0, name: 'Course' };
        const chapter = chapterProp || null;
        const mode = modeProp || 'quiz';
        const { isDark } = useTheme();
        const { lang } = useLanguage();

        const [currentIndex, setCurrentIndex] = useState(0);
        const [answers, setAnswers] = useState({});
        const [showResult, setShowResult] = useState(false);
        const [results, setResults] = useState(resultsProp);
        const [submitting, setSubmitting] = useState(false);
        const [startTime] = useState(Date.now());
        const [elapsed, setElapsed] = useState(0);
        const [practiceRevealed, setPracticeRevealed] = useState(false);
        const [practiceResult, setPracticeResult] = useState(null);

        const isPractice = mode === 'practice';
        const total = questions.length;
        const currentQ = questions[currentIndex] || {};

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
            if (showResult || !currentQ?.id) return;
            if (isPractice && practiceRevealed) return;
            setAnswers(prev => ({ ...prev, [currentQ.id]: option }));
            if (isPractice) {
                setPracticeRevealed(true);
                router.post(route('quiz.submit'), {
                    course_id: course.id,
                    chapter_id: chapter?.id || null,
                    mode: 'practice',
                    answers: { [currentQ.id]: option },
                    time_spent_seconds: null,
                }, {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: (page) => {
                        if (page.props.results?.results?.[currentQ.id]) {
                            setPracticeResult(page.props.results.results[currentQ.id]);
                        }
                    },
                    onError: (errors) => console.error(errors)
                });
            }
        }, [showResult, isPractice, practiceRevealed, currentQ, course, chapter]);

        const goNext = () => {
            if (isPractice) { setPracticeRevealed(false); setPracticeResult(null); }
            if (currentIndex < total - 1) setCurrentIndex(prev => prev + 1);
        };

        const goPrev = () => {
            if (isPractice) { setPracticeRevealed(false); setPracticeResult(null); }
            if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
        };

        const handleSubmit = async () => {
            const answeredCount = Object.keys(answers || {}).length;
            if (answeredCount < total) { if (!confirm(t.unanswered)) return; }
            setSubmitting(true);
            router.post(route('quiz.submit'), {
                course_id: course.id,
                chapter_id: chapter?.id || null,
                mode: 'quiz',
                answers,
                time_spent_seconds: elapsed,
            }, {
                onSuccess: (page) => {
                    if (page.props.results) { setResults(page.props.results); setShowResult(true); }
                },
                onFinish: () => setSubmitting(false)
            });
        };

        const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

        if (questions.length === 0) {
            return (
                <div className="min-h-screen flex items-center justify-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    <div className="text-center">
                        <div className="text-5xl mb-4">😕</div>
                        <p className={`text-lg font-bold text-slate-400`}>{t.noQuestions}</p>
                        <button onClick={() => router.visit('/quiz')} className="mt-6 px-6 py-3 bg-indigo-600 text-white rounded-xl font-[800] text-sm">{t.backToQuiz}</button>
                    </div>
                </div>
            );
        }

        if (showResult && results) {
            const m = Math.floor(elapsed / 60);
            const s = elapsed % 60;
            return (
                <div className="min-h-screen py-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                    <Head><title>{t.resultTitle}</title></Head>
                    <div className="max-w-3xl mx-auto px-4">
                        <div className={`rounded-[2.5rem] border p-8 sm:p-10 text-center shadow-xl mb-8 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <h2 className={`text-xl font-[900] mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.resultTitle}</h2>
                            <div className={`text-7xl sm:text-8xl font-[900] mb-3 text-indigo-500`}>{results.score_percentage}%</div>
                            <p className="text-sm font-bold text-slate-500">{results.correct} / {results.total}</p>
                            <div className="flex gap-3 justify-center mt-8">
                                <button onClick={() => router.visit('/quiz')} className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-[800] text-[12px]">{t.backToQuiz}</button>
                                <button onClick={() => { setShowResult(false); setResults(null); setAnswers({}); setCurrentIndex(0); }} className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-[800] text-[12px]">{t.tryAgain}</button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <Head><title>{course.name}</title></Head>
                <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className={`text-lg font-[900] ${isDark ? 'text-white' : 'text-slate-900'}`}>{course.name}</h2>
                        <div className="text-right">
                            <span className="text-xl font-[900] font-mono">{formatTime(elapsed)}</span>
                        </div>
                    </div>
                    <div className={`w-full h-2 rounded-full mb-8 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <div key={currentQ.id} className={`rounded-[2rem] border p-6 sm:p-8 shadow-sm mb-6 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <p className={`text-[15px] sm:text-[16px] font-[800] leading-relaxed mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentQ.question_text}</p>
                        <div className="space-y-3">
                            {['a', 'b', 'c', 'd'].map(opt => (
                                <button key={opt} onClick={() => selectOption(opt)} className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${answers[currentQ.id] === opt ? 'bg-indigo-50 border-indigo-400' : 'bg-white'}`}>
                                    <span className="font-bold uppercase mr-2">{opt}.</span>
                                    <span className="text-[13px] font-[700]">{currentQ[`option_${opt}`]}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <button onClick={goPrev} disabled={currentIndex === 0} className="px-5 py-3 bg-white border rounded-xl disabled:opacity-30">{t.previous}</button>
                        {currentIndex < total - 1 ? (
                            <button onClick={goNext} className="px-5 py-3 bg-indigo-600 text-white rounded-xl">{t.next}</button>
                        ) : (
                            <button onClick={handleSubmit} className="px-5 py-3 bg-indigo-600 text-white rounded-xl">{t.submit}</button>
                        )}
                    </div>
                </div>
            </div>
        );
    } catch (e) {
        console.error('QuizSession Error:', e);
        return <div className="p-10 text-center font-bold text-rose-500">Error: {e.message}</div>;
    }
}

QuizSession.layout = page => (
    <MainLayout>
        {page}
    </MainLayout>
);
