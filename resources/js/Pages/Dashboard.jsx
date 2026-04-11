import MainLayout from '@/Layouts/MainLayout';
import { Head, Link, router } from '@inertiajs/react';
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
            ` }} />

            <div className="py-6 sm:py-8 min-h-screen selection:bg-indigo-100 selection:text-indigo-900" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">

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
                            <div className="absolute top-0 right-0 w-[70%] h-full bg-gradient-to-l from-indigo-600/25 via-indigo-600/8 to-transparent" />
                            <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * -22}px, ${my * -22}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * 18}px, ${my * 18}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }} />
                            <div className="absolute top-0 left-0 w-full h-[1px] overflow-hidden"><div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'sn-shimmer 4.5s ease-in-out infinite' }} /></div>
                        </div>

                        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-2 rounded-[1.4rem] opacity-0 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', filter: 'blur(18px)', animation: 'sn-glow 3s ease-in-out infinite', transition: 'opacity 700ms ease' }} />
                                    <div className="relative w-[78px] h-[78px] sm:w-[90px] sm:h-[90px] rounded-[1.3rem] p-[3px] overflow-hidden">
                                        <div className="absolute inset-0" style={{ background: 'conic-gradient(from 0deg, #6366f1, #06b6d4, #8b5cf6, #6366f1)', animation: 'sn-rotate-border 5s linear infinite' }} />
                                        <div className="relative w-full h-full bg-[#0f172a] rounded-[calc(1.3rem-3px)] flex items-center justify-center text-2xl sm:text-3xl font-[900] z-10 select-none">
                                            {auth.user?.name?.charAt(0) || 'S'}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1 min-w-0 text-center sm:text-right">
                                    <div>
                                        <h1 className="text-[1.55rem] sm:text-[1.9rem] font-[900] tracking-tight truncate leading-tight">{auth.user?.name || 'طالب مجهول'}</h1>
                                        <p className="text-indigo-300/50 text-sm mt-1 truncate">{auth.user?.email || 'لا يوجد بريد إلكتروني'}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        {[{ text: auth.user?.major?.name || 'تخصص غير محدد', icon: '🎓', d: 200 }, { text: academicYear, icon: '📅', d: 320 }].map((badge, i) => (
                                            <span key={i} className="bg-white/[0.07] backdrop-blur-md border border-white/[0.1] px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 hover:bg-white/[0.13] transition-colors cursor-default" style={{ animation: mounted ? `sn-pop 0.55s ${spring} ${badge.d}ms both` : 'none' }}>
                                                {badge.icon} {badge.text}
                                            </span>
                                        ))}
                                        <span className={`px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5 border cursor-default ${standing.cls}`} style={{ animation: mounted ? `sn-pop 0.55s ${spring} 440ms both` : 'none' }}>
                                            {standing.icon} {standing.label}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-indigo-200/35 mt-1 hidden sm:block" style={{ animation: mounted ? `sn-up 0.65s ${spring} 550ms both` : 'none' }}>
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
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-[3rem] -z-0 transition-transform group-hover:scale-[3] duration-[800ms] ease-out" />
                            <div className="relative z-10 flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">المعدل المئوي (%)</p>
                                    <h3 className="text-[2.15rem] font-[900] text-slate-800 leading-none"><AnimatedCounter target={gpa} decimals={2} duration={1800} /><span className="text-sm font-bold text-slate-300 mr-1">%</span></h3>
                                    <div className="mt-3 w-full bg-slate-100 h-[5px] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-l from-indigo-400 to-indigo-500 rounded-full" style={{ width: metricsVis ? `${Math.min(parseFloat(gpa) || 0, 100)}%` : '0%', transition: `width 2000ms ${spring} 450ms` }} /></div>
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-xl border border-indigo-100 shrink-0">🎯</div>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-[1.6rem] border border-slate-100 flex items-center gap-5 relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500 shadow-sm" style={{ opacity: metricsVis ? 1 : 0, transform: metricsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: '260ms' }}>
                            <div className="relative shrink-0 z-10">
                                <svg className="w-[86px] h-[86px] transform -rotate-90" viewBox="0 0 86 86">
                                    <circle cx="43" cy="43" r="38" stroke="#f1f5f9" strokeWidth="7" fill="transparent" />
                                    <circle cx="43" cy="43" r="38" stroke="url(#progressGrad)" strokeWidth="7" fill="transparent" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={metricsVis ? circumference - (circumference * progressPct) / 100 : circumference} style={{ transition: `stroke-dashoffset 2200ms ${spring} 500ms` }} />
                                    <defs>
                                        <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#4f46e5" /><stop offset="50%" stopColor="#6366f1" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col"><span className="text-[1.15rem] font-[900] text-slate-800 leading-none">{progressPct}%</span><span className="text-[8px] font-bold text-slate-400 mt-0.5">مكتمل</span></div>
                            </div>
                            <div className="relative z-10 flex-1 min-w-0">
                                <h4 className="text-[1rem] font-[800] text-slate-800 mb-1">رحلة التخرج 🎓</h4>
                                <p className="text-[12px] text-slate-500 leading-relaxed">{remaining > 0 ? <>بقيت <span className="text-indigo-600 font-bold">{remaining} ساعة</span> لترتدي روب التخرج!</> : <span className="text-emerald-600 font-bold">مبروك! أنت جاهز للتخرج 🎉</span>}</p>
                            </div>
                        </div>
                    </div>

                    {/* 3. AI INSIGHT BANNER */}
                    <div ref={aiRef} className="relative overflow-hidden rounded-[1.4rem] shadow-sm" style={{ opacity: aiVis ? 1 : 0, transform: aiVis ? 'translateY(0)' : 'translateY(14px)', transition: `all 700ms ${spring} 80ms` }}>
                        <div className="absolute inset-0 rounded-[1.4rem] p-[1.5px]" style={{ background: 'linear-gradient(135deg, #c7d2fe, #a5f3fc, #c7d2fe, #a5f3fc)', backgroundSize: '300% 300%', animation: 'sn-gradient-drift 6s ease infinite' }}>
                            <div className="w-full h-full rounded-[calc(1.4rem-1.5px)] bg-gradient-to-l from-indigo-50/95 to-cyan-50/70 backdrop-blur-sm" />
                        </div>
                        <div className="relative z-10 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-[1.4rem] shadow-lg shadow-indigo-300/40" style={{ animation: 'sn-float 3.5s ease-in-out infinite' }}>🤖</div>
                                    <div className="absolute -inset-1 rounded-xl border-2 border-indigo-400/30" style={{ animation: 'sn-ring-pulse 2.5s ease-out infinite' }} />
                                </div>
                                <div>
                                    <h4 className="text-[14px] font-[800] text-indigo-900 mb-0.5">نصيحة المرشد الذكي</h4>
                                    <p className="text-[12px] text-indigo-700/55 leading-relaxed max-w-lg">المرشد الذكي الآن قادر على قراءة تسجيلك التجريبي وإضافة جداول كاملة لك بضغطة زر. تحدث معه الآن!</p>
                                </div>
                            </div>
                            <Link href={route('ai.advisor')} className="bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300 shadow-sm active:scale-[0.96] whitespace-nowrap shrink-0 flex items-center gap-2">
                                تحدث مع المرشد <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                        </div>
                    </div>

                    {/* 4. SMART SCHEDULE GENERATOR */}
                    <div ref={smartRef} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden" style={{ opacity: smartVis ? 1 : 0, transform: smartVis ? 'translateY(0)' : 'translateY(16px)', transition: `all 750ms ${spring}` }}>
                        <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-l from-cyan-50/60 via-white to-indigo-50/50">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <span className="text-2xl">🧠</span> الجدول الذكي للفصل القادم
                                    </h3>
                                    <p className="text-xs font-bold text-slate-500 mt-1">اختر أسلوبك، والنظام يقترح جدول بدون تعارض متطلبات وبحمل دراسي مناسب لك.</p>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] font-black bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                                    <span className="text-slate-400">الخطة الحالية:</span>
                                    <span className="text-indigo-600">{cartTotalHours} ساعة</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                <div>
                                    <p className="text-[11px] font-black text-slate-500 mb-2">نمط الفصل</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'light', label: 'خفيف', icon: '🏖️' },
                                            { id: 'balanced', label: 'متوازن', icon: '⚖️' },
                                            { id: 'heavy', label: 'مكثف', icon: '🚀' },
                                        ].map((mode) => (
                                            <button key={mode.id} onClick={() => setSmartPace(mode.id)} className={`rounded-xl border px-3 py-2 text-xs font-black transition-all ${smartPace === mode.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                                                <span className="ml-1">{mode.icon}</span>{mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[11px] font-black text-slate-500 mb-2">الأولوية</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { id: 'major', label: 'مواد تخصص' },
                                            { id: 'graduation', label: 'تسريع تخرج' },
                                            { id: 'gpa', label: 'حماية المعدل' },
                                        ].map((focus) => (
                                            <button key={focus.id} onClick={() => setSmartFocus(focus.id)} className={`rounded-xl border px-2 py-2 text-[11px] font-black transition-all ${smartFocus === focus.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200/60' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                                                {focus.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 bg-slate-50/60 cursor-pointer">
                                    <div>
                                        <p className="text-[12px] font-black text-slate-700">توازن الحمل</p>
                                        <p className="text-[10px] font-bold text-slate-400">حد أقصى 3 مواد ثقيلة في الخطة المقترحة</p>
                                    </div>
                                    <button type="button" onClick={() => setSmartProtectGpa((prev) => !prev)} className={`w-14 h-8 rounded-full transition-colors p-1 ${smartProtectGpa ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <span className={`block w-6 h-6 rounded-full bg-white transition-transform ${smartProtectGpa ? 'translate-x-0' : '-translate-x-6'}`} />
                                    </button>
                                </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 mt-6">
                                <button onClick={generateSmartPlan} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-[12px] font-black transition-colors shadow-lg shadow-indigo-200/60">
                                    توليد جدول ذكي
                                </button>
                                <span className="text-[11px] font-bold text-slate-500">الهدف المتوقع: {smartPace === 'heavy' ? 18 : smartPace === 'light' ? 12 : 15} ساعة</span>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 bg-white">
                            {smartPlan.length > 0 ? (
                                <>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] font-black bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">{smartHours} ساعة مقترحة</span>
                                            <span className="text-[11px] font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200">{smartPlan.length} مواد</span>
                                            {smartPlanInsights ? <span className="text-[11px] font-black bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200">{smartPlanInsights.majorCount} تخصص • {smartPlanInsights.universityCount} جامعة</span> : null}
                                            {smartPlanInsights ? <span className="text-[11px] font-black bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">صعوبة متوسطة {Math.round(smartPlanInsights.avgDifficulty)}%</span> : null}
                                        </div>
                                        <button onClick={applySmartPlan} disabled={isApplyingSmartPlan} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-[12px] font-black transition-colors">
                                            {isApplyingSmartPlan ? 'جاري التطبيق...' : 'اعتماد الخطة في التسجيل التجريبي'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {smartPlan.map((course, idx) => (
                                            <div key={course.id} className="rounded-2xl border border-slate-100 p-4 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all" style={{ animation: `sn-up 0.45s ${spring} ${idx * 45}ms both` }}>
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-1 rounded-md">{course.credit_hours} س</span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono">{course.code}</span>
                                                </div>
                                                <h4 className="text-[13px] font-black text-slate-800 line-clamp-2">{course.name}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 mt-2">{course.major_id !== null ? 'مادة تخصص' : 'متطلب جامعة'} • سنة {course.recommended_year} • صعوبة {Math.round(course.difficulty_score || 0)}%</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${(course.recommendation_confidence || 0) >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (course.recommendation_confidence || 0) >= 55 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                        ثقة الترشيح {Math.round(course.recommendation_confidence || 0)}%
                                                    </span>
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${(course.data_confidence || 0) >= 65 ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        موثوقية البيانات {Math.round(course.data_confidence || 0)}%
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {(course.recommendation_reasons || []).slice(0, 2).map((reason, reasonIdx) => (
                                                        <span key={`${course.id}-${reasonIdx}`} className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5">{reason}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-10 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60">
                                    <span className="text-4xl opacity-60">📅</span>
                                    <p className="text-sm font-black text-slate-700 mt-3">لا يوجد اقتراح بعد</p>
                                    <p className="text-xs font-bold text-slate-400 mt-1">اضغط "توليد جدول ذكي" للحصول على أفضل خطة حسب وضعك الأكاديمي.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 🔥 5. SMART SKILLS SECTION — الميزة الجديدة 🔥 */}
                    <div ref={skillsRef} className="space-y-4" style={{ opacity: skillsVis ? 1 : 0, transform: skillsVis ? 'translateY(0)' : 'translateY(20px)', transition: `all 800ms ${spring}` }}>
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <span className="text-xl">🚀</span> سيرة المهارات الذكية
                            </h3>
                            <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">تحليل AI مباشر</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {/* استخدام safeSkills هنا لتجنب المشاكل */}
                            {safeSkills.length > 0 ? safeSkills.map((skill, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group relative overflow-hidden" style={{ animation: `sn-pop 0.5s ${spring} ${idx * 60}ms both` }}>
                                    <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-50 rounded-bl-xl -z-0 group-hover:scale-[4] transition-transform duration-500 opacity-30" />
                                    <div className="relative z-10">
                                        <p className="text-[13px] font-black text-slate-800 mb-1">{skill.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 line-clamp-1">مكتسبة من: {skill.course_source}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-6 text-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                    <p className="text-xs font-bold text-slate-400">أنجز المزيد من المواد لتستخلص مهاراتك التقنية هنا!</p>
                                </div>
                            )}
                        </div>
                    </div>

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
                                    <Link href={route('tree.index')} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200/50">الذهاب للشجرة 🌳</Link>
                                </div>
                            )}
                        </div>

                        {/* 7. التسجيل التجريبي المصغر (الجانب الأيسر) */}
                        <div className="lg:col-span-4 space-y-7">
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
                                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-[1.5rem] p-5 shadow-lg shadow-indigo-200/50 flex items-center justify-between transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl backdrop-blur-md">🗺️</div>
                                        <div>
                                            <h4 className="text-white font-black text-sm">استكشاف الخريطة الشجرية</h4>
                                            <p className="text-indigo-200 text-[10px] font-bold mt-0.5">اكتشف المسار الحرج والمتطلبات</p>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-white transform rtl:rotate-180 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}