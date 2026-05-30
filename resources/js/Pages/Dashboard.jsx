import MainLayout from '@/Layouts/MainLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';

// Resolve the deployment URL once for page-level SEO metadata.
const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

/* ═══════════════════════════════════════════════════════════════
   HOOKS & COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

// Reveal dashboard sections progressively as they appear in view.
function useReveal(threshold = 0.12) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); }
        }, { threshold });
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);
    return [ref, visible];
}

// Animate KPI numbers instead of rendering them statically on first paint.
function AnimatedCounter({ target, duration = 1400, decimals = 0 }) {
    const [value, setValue] = useState(0);
    const [ref, isVisible] = useReveal(0.3);
    const num = typeof target === 'string' ? parseFloat(target) : target;
    useEffect(() => {
        if (!isVisible || isNaN(num) || num === 0) return;
        let current = 0;
        const step = num / (duration / 16);
        const timer = setInterval(() => {
            current += step;
            if (current >= num) { setValue(num); clearInterval(timer); }
            else { setValue(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.floor(current)); }
        }, 16);
        return () => clearInterval(timer);
    }, [isVisible, num, duration, decimals]);
    return <span ref={ref}>{decimals > 0 ? value.toFixed(decimals) : value}</span>;
}

export default function Dashboard({
    auth,
    passed_hours = 0,
    total_hours = 132,
    gpa = "0.00",
    has_academic_records = false,
    passed_courses = [],
    cart_courses = [],
    ai_skills = [],
    planner_courses = [],
    graduation_plan = null,
    pinned_chapters = [],
}) {

    // Compute high-level academic summaries once per data change.

    const progressPct = useMemo(() => Math.min(Math.round((passed_hours / total_hours) * 100), 100), [passed_hours, total_hours]);

    const academicYear = useMemo(() => {
        if (passed_hours < 33) return 'السنة الأولى (سنفور)';
        if (passed_hours < 66) return 'السنة الثانية';
        if (passed_hours < 99) return 'السنة الثالثة';
        return 'السنة الرابعة (خريج)';
    }, [passed_hours]);

    const currentAcademicYearNumber = useMemo(() => {
        if (passed_hours < 33) return 1;
        if (passed_hours < 66) return 2;
        if (passed_hours < 99) return 3;
        return 4;
    }, [passed_hours]);

    const standing = useMemo(() => {
        const n = parseFloat(gpa);
        if (passed_hours === 0 || !has_academic_records) return { label: 'لا توجد مواد منجزة بعد', cls: 'text-slate-500 bg-slate-50 border-slate-200', icon: '✅' };
        if (isNaN(n)) return { label: 'غير محدد بعد', cls: 'text-slate-500 bg-slate-50 border-slate-200', icon: '⏳' };
        if (n >= 90) return { label: 'امتياز مع مرتبة الشرف', cls: 'text-amber-700 bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200', icon: '🏆' };
        if (n >= 75) return { label: 'جيد جداً', cls: 'text-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200', icon: '✨' };
        if (n >= 62.5) return { label: 'جيد', cls: 'text-blue-700 bg-blue-50 border-blue-200', icon: '👍' };
        if (n >= 50) return { label: 'مقبول', cls: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: '🎯' };
        return { label: 'بحاجة لتحسين', cls: 'text-rose-700 bg-rose-50 border-rose-200', icon: '⚠️' };
    }, [gpa, has_academic_records, passed_hours]);

    const remaining = total_hours - passed_hours;
    const circumference = 2 * Math.PI * 38;

    const motivation = useMemo(() => {
        const n = parseFloat(gpa);
        if (passed_hours === 0 || !has_academic_records) return 'ابدأ رحلتك الأكاديمية، فالوضع طبيعي طالما لم تُنجز مواد بعد.';
        if (isNaN(n) || n === 0) return 'لم تتوفر بيانات كافية بعد.';
        if (n >= 90) return 'أداء استثنائي! حافظ على هذا المستوى المتميز 🌟';
        if (n >= 75) return 'مستوى ممتاز! بقيت خطوة واحدة للقمة 🚀';
        if (n >= 62.5) return 'في الطريق الصحيح! ركّز أكثر وستصل 💪';
        if (n >= 50) return 'لا تستسلم! كل فصل فرصة جديدة للتحسن 🎯';
        return 'استعن بالمرشد الذكي لوضع خطة تحسين فورية ⚡';
    }, [gpa, has_academic_records, passed_hours]);

    const [mounted, setMounted] = useState(false);
    const [printMode, setPrintMode] = useState(null); // 'transcript' or 'plan'
    const { academic_period: academicPeriod = null } = usePage().props || {};
    
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(t);
    }, []);

    const [metricsRef, metricsVis] = useReveal(0.08);
    const [aiRef, aiVis] = useReveal(0.15);
    const [smartRef, smartVis] = useReveal(0.1);
    const [recordRef, recordVis] = useReveal(0.10); 
    const [cartRef, cartVis] = useReveal(0.10);
    const [skillsRef, skillsVis] = useReveal(0.12);

    const heroRef = useRef(null);
    const [mx, setMx] = useState(0);
    const [my, setMy] = useState(0);

    const onHeroMouse = useCallback((e) => {
        if (!heroRef.current) return;
        const rect = heroRef.current.getBoundingClientRect();
        setMx((e.clientX - rect.left - rect.width / 2) / rect.width);
        setMy((e.clientY - rect.top - rect.height / 2) / rect.height);
    }, []);
    const onHeroLeave = useCallback(() => { setMx(0); setMy(0); }, []);
    const spring = 'cubic-bezier(0.16,1,0.3,1)';

    const legacyPlanSemesterToYearTerm = useCallback((semesterValue) => {
        const normalized = Math.min(12, Math.max(1, parseInt(semesterValue, 10) || 1));
        return {
            year: Math.ceil(normalized / 2),
            term: normalized % 2 === 0 ? 2 : 1,
        };
    }, []);

    const termLabel = useCallback((term) => {
        if (term === 1) return 'الأول';
        if (term === 2) return 'الثاني';
        return 'الصيفي';
    }, []);

    const academicPeriodLabel = academicPeriod?.display_label || [academicPeriod?.academic_year, academicPeriod?.academic_term].filter(Boolean).join(' ');

    const processedCourses = useMemo(() => {
        return passed_courses.map(c => {
            let year = parseInt(c?.pivot?.studied_year, 10);
            let term = parseInt(c?.pivot?.studied_term, 10);

            if (!(year >= 1 && year <= 6 && [1, 2, 3].includes(term))) {
                const fallback = legacyPlanSemesterToYearTerm(c?.pivot?.studied_semester || c?.semester || 1);
                year = fallback.year;
                term = fallback.term;
            }

            return {
                ...c,
                localYear: year,
                localTerm: term,
                recordKey: `${year}-${term}`,
            };
        });
    }, [passed_courses, legacyPlanSemesterToYearTerm]);

    const cumulativeStats = useMemo(() => {
        let totalCredits = 0;
        let weightedSum = 0;
        processedCourses.forEach(c => {
            const grade = parseFloat(c.pivot?.grade);
            if (!isNaN(grade) && grade > 0) {
                totalCredits += c.credit_hours;
                weightedSum += (grade * c.credit_hours);
            }
        });
        const percentage = totalCredits > 0 ? (weightedSum / totalCredits) : 0;
        return { percentage: percentage.toFixed(1), credits: totalCredits, count: processedCourses.length };
    }, [processedCourses]);

    const semesterStats = useMemo(() => {
        const stats = {};
        processedCourses.forEach(c => {
            const key = c.recordKey;
            if (!stats[key]) {
                stats[key] = {
                    year: c.localYear,
                    term: c.localTerm,
                    totalCredits: 0,
                    weightedSum: 0,
                    courseCount: 0,
                };
            }
            stats[key].courseCount++;
            const grade = parseFloat(c.pivot?.grade);
            if (!isNaN(grade) && grade > 0) {
                stats[key].totalCredits += c.credit_hours;
                stats[key].weightedSum += (grade * c.credit_hours);
            }
        });
        const finalStats = {};
        Object.keys(stats).forEach(key => {
            const data = stats[key];
            const percentage = data.totalCredits > 0 ? (data.weightedSum / data.totalCredits) : 0;
            const gpa4 = data.totalCredits > 0 ? (percentage / 25).toFixed(2) : '0.00';
            finalStats[key] = {
                ...data,
                percentage: percentage.toFixed(1),
                gpa4,
                credits: data.totalCredits,
                count: data.courseCount,
            };
        });
        return finalStats;
    }, [processedCourses]);

    const recordSemesters = useMemo(() => {
        return Object.keys(semesterStats).sort((a, b) => {
            const aItem = semesterStats[a];
            const bItem = semesterStats[b];
            if (aItem.year !== bItem.year) return aItem.year - bItem.year;
            return aItem.term - bItem.term;
        });
    }, [semesterStats]);

    const [recordActiveTab, setRecordActiveTab] = useState(recordSemesters.length > 0 ? recordSemesters[0] : 'all');

    const [localCartCourses, setLocalCartCourses] = useState(Array.isArray(cart_courses) ? cart_courses : []);
    const [smartPace, setSmartPace] = useState('balanced');
    const [smartFocus, setSmartFocus] = useState('major');
    const [smartProtectGpa, setSmartProtectGpa] = useState(true);
    const [smartPlan, setSmartPlan] = useState([]);
    const [smartHours, setSmartHours] = useState(0);
    const [isApplyingSmartPlan, setIsApplyingSmartPlan] = useState(false);

    useEffect(() => {
        setLocalCartCourses(Array.isArray(cart_courses) ? cart_courses : []);
    }, [cart_courses]);

    const recordDisplayedCourses = useMemo(() => {
        if (recordActiveTab === 'all') return processedCourses;
        return processedCourses.filter(c => c.recordKey === recordActiveTab);
    }, [processedCourses, recordActiveTab]);

    const getBadgeColor = (grade) => {
        const val = parseFloat(grade);
        if (isNaN(val)) return 'bg-slate-100 text-slate-500 border-slate-200';
        if (val >= 84) return 'bg-emerald-100 text-emerald-700 border-emerald-200'; 
        if (val >= 76) return 'bg-blue-100 text-blue-700 border-blue-200'; 
        if (val >= 68) return 'bg-indigo-100 text-indigo-700 border-indigo-200'; 
        if (val >= 60) return 'bg-amber-100 text-amber-700 border-amber-200'; 
        return 'bg-rose-100 text-rose-700 border-rose-200'; 
    };

    const plannerCourses = useMemo(() => {
        if (!Array.isArray(planner_courses)) return [];

        return planner_courses.map((course) => {
            const semester = Number(course.semester || 1);
            const recommendedYear = Math.min(4, Math.max(1, Math.ceil(semester / 2)));
            const avgGrade = Number(course.avg_grade ?? 72);
            const failRate = Number(course.fail_rate ?? 18);
            const prerequisitesCount = Number(course.prerequisites_count || 0);
            const baseDifficulty =
                ((100 - avgGrade) * 0.5)
                + (failRate * 0.35)
                + Math.min(prerequisitesCount * 7, 25)
                + ((recommendedYear - 1) * 6);

            return {
                ...course,
                credit_hours: Number(course.credit_hours || 0),
                semester,
                recommended_year: recommendedYear,
                avg_grade: Number(avgGrade.toFixed(1)),
                fail_rate: Number(failRate.toFixed(1)),
                graded_attempts: Number(course.graded_attempts || 0),
                prerequisites_count: prerequisitesCount,
                prerequisites: Array.isArray(course.prerequisites) ? course.prerequisites : [],
                difficulty_score: Math.max(0, Math.min(100, Number(baseDifficulty.toFixed(1)))),
            };
        });
    }, [planner_courses]);

    const passedCourseIds = useMemo(() => new Set(processedCourses.map((course) => course.id)), [processedCourses]);
    const cartTotalHours = useMemo(() => {
        return localCartCourses.reduce((sum, course) => sum + Number(course.credit_hours || 0), 0);
    }, [localCartCourses]);

    const smartPlanInsights = useMemo(() => {
        if (!smartPlan.length) return null;

        const majorCount = smartPlan.filter((course) => course.major_id !== null).length;
        const universityCount = smartPlan.length - majorCount;
        const heavyCount = smartPlan.filter((course) => Number(course.difficulty_score || 0) >= 65).length;
        const avgDifficulty = smartPlan.reduce((sum, course) => sum + Number(course.difficulty_score || 0), 0) / smartPlan.length;

        return {
            majorCount,
            universityCount,
            heavyCount,
            avgDifficulty: Number(avgDifficulty.toFixed(1)),
        };
    }, [smartPlan]);

    const generateSmartPlan = useCallback(() => {
        if (!plannerCourses.length) {
            setSmartPlan([]);
            setSmartHours(0);
            return;
        }

        const childrenMap = new Map();

        plannerCourses.forEach((course) => {
            course.prerequisites.forEach((prereq) => {
                const list = childrenMap.get(prereq.id) || [];
                list.push(course.id);
                childrenMap.set(prereq.id, list);
            });
        });

        const unlockCache = new Map();
        const unlockScore = (courseId, visited = new Set()) => {
            if (unlockCache.has(courseId)) return unlockCache.get(courseId);
            if (visited.has(courseId)) return 0;

            const nextVisited = new Set(visited);
            nextVisited.add(courseId);

            const children = childrenMap.get(courseId) || [];
            const score = children.reduce((sum, childId) => sum + 1 + unlockScore(childId, nextVisited), 0);

            unlockCache.set(courseId, score);
            return score;
        };

        const available = plannerCourses.filter((course) => {
            if (passedCourseIds.has(course.id)) return false;
            if (!course.prerequisites.length) return true;

            return course.prerequisites.every((prereq) => passedCourseIds.has(prereq.id));
        });

        const paceConfig = {
            light: { targetHours: 12, targetDifficulty: 32, maxDifficulty: 52, maxHeavyCourses: 2, yearBias: -1 },
            balanced: { targetHours: 15, targetDifficulty: 52, maxDifficulty: 74, maxHeavyCourses: 3, yearBias: 0 },
            heavy: { targetHours: 18, targetDifficulty: 72, maxDifficulty: 100, maxHeavyCourses: 4, yearBias: 1 },
        };

        const pace = paceConfig[smartPace] || paceConfig.balanced;

        const targetHours = pace.targetHours;

        const scored = available
            .map((course) => {
                const unlock = unlockScore(course.id);
                const isMajor = course.major_id !== null;
                const isCompulsory = course.type === 'compulsory';
                const difficulty = Number(course.difficulty_score || 0);
                const isHeavy = difficulty >= 65 || Number(course.fail_rate || 0) >= 30;
                const yearGap = Number(course.recommended_year || 1) - currentAcademicYearNumber;
                const difficultyFit = Math.max(0, 100 - Math.abs(difficulty - pace.targetDifficulty) * 1.7);
                const dataConfidence = Math.min(100, 42 + (Number(course.graded_attempts || 0) * 7));

                let yearFit = 0;
                if (pace.yearBias === -1) {
                    yearFit = yearGap <= 0 ? 18 : Math.max(-28, -9 * yearGap);
                } else if (pace.yearBias === 0) {
                    yearFit = Math.max(-22, 18 - Math.abs(yearGap) * 10);
                } else {
                    yearFit = yearGap >= 0 ? 14 : Math.max(-24, yearGap * 12);
                }

                let score = unlock * 5 + difficultyFit + yearFit + (difficulty <= pace.maxDifficulty ? 12 : -42);

                if (smartFocus === 'major') {
                    score += isMajor ? 10 : -5;
                } else if (smartFocus === 'graduation') {
                    score += (unlock * 4) + (isCompulsory ? 5 : 0) + (yearGap <= 1 ? 6 : -6);
                } else if (smartFocus === 'gpa') {
                    score += Number(course.avg_grade || 0) >= 75 ? 9 : -9;
                    score += Number(course.fail_rate || 0) <= 20 ? 7 : -11;
                    score += difficulty < 55 ? 5 : -8;
                }

                if (smartProtectGpa) {
                    score += Number(course.fail_rate || 0) > 35 ? -18 : 4;
                }

                return { course, score, isHeavy, unlock, yearGap, difficultyFit, dataConfidence };
            })
            .sort((a, b) => b.score - a.score);

        const selected = [];
        let selectedHours = 0;
        let heavyCount = 0;

        scored.forEach((entry) => {
            const { course, isHeavy, unlock, yearGap, difficultyFit, dataConfidence } = entry;
            const difficulty = Number(course.difficulty_score || 0);

            if (selectedHours + course.credit_hours > targetHours) return;
            if (smartPace === 'light' && difficulty > 58) return;
            if (smartPace === 'balanced' && difficulty > 85) return;
            if (smartProtectGpa && isHeavy && heavyCount >= pace.maxHeavyCourses) return;

            const confidence = Math.max(
                0,
                Math.min(
                    100,
                    Number((
                        (difficultyFit * 0.34)
                        + ((100 - Math.min(Math.abs(yearGap) * 22, 100)) * 0.26)
                        + (Math.min(unlock * 18, 100) * 0.24)
                        + (dataConfidence * 0.16)
                    ).toFixed(1)),
                ),
            );

            const recommendationReasons = [
                `يفتح ${unlock} مواد لاحقة`,
                `صعوبة ${Math.round(difficulty)}%`,
                `سنة المادة ${course.recommended_year}`,
                Number(course.fail_rate || 0) <= 20 ? 'نسبة رسوب منخفضة' : 'نسبة رسوب مرتفعة نسبيًا',
            ];

            const enrichedCourse = {
                ...course,
                recommendation_confidence: confidence,
                recommendation_reasons: recommendationReasons,
                data_confidence: dataConfidence,
            };

            selected.push(enrichedCourse);
            selectedHours += course.credit_hours;

            if (isHeavy) {
                heavyCount += 1;
            }
        });

        setSmartPlan(selected);
        setSmartHours(selectedHours);
    }, [plannerCourses, passedCourseIds, smartPace, smartFocus, smartProtectGpa, currentAcademicYearNumber]);

    const applySmartPlan = useCallback(() => {
        const smartIds = smartPlan.map((course) => course.id);

        setIsApplyingSmartPlan(true);
        setLocalCartCourses(smartPlan);

        router.post(route('cart.sync'), {
            course_ids: smartIds,
        }, {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => setIsApplyingSmartPlan(false),
        });
    }, [smartPlan]);

    // Guard against malformed payloads so dashboard rendering never crashes.
    const safeSkills = Array.isArray(ai_skills) ? ai_skills : [];

    return (
        <MainLayout user={auth.user}>
            <Head>
                <title>لوحة الطالب | سنفور</title>
                <meta name="description" content="لوحة الطالب في سنفور لمتابعة الساعات المنجزة، المعدل، والمواد المسجلة ضمن حسابك الشخصي." />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/dashboard`} />
            </Head>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sn-up { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes sn-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
                @keyframes sn-shimmer { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
                @keyframes sn-glow { 0%, 100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.28; transform: scale(1.06); } }
                @keyframes sn-rotate-border { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes sn-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
                @keyframes sn-ring-pulse { 0% { transform: scale(1); opacity: 0.35; } 100% { transform: scale(1.6); opacity: 0; } }
                @keyframes sn-gradient-drift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @media print {
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    nav, header, footer, .no-print { display: none !important; }
                    .max-w-7xl { max-width: 100% !important; padding: 0 !important; }
                    .shadow-sm, .shadow-2xl { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
                    * { animation: none !important; transition: none !important; transform: none !important; opacity: 1 !important; color-adjust: exact !important; }
                    .bg-white { border: 1px solid #e2e8f0 !important; }
                }
            ` }} />

            <div className="py-6 sm:py-8 min-h-screen selection:bg-blue-100 selection:text-blue-900" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7 print:hidden">

                    {/* 1. STUDENT ID — HERO CARD */}
                    <div
                        ref={heroRef}
                        onMouseMove={onHeroMouse}
                        onMouseLeave={onHeroLeave}
                        className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-2xl border border-white/[0.06]"
                        style={{
                            background: 'linear-gradient(to bottom left, #0f172a, #0f172a, #1e1b4b)',
                            opacity: mounted ? 1 : 0,
                            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.985)',
                            transition: `all 1000ms ${spring}`,
                        }}
                    >
                         <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="absolute top-0 right-0 w-[70%] h-full bg-gradient-to-l from-blue-600/25 via-blue-600/8 to-transparent" />
                            <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * -22}px, ${my * -22}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * 18}px, ${my * 18}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }} />
                            <div className="absolute top-0 left-0 w-full h-[1px] overflow-hidden"><div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'sn-shimmer 4.5s ease-in-out infinite' }} /></div>
                        </div>

                        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                            <button onClick={() => { setPrintMode('transcript'); setTimeout(() => window.print(), 100); }} className="no-print absolute top-6 left-6 sm:top-8 sm:left-8 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2.5 rounded-xl text-[12px] font-bold flex items-center gap-2 transition-all backdrop-blur-md shadow-sm active:scale-95">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                طباعة السجل
                            </button>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-2 rounded-[1.4rem] opacity-0 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', filter: 'blur(18px)', animation: 'sn-glow 3s ease-in-out infinite', transition: 'opacity 700ms ease' }} />
                                    <div className="relative w-[78px] h-[78px] sm:w-[90px] sm:h-[90px] rounded-[1.3rem] p-[3px] overflow-hidden">
                                        <div className="absolute inset-0" style={{ background: 'conic-gradient(from 0deg, #3b82f6, #06b6d4, #60a5fa, #3b82f6)', animation: 'sn-rotate-border 5s linear infinite' }} />
                                        <div className="relative w-full h-full bg-[#0f172a] rounded-[calc(1.3rem-3px)] flex items-center justify-center text-2xl sm:text-3xl font-[900] z-10 select-none overflow-hidden">
                                            {auth.user?.avatar ? (
                                                <img src={auth.user.avatar} alt={auth.user.name} className="w-full h-full object-cover" />
                                            ) : (
                                                auth.user?.name?.charAt(0) || 'S'
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1 min-w-0 text-center sm:text-right">
                                    <div>
                                        <h1 className="text-[1.55rem] sm:text-[1.9rem] font-[900] tracking-tight truncate leading-tight">{auth.user?.name || 'طالب مجهول'}</h1>
                                        <p className="text-blue-300/50 text-sm mt-1 truncate">{auth.user?.email || 'لا يوجد بريد إلكتروني'}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        {[{ text: auth.user?.major?.name || 'تخصص غير محدد', icon: '🎓', d: 200 }, { text: academicYear, icon: '📅', d: 320 }, ...(academicPeriodLabel ? [{ text: academicPeriodLabel, icon: '🗓️', d: 440 }] : [])].map((badge, i) => (
                                            <span key={i} className="bg-white/[0.07] backdrop-blur-md border border-white/[0.1] px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 hover:bg-white/[0.13] transition-colors cursor-default" style={{ animation: mounted ? `sn-pop 0.55s ${spring} ${badge.d}ms both` : 'none' }}>
                                                {badge.icon} {badge.text}
                                            </span>
                                        ))}
                                        <span className={`px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 border cursor-default ${standing.cls}`} style={{ animation: mounted ? `sn-pop 0.55s ${spring} 440ms both` : 'none' }}>
                                            {standing.icon} {standing.label}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-blue-200/35 mt-1 hidden sm:block" style={{ animation: mounted ? `sn-up 0.65s ${spring} 550ms both` : 'none' }}>
                                        💡 {motivation}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. METRICS GRID */}
                    <div ref={metricsRef} className="grid grid-cols-1 md:grid-cols-3 gap-5">
                         <div className="bg-white p-6 rounded-[1.6rem] border border-slate-100 relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500 shadow-sm" style={{ opacity: metricsVis ? 1 : 0, transform: metricsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: '0ms' }}>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-50 to-transparent rounded-bl-[3rem] -z-0 transition-transform group-hover:scale-[3] duration-[800ms] ease-out" />
                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">الساعات المنجزة</p>
                                    <h3 className="text-[2.15rem] font-[900] text-slate-800 leading-none"><AnimatedCounter target={passed_hours} /><span className="text-sm font-bold text-slate-300 mr-1">/ {total_hours}</span></h3>
                                    <div className="mt-3 w-full bg-slate-100 h-[5px] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-l from-emerald-400 to-emerald-500 rounded-full" style={{ width: metricsVis ? `${progressPct}%` : '0%', transition: `width 2000ms ${spring} 350ms` }} /></div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl border border-emerald-100 shrink-0">⏳</div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[1.6rem] border border-slate-100 relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500 shadow-sm" style={{ opacity: metricsVis ? 1 : 0, transform: metricsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: '130ms' }}>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-sky-50 to-transparent rounded-bl-[3rem] -z-0 transition-transform group-hover:scale-[3] duration-[800ms] ease-out" />
                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">المعدل المئوي (%)</p>
                                    <h3 className="text-[2.15rem] font-[900] text-slate-800 leading-none"><AnimatedCounter target={gpa} decimals={2} duration={1800} /><span className="text-sm font-bold text-slate-300 mr-1">%</span></h3>
                                    <div className="mt-3 w-full bg-slate-100 h-[5px] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-l from-sky-400 to-blue-500 rounded-full" style={{ width: metricsVis ? `${Math.min(parseFloat(gpa) || 0, 100)}%` : '0%', transition: `width 2000ms ${spring} 450ms` }} /></div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-sky-50 text-blue-500 flex items-center justify-center text-xl border border-sky-100 shrink-0">🎯</div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-[1.6rem] border border-slate-100 flex items-center gap-5 relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500 shadow-sm" style={{ opacity: metricsVis ? 1 : 0, transform: metricsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: '260ms' }}>
                            <div className="relative shrink-0 z-10">
                                <svg className="w-[86px] h-[86px] transform -rotate-90" viewBox="0 0 86 86">
                                    <circle cx="43" cy="43" r="38" stroke="#f1f5f9" strokeWidth="7" fill="transparent" />
                                    <circle cx="43" cy="43" r="38" stroke="url(#progressGrad)" strokeWidth="7" fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={metricsVis ? circumference - (circumference * progressPct) / 100 : circumference} style={{ transition: `stroke-dashoffset 2200ms ${spring} 500ms` }} />
                                    <defs>
                                        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#3b82f6" /><stop offset="50%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col"><span className="text-[1.15rem] font-[900] text-slate-800 leading-none">{progressPct}%</span><span className="text-[8px] font-bold text-slate-400 mt-0.5">مكتمل</span></div>
                            </div>
                            <div className="relative z-10 flex-1 min-w-0">
                                <h4 className="text-[1rem] font-[800] text-slate-800 mb-1">رحلة التخرج 🎓</h4>
                                <p className="text-[12px] text-slate-500 leading-relaxed">{remaining > 0 ? <>بقيت <span className="text-blue-600 font-bold">{remaining} ساعة</span> لترتدي روب التخرج!</> : <span className="text-emerald-600 font-bold">مبروك! أنت جاهز للتخرج 🎉</span>}</p>
                            </div>
                        </div>
                    </div>

                    {/* 3. AI INSIGHT BANNER */}
                    <div ref={aiRef} className="relative overflow-hidden rounded-[1.4rem] shadow-sm" style={{ opacity: aiVis ? 1 : 0, transform: aiVis ? 'translateY(0)' : 'translateY(14px)', transition: `all 700ms ${spring} 80ms` }}>
                        <div className="absolute inset-0 rounded-[1.4rem] p-[1.5px]" style={{ background: 'linear-gradient(135deg, #bae6fd, #a5f3fc, #bae6fd, #a5f3fc)', backgroundSize: '300% 300%', animation: 'sn-gradient-drift 6s ease infinite' }}>
                            <div className="w-full h-full rounded-[calc(1.4rem-1.5px)] bg-gradient-to-l from-sky-50/95 to-cyan-50/70 backdrop-blur-sm" />
                        </div>
                        <div className="relative z-10 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 bg-gradient-to-tr from-sky-400 to-blue-500 text-white rounded-xl flex items-center justify-center text-[1.4rem] shadow-lg shadow-blue-300/40" style={{ animation: 'sn-float 3.5s ease-in-out infinite' }}>🤖</div>
                                    <div className="absolute -inset-1 rounded-xl border-2 border-blue-400/30" style={{ animation: 'sn-ring-pulse 2.5s ease-out infinite' }} />
                                </div>
                                <div>
                                    <h4 className="text-[14px] font-[800] text-blue-900 mb-0.5">نصيحة المرشد الذكي</h4>
                                    <p className="text-[12px] text-blue-700/55 leading-relaxed max-w-lg">المرشد الذكي الآن قادر على قراءة تسجيلك التجريبي وإضافة جداول كاملة لك بضغطة زر. تحدث معه الآن!</p>
                                </div>
                            </div>
                            <Link href={route('ai.advisor')} className="bg-white text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300 shadow-sm active:scale-[0.96] whitespace-nowrap shrink-0 flex items-center gap-2">
                                تحدث مع المرشد <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                        </div>
                    </div>



                    {/* Graduation Plan Section */}
                    {graduation_plan && graduation_plan.semesters && graduation_plan.semesters.length > 0 && (
                        <div className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-sm mb-7">
                            <div className="bg-sky-50/50 border-b border-sky-100/50 p-6 sm:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <span className="text-2xl">🎓</span> خطة التخرج المعتمدة
                                    </h3>
                                    <p className="text-xs font-bold text-slate-500 mt-1">خطتك المنظمة للفصول القادمة حتى التخرج</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => {
                                            if (window.confirm('هل أنت متأكد من رغبتك في حذف الخطة المعتمدة؟ يمكنك إعادة بنائها من الشجرة لاحقاً.')) {
                                                router.delete(route('graduation-plan.destroy'), { preserveScroll: true });
                                            }
                                        }}
                                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2 border border-rose-100"
                                    >
                                        🗑️ حذف
                                    </button>
                                    <button 
                                        onClick={() => { setPrintMode('plan'); setTimeout(() => window.print(), 100); }} 
                                        className="bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/30 active:scale-95 flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                        طباعة الخطة
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 sm:px-8 py-8 overflow-x-auto hide-scrollbar">
                                <div className="flex items-stretch gap-4 min-w-max pb-4">
                                    {graduation_plan.semesters.map((sem, idx) => {
                                        const totalCredits = (sem.courses || []).reduce((sum, c) => sum + (c?.credit_hours || 0), 0);
                                        return (
                                            <div key={idx} className="w-[300px] shrink-0 bg-slate-50 border border-slate-100 rounded-[1.5rem] p-5 flex flex-col">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="font-[900] text-slate-800 text-[14px]">
                                                        {sem.is_summer ? 'الفصل الصيفي' : `الفصل ${sem.semester}`}
                                                    </h4>
                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${sem.is_summer ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {totalCredits} ساعة
                                                    </span>
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    {(sem.courses || []).map((c, cIdx) => (
                                                        <div key={cIdx} className="bg-white border border-slate-100 rounded-xl p-3 flex justify-between items-center shadow-sm">
                                                            <div>
                                                                <div className="font-bold text-slate-700 text-[12px] line-clamp-1" title={c?.name}>{c?.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">{c?.code}</div>
                                                            </div>
                                                            <div className="bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 shrink-0">
                                                                {c?.credit_hours} س
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {(!sem.courses || sem.courses.length === 0) && (
                                                        <div className="text-center py-6 text-[11px] text-slate-400 font-bold">لا يوجد مواد</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {graduation_plan.notes && (
                                    <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-[1.25rem] text-sm text-amber-800 font-bold">
                                        💡 ملاحظاتك: {graduation_plan.notes}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
                        
                        {/* 6. السجل الأكاديمي (الجانب الأيمن) */}
                        <div className="lg:col-span-8 space-y-7">
                            {processedCourses.length > 0 ? (
                                <div ref={recordRef} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden" style={{ opacity: recordVis ? 1 : 0, transform: recordVis ? 'translateY(0)' : 'translateY(20px)', transition: `all 800ms ${spring} 100ms` }}>
                                    <div className="bg-slate-50/80 border-b border-slate-100 p-6 sm:px-8">
                                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                                    <span className="text-2xl">📋</span> السجل الأكاديمي
                                                </h3>
                                                <p className="text-xs font-bold text-slate-400 mt-1">اضغط على أي فصل لرؤية مواده وإحصائياته المباشرة</p>
                                            </div>
                                            <Link href={route('calculator.index')} className="text-[11px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors shrink-0 text-center border border-indigo-100">
                                                إدارة السجل ⚙️
                                            </Link>
                                        </div>

                                        <div className="flex items-stretch gap-3 overflow-x-auto hide-scrollbar pb-4 pt-1">
                                            <button onClick={() => setRecordActiveTab('all')} className={`group relative shrink-0 text-right transition-all duration-300 ${recordActiveTab === 'all' ? 'transform scale-[1.02]' : 'hover:-translate-y-1'}`}>
                                                <div className={`p-4 rounded-2xl border-2 transition-all duration-300 w-48 h-full flex flex-col justify-between ${recordActiveTab === 'all' ? 'bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/20' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'}`}>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <span className={`text-sm font-black ${recordActiveTab === 'all' ? 'text-white' : 'text-slate-700'}`}>🌐 التراكمي العام</span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${recordActiveTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{processedCourses.length} مواد</span>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className={`text-2xl font-[900] ${recordActiveTab === 'all' ? 'text-white' : 'text-slate-800'}`}>{cumulativeStats?.percentage || '0.0'}</span>
                                                            <span className={`text-xs font-bold ${recordActiveTab === 'all' ? 'text-indigo-300' : 'text-slate-400'}`}>%</span>
                                                        </div>
                                                        <span className={`text-[10px] font-bold mb-1 ${recordActiveTab === 'all' ? 'text-slate-400' : 'text-slate-400'}`}>{cumulativeStats?.credits || 0} ساعة</span>
                                                    </div>
                                                </div>
                                            </button>

                                            {recordSemesters.map(recordKey => {
                                                const stats = semesterStats[recordKey];
                                                const isActive = recordActiveTab === recordKey;
                                                return (
                                                    <button key={recordKey} onClick={() => setRecordActiveTab(recordKey)} className={`group relative shrink-0 text-right transition-all duration-300 ${isActive ? 'transform scale-[1.02]' : 'hover:-translate-y-1'}`}>
                                                        <div className={`p-4 rounded-2xl border-2 transition-all duration-300 w-44 h-full flex flex-col justify-between ${isActive ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
                                                            <div className="flex justify-between items-start mb-3">
                                                                <span className={`text-sm font-black ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>السنة {stats.year} - {termLabel(stats.term)}</span>
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-500'}`}>{stats.count} مواد</span>
                                                            </div>
                                                            <div className="flex justify-between items-end">
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className={`text-2xl font-[900] ${isActive ? 'text-indigo-700' : 'text-slate-800'}`}>{stats.percentage > 0 ? stats.percentage : '--'}</span>
                                                                    <span className={`text-xs font-bold ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>%</span>
                                                                </div>
                                                                <span className={`text-[10px] font-bold mb-1 ${isActive ? 'text-indigo-600/70' : 'text-slate-400'}`}>{stats.credits} ساعة</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="p-6 sm:p-8 bg-white min-h-[250px]">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {recordDisplayedCourses.map((course, idx) => (
                                                <div key={`${recordActiveTab}-${course.id}`} className="group flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-300" style={{ animation: `sn-up 0.4s ${spring} ${idx * 40}ms both` }}>
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-500 group-hover:bg-white group-hover:text-indigo-600 transition-colors">{course.credit_hours}س</div>
                                                        <div>
                                                            <h4 className="text-sm font-black text-slate-800 group-hover:text-indigo-900 transition-colors line-clamp-1">{course.name}</h4>
                                                            <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{course.code}</p>
                                                            <p className="text-[10px] font-bold text-indigo-500 mt-0.5">سنة {course.localYear} - {termLabel(course.localTerm)}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`px-3 py-1.5 rounded-lg text-[11px] font-black border shadow-sm ${getBadgeColor(course.pivot?.grade)}`}>
                                                        {course.pivot?.grade ? `${course.pivot.grade}%` : 'منجزة'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2rem] border border-slate-100 p-10 flex flex-col items-center justify-center text-center shadow-sm h-full min-h-[300px]">
                                    <span className="text-5xl mb-4 opacity-50">📂</span>
                                    <h3 className="text-lg font-black text-slate-700 mb-2">سجلك الأكاديمي فارغ</h3>
                                    <p className="text-slate-400 text-sm mb-6 max-w-sm">قم بإضافة المواد التي أنجزتها من خلال الخطة الشجرية ليتم تفعيل حساب المعدل وإحصائيات التخرج.</p>
                                    <Link href={route('tree.index')} className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-2.5 rounded-xl font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200/50">الذهاب للشجرة 🌳</Link>
                                </div>
                            )}
                        </div>

                        {/* 7. التسجيل التجريبي المصغر (الجانب الأيسر) */}
                        <div className="lg:col-span-4 space-y-7">
                            {/* Pinned Chapters */}
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                <div className="bg-indigo-50/30 border-b border-indigo-100/40 p-4 flex items-center justify-between">
                                    <h4 className="text-sm font-[900] text-indigo-900 flex items-center gap-2">📌 الشباتر المفضلة</h4>
                                    <div className="flex items-center gap-3">
                                        <Link href={route('public.announcements')} className="text-lg hover:scale-110 transition-transform cursor-pointer" title="الإعلانات">📢</Link>
                                        <p className="text-xs text-slate-500 font-bold hidden sm:block">الوصول السريع</p>
                                    </div>
                                </div>
                                <div className="p-4 space-y-2">
                                    {Array.isArray(pinned_chapters) && pinned_chapters.length > 0 ? pinned_chapters.map((ch) => (
                                        <div key={ch.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all">
                                            <div className="min-w-0">
                                                <div className="font-[800] text-sm text-slate-800 truncate" title={ch.title}>{ch.title}</div>
                                                <div className="text-[11px] text-slate-400 font-bold mt-0.5">{ch.course_name}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {ch.google_drive_link && (
                                                    <a href={ch.google_drive_link} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-white border border-slate-100 text-blue-600 text-sm font-[800]">📥</a>
                                                )}
                                                <button onClick={() => router.get(route('quiz.start'), { course_id: ch.course_id, chapter_ids: [ch.id], mode: 'practice', count: 10 })} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-400 to-blue-500 text-white text-sm font-[800] hover:from-sky-500 hover:to-blue-600 transition-all shadow-sm shadow-blue-500/30">🧠 تدريب</button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="p-4 text-sm text-slate-400">لم تضف أي شباتر بعد. اضغط على 📍 في صفحة الشباتر لإضافتها.</div>
                                    )}
                                </div>
                            </div>
                            <div ref={cartRef} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]" style={{ opacity: cartVis ? 1 : 0, transform: cartVis ? 'translateY(0)' : 'translateY(20px)', transition: `all 800ms ${spring} 200ms` }}>
                                <div className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 border-b border-amber-100/50 p-5 shrink-0">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                                <span className="text-xl">🛒</span> خطة الفصل القادم
                                            </h3>
                                            <p className="text-[10px] font-bold text-slate-500 mt-1">مواد التسجيل التجريبي الخاصة بك</p>
                                        </div>
                                        <div className="bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-sm text-center">
                                            <span className="block text-[10px] font-black text-amber-500 uppercase">إجمالي الساعات</span>
                                            <span className={`text-lg font-[900] ${cartTotalHours > 18 ? 'text-rose-600' : 'text-amber-600'}`}>{cartTotalHours}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 hide-scrollbar">
                                    {localCartCourses.length > 0 ? localCartCourses.map((course, idx) => (
                                        <div key={course.id} className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm group hover:border-amber-200 transition-colors">
                                            <div className="min-w-0 pr-2">
                                                <h4 className="text-[12px] font-[900] text-slate-800 truncate">{course.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-100 px-1.5 rounded">{course.code}</span>
                                                    <span className="text-[9px] font-black text-amber-600">{course.credit_hours} ساعات</span>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                            <span className="text-3xl mb-2">📭</span>
                                            <p className="text-xs font-bold text-slate-500">التسجيل التجريبي فارغ</p>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                                    <Link href={route('tree.index')} className="block w-full bg-slate-900 hover:bg-slate-800 text-white text-center py-3 rounded-xl text-xs font-black transition-colors shadow-md">
                                        تعديل من الشجرة 🌳
                                    </Link>
                                </div>
                            </div>

                            <Link href={route('tree.index')} className="group block">
                                <div className="bg-gradient-to-r from-sky-400 to-blue-500 rounded-[1.5rem] p-5 shadow-lg shadow-blue-500/30 flex items-center justify-between transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl backdrop-blur-md">🗺️</div>
                                        <div>
                                            <h4 className="text-white font-black text-sm">استكشاف الخريطة الشجرية</h4>
                                            <p className="text-blue-100 text-[10px] font-bold mt-0.5">اكتشف المسار الحرج والمتطلبات</p>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-white transform rtl:rotate-180 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* 🖨️ PRINTABLE TRANSCRIPT */}
                <div className={`hidden ${printMode === 'transcript' ? 'print:block' : ''} w-full max-w-[21cm] mx-auto text-black bg-white`} dir="rtl">
                    <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
                        <h1 className="text-3xl font-black text-slate-900 mb-2">السجل الأكاديمي</h1>
                        <h2 className="text-sm font-bold text-slate-600">{auth.user?.major?.name || 'تخصص غير محدد'}</h2>
                    </div>

                    <div className="flex justify-between items-end border border-slate-300 rounded-xl p-5 mb-8">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 mb-1 uppercase">اسم الطالب</p>
                            <p className="text-lg font-black text-slate-900">{auth.user?.name || 'غير معروف'}</p>
                            <p className="text-xs font-bold text-slate-600 mt-0.5">{auth.user?.email}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-bold text-slate-500 mb-1 uppercase">الساعات المنجزة</p>
                            <p className="text-xl font-black text-slate-900">{passed_hours} <span className="text-sm font-bold text-slate-500">من {total_hours}</span></p>
                        </div>
                        <div className="text-left">
                            <p className="text-[11px] font-bold text-slate-500 mb-1 uppercase">المعدل التراكمي (%)</p>
                            <p className="text-xl font-black text-slate-900">{cumulativeStats?.percentage || '0.0'}%</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">{standing.label}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {recordSemesters.map((recordKey) => {
                            const stats = semesterStats[recordKey];
                            const semCourses = processedCourses.filter(c => c.recordKey === recordKey);
                            
                            return (
                                <div key={recordKey} className="break-inside-avoid">
                                    <div className="bg-slate-100 px-4 py-2 flex justify-between items-center border border-slate-300 border-b-0 rounded-t-xl">
                                        <h3 className="font-black text-sm text-slate-800">السنة {stats.year} - الفصل {termLabel(stats.term)}</h3>
                                        <span className="text-xs font-bold text-slate-600">
                                            المعدل الفصلي: {stats.percentage > 0 ? `${stats.percentage}%` : '--'} | {stats.credits} ساعات
                                        </span>
                                    </div>
                                    <table className="w-full border-collapse border border-slate-300 text-sm">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="border border-slate-300 px-3 py-2 text-right font-black text-slate-700 w-24">الرمز</th>
                                                <th className="border border-slate-300 px-3 py-2 text-right font-black text-slate-700">المادة</th>
                                                <th className="border border-slate-300 px-3 py-2 text-center font-black text-slate-700 w-20">الساعات</th>
                                                <th className="border border-slate-300 px-3 py-2 text-center font-black text-slate-700 w-20">العلامة</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {semCourses.map(c => (
                                                <tr key={c.id}>
                                                    <td className="border border-slate-300 px-3 py-1.5 text-right font-mono text-xs">{c.code}</td>
                                                    <td className="border border-slate-300 px-3 py-1.5 text-right font-bold text-slate-800">{c.name}</td>
                                                    <td className="border border-slate-300 px-3 py-1.5 text-center">{c.credit_hours}</td>
                                                    <td className="border border-slate-300 px-3 py-1.5 text-center font-black">{c.pivot?.grade || 'منجزة'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 text-center text-[10px] text-slate-400 font-bold border-t border-slate-200 pt-4">
                        تم استخراج هذه الوثيقة من نظام سنفور الأكاديمي - السجل غير رسمي ومخصص للمتابعة الذاتية فقط.
                    </div>
                </div>

                {/* 🖨️ PRINTABLE GRADUATION PLAN */}
                {graduation_plan && (
                    <div className={`hidden ${printMode === 'plan' ? 'print:block' : ''} w-full max-w-[21cm] mx-auto text-black bg-white`} dir="rtl">
                        <div className="text-center border-b-2 border-slate-800 pb-6 mb-6">
                            <h1 className="text-3xl font-black text-slate-900 mb-2">خطة التخرج الأكاديمية</h1>
                            <h2 className="text-sm font-bold text-slate-600">{auth.user?.major?.name || 'تخصص غير محدد'}</h2>
                        </div>

                        <div className="flex justify-between items-end border border-slate-300 rounded-xl p-5 mb-8">
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 mb-1 uppercase">اسم الطالب</p>
                                <p className="text-lg font-black text-slate-900">{auth.user?.name || 'غير معروف'}</p>
                                <p className="text-xs font-bold text-slate-600 mt-0.5">{auth.user?.email}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[11px] font-bold text-slate-500 mb-1 uppercase">عدد فصول الخطة</p>
                                <p className="text-xl font-black text-slate-900">{(graduation_plan.semesters || []).length}</p>
                            </div>
                            <div className="text-left">
                                <p className="text-[11px] font-bold text-slate-500 mb-1 uppercase">تاريخ الاعتماد</p>
                                <p className="text-lg font-black text-slate-900">{graduation_plan.approved_at ? new Date(graduation_plan.approved_at).toLocaleDateString('ar-SA') : 'غير محدد'}</p>
                            </div>
                        </div>

                        {graduation_plan.notes && (
                            <div className="mb-6 p-4 border border-slate-300 rounded-xl bg-slate-50 text-sm font-bold text-slate-700">
                                <span className="text-slate-500 uppercase text-[11px] block mb-1">ملاحظات:</span>
                                {graduation_plan.notes}
                            </div>
                        )}

                        <div className="space-y-6">
                            {(graduation_plan.semesters || []).map((sem, idx) => {
                                const totalCredits = (sem.courses || []).reduce((sum, c) => sum + (c?.credit_hours || 0), 0);
                                return (
                                    <div key={idx} className="break-inside-avoid">
                                        <div className="bg-slate-100 px-4 py-2 flex justify-between items-center border border-slate-300 border-b-0 rounded-t-xl">
                                            <h3 className="font-black text-sm text-slate-800">
                                                {sem.is_summer ? 'الفصل الصيفي' : `الفصل ${sem.semester}`}
                                            </h3>
                                            <span className="text-xs font-bold text-slate-600">
                                                إجمالي الساعات: {totalCredits}
                                            </span>
                                        </div>
                                        <table className="w-full border-collapse border border-slate-300 text-sm">
                                            <thead>
                                                <tr className="bg-slate-50">
                                                    <th className="border border-slate-300 px-3 py-2 text-right font-black text-slate-700 w-24">الرمز</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-right font-black text-slate-700">المادة</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-center font-black text-slate-700 w-20">الساعات</th>
                                                    <th className="border border-slate-300 px-3 py-2 text-center font-black text-slate-700 w-24">النوع</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(sem.courses || []).map((c, cIdx) => (
                                                    <tr key={cIdx}>
                                                        <td className="border border-slate-300 px-3 py-1.5 text-right font-mono text-xs">{c?.code}</td>
                                                        <td className="border border-slate-300 px-3 py-1.5 text-right font-bold text-slate-800">{c?.name}</td>
                                                        <td className="border border-slate-300 px-3 py-1.5 text-center">{c?.credit_hours}</td>
                                                        <td className="border border-slate-300 px-3 py-1.5 text-center text-xs text-slate-600">
                                                            {c?.type === 'university_req' ? 'متطلب جامعة' : 
                                                             c?.type === 'elective' ? 'اختياري' :
                                                             c?.type === 'supporting' ? 'مساندة' : 'إجباري'}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(!sem.courses || sem.courses.length === 0) && (
                                                    <tr>
                                                        <td colSpan="4" className="border border-slate-300 px-3 py-4 text-center text-slate-400 font-bold">لا يوجد مواد في هذا الفصل</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 text-center text-[10px] text-slate-400 font-bold border-t border-slate-200 pt-4">
                            تم استخراج هذه الخطة من نظام سنفور الأكاديمي.
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}