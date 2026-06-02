import React, { useState, useMemo, useEffect } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head, Link } from '@inertiajs/react';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar 
} from 'recharts';
import { Target, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2, ChevronDown, Save, BarChart3, SlidersHorizontal } from 'lucide-react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

export default function Calculator({ auth, initialCourses }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    
    const legacyPlanSemesterToYearTerm = (semesterValue) => {
        const normalized = Math.min(12, Math.max(1, parseInt(semesterValue, 10) || 1));
        return {
            year: Math.ceil(normalized / 2),
            term: normalized % 2 === 0 ? 2 : 1,
        };
    };

    const yearTermToSemester = (yearValue, termValue) => {
        const year = Math.min(6, Math.max(1, parseInt(yearValue, 10) || 1));
        const parsedTerm = parseInt(termValue, 10);
        const term = [1, 2, 3].includes(parsedTerm) ? parsedTerm : 1;
        return ((year - 1) * 3) + term;
    };

    const termLabel = (termValue) => {
        if (termValue === 1) return 'الأول';
        if (termValue === 2) return 'الثاني';
        return 'الصيفي';
    };

    const yearOptions = [
        { value: 1, label: 'السنة الأولى' },
        { value: 2, label: 'السنة الثانية' },
        { value: 3, label: 'السنة الثالثة' },
        { value: 4, label: 'السنة الرابعة' },
        { value: 5, label: 'السنة الخامسة' },
        { value: 6, label: 'السنة السادسة' },
    ];

    const termOptions = [
        { value: 1, label: 'الفصل الأول' },
        { value: 2, label: 'الفصل الثاني' },
        { value: 3, label: 'الفصل الصيفي' },
    ];

    // 1. تهيئة المواد
    const [courses, setCourses] = useState(() => {
        const coursesArray = Array.isArray(initialCourses) ? initialCourses : [];
        return coursesArray.map(c => {
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
                localSemester: yearTermToSemester(year, term),
                recordKey: `${year}-${term}`,
            };
        });
    });
    
    const [loading, setLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('');
    const [targetGpa, setTargetGpa] = useState('');
    const [activeTab, setActiveTab] = useState('calculator'); // 'calculator', 'analytics'

    const availableTermsForYear = useMemo(() => {
        if (!selectedYear) return [];
        return [1, 2, 3];
    }, [selectedYear]);

    const handleYearChange = (year) => {
        setSelectedYear(String(year || ''));
        setSelectedTerm('');
    };

    const handleTermChange = (term) => {
        setSelectedTerm(String(term || ''));
    };

    const filteredCourses = useMemo(() => {
        if (!courses || courses.length === 0) return [];
        if (!selectedYear) return courses;
        if (!selectedTerm) return courses.filter(c => String(c.localYear) === selectedYear);

        return courses.filter(c => c.recordKey === `${selectedYear}-${selectedTerm}`);
    }, [courses, selectedYear, selectedTerm]);

    const hasYearFilter = Boolean(selectedYear);
    const hasTermFilter = Boolean(selectedTerm);

    const selectedPeriodLabel = useMemo(() => {
        if (!hasYearFilter) return 'المحددة';
        if (!hasTermFilter) return `سنة ${selectedYear}`;
        return `سنة ${selectedYear} - ${termLabel(parseInt(selectedTerm, 10))}`;
    }, [hasYearFilter, hasTermFilter, selectedYear, selectedTerm]);

    const handleGradeChange = (id, val) => {
        setCourses(prev => prev.map(c =>
            c.id === id ? { ...c, pivot: { ...c.pivot, grade: val } } : c
        ));
    };

    const handleStudySlotChange = (id, field, value) => {
        setCourses(prev => prev.map(c => {
            if (c.id !== id) return c;

            const nextYear = field === 'year' ? parseInt(value, 10) || 1 : c.localYear;
            const parsedTerm = field === 'term' ? parseInt(value, 10) : c.localTerm;
            const nextTerm = [1, 2, 3].includes(parsedTerm) ? parsedTerm : 1;

            return {
                ...c,
                localYear: nextYear,
                localTerm: nextTerm,
                localSemester: yearTermToSemester(nextYear, nextTerm),
                recordKey: `${nextYear}-${nextTerm}`,
            };
        }));
    };

    const calculateStats = (courseList) => {
        let totalCredits = 0;
        let weightedSum = 0;

        courseList.forEach(c => {
            const grade = parseFloat(c.pivot?.grade);
            if (!isNaN(grade) && grade > 0) {
                totalCredits += c.credit_hours;
                weightedSum += (grade * c.credit_hours);
            }
        });

        const percentage = totalCredits > 0 ? (weightedSum / totalCredits) : 0;
        const gpa4 = totalCredits > 0 ? (percentage / 25).toFixed(2) : '0.00';

        return { percentage: percentage.toFixed(2), gpa4, totalCredits };
    };

    const cumulativeStats = useMemo(() => calculateStats(courses), [courses]);
    const semesterStats = useMemo(() => calculateStats(filteredCourses), [filteredCourses]);

    // مسار المعدل التاريخي (للرسوم البيانية)
    const gpaHistory = useMemo(() => {
        const grouped = {};
        courses.forEach(c => {
            if (!grouped[c.recordKey]) grouped[c.recordKey] = { year: c.localYear, term: c.localTerm, courses: [] };
            grouped[c.recordKey].courses.push(c);
        });

        // ترتيب الأترام زمنياً
        const sortedKeys = Object.keys(grouped).sort((a, b) => {
            const [y1, t1] = a.split('-').map(Number);
            const [y2, t2] = b.split('-').map(Number);
            if (y1 !== y2) return y1 - y2;
            return t1 - t2;
        });

        let history = [];
        let cumCredits = 0;
        let cumSum = 0;

        sortedKeys.forEach(key => {
            let semCredits = 0;
            let semSum = 0;
            
            grouped[key].courses.forEach(c => {
                const grade = parseFloat(c.pivot?.grade);
                if (!isNaN(grade) && grade > 0) {
                    semCredits += c.credit_hours;
                    semSum += (grade * c.credit_hours);
                    cumCredits += c.credit_hours;
                    cumSum += (grade * c.credit_hours);
                }
            });

            if (semCredits > 0) {
                history.push({
                    name: `س${grouped[key].year} ف${grouped[key].term}`,
                    label: `سنة ${grouped[key].year} - فصل ${grouped[key].term}`,
                    فصلي: parseFloat((semSum / semCredits).toFixed(2)),
                    تراكمي: parseFloat((cumSum / cumCredits).toFixed(2))
                });
            }
        });

        return history;
    }, [courses]);

    // حاسبة الهدف
    const targetAnalysis = useMemo(() => {
        const target = parseFloat(targetGpa);
        if (isNaN(target) || target <= 0 || target > 100) return null;

        const currentCourses = filteredCourses;
        const completedCourses = courses.filter(c => !currentCourses.find(cc => cc.id === c.id));

        let compCredits = 0;
        let compSum = 0;
        completedCourses.forEach(c => {
            const grade = parseFloat(c.pivot?.grade);
            if (!isNaN(grade) && grade > 0) {
                compCredits += c.credit_hours;
                compSum += (grade * c.credit_hours);
            }
        });

        let currentCredits = 0;
        currentCourses.forEach(c => currentCredits += c.credit_hours);

        if (currentCredits === 0) return { status: 'error', message: 'يرجى اختيار فصل يحتوي على مواد، أو إضافة مواد للفصل الحالي لتوزيع الهدف عليها.' };

        const totalCredits = compCredits + currentCredits;
        const requiredSum = (target * totalCredits) - compSum;
        const requiredAvg = requiredSum / currentCredits;

        if (requiredAvg > 100) return { status: 'impossible', message: `مستحيل أخي! تحتاج لمعدل ${requiredAvg.toFixed(2)}% في المواد الحالية للوصول للهدف.`, requiredAvg: requiredAvg.toFixed(2) };
        if (requiredAvg <= 50) return { status: 'easy', message: 'سهل جداً! يمكنك الوصول للهدف حتى مع علامات متدنية (أقل من 50).', requiredAvg: requiredAvg.toFixed(2) };

        return { status: 'possible', message: `للوصول لمعدل ${target}%، تحتاج إلى معدل ${requiredAvg.toFixed(2)}% في المواد المحددة حالياً.`, requiredAvg: requiredAvg.toFixed(2), currentCredits };
    }, [targetGpa, courses, filteredCourses]);

    // تطبيق الهدف (What-If) - توزيع ذكي
    const applyTargetGrades = () => {
        if (!targetAnalysis || targetAnalysis.status !== 'possible') return;
        
        const avg = parseFloat(targetAnalysis.requiredAvg);
        setCourses(prev => prev.map(c => {
            if (filteredCourses.find(fc => fc.id === c.id)) {
                return { ...c, pivot: { ...c.pivot, grade: avg.toFixed(1) } };
            }
            return c;
        }));
        
        Swal.fire({
            icon: 'success',
            title: 'تم التوزيع!',
            text: `تم تعبئة المواد الحالية بمعدل ${avg.toFixed(2)}% لتجربة سيناريو الهدف.`,
            timer: 2000,
            showConfirmButton: false,
        });
    };

    // نصائح ذكية (Smart Nudges)
    const smartNudge = useMemo(() => {
        if (filteredCourses.length === 0) return null;
        
        let highestWeightLowestGrade = null;
        filteredCourses.forEach(c => {
            const grade = parseFloat(c.pivot?.grade);
            if (!isNaN(grade) && grade > 0 && c.credit_hours >= 3) {
                if (!highestWeightLowestGrade || grade < parseFloat(highestWeightLowestGrade.pivot.grade)) {
                    highestWeightLowestGrade = c;
                }
            }
        });

        if (highestWeightLowestGrade) {
            const currentGrade = parseFloat(highestWeightLowestGrade.pivot.grade);
            if (currentGrade < 84) { 
                const nextGradeMark = currentGrade < 60 ? 60 : (currentGrade < 68 ? 68 : (currentGrade < 76 ? 76 : 84));
                const needed = (nextGradeMark - currentGrade).toFixed(1);
                if (needed > 0 && needed <= 5) {
                    return `نصيحة ذهبية 💡: تحتاج لـ ${needed} علامة فقط في مادة "${highestWeightLowestGrade.name}" لرفع تقديرها لـ ${nextGradeMark}، ولأنها بـ ${highestWeightLowestGrade.credit_hours} ساعات ستؤثر بشكل كبير على معدلك!`;
                }
            }
        }
        
        return null;
    }, [filteredCourses]);

    const getGradeColor = (grade) => {
        const val = parseFloat(grade);
        if (isNaN(val)) return 'text-slate-400 border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:shadow-md';
        if (val >= 84) return 'text-emerald-700 border-emerald-300 bg-emerald-50 focus:border-emerald-500 shadow-sm'; 
        if (val >= 76) return 'text-blue-700 border-blue-300 bg-blue-50 focus:border-blue-500 shadow-sm'; 
        if (val >= 68) return 'text-indigo-700 border-indigo-300 bg-indigo-50 focus:border-indigo-500 shadow-sm'; 
        if (val >= 60) return 'text-amber-700 border-amber-300 bg-amber-50 focus:border-amber-500 shadow-sm'; 
        return 'text-rose-700 border-rose-300 bg-rose-50 focus:border-rose-500 shadow-sm'; 
    };

    const saveGrades = async () => {
        setLoading(true);
        const coursesPayload = {};
        
        courses.forEach(c => {
            coursesPayload[c.id] = {
                grade: c.pivot?.grade !== undefined && c.pivot?.grade !== '' ? parseFloat(c.pivot.grade) : null,
                year: c.localYear,
                term: c.localTerm,
                semester: c.localSemester,
            };
        });

        try {
            const response = await axios.post(route('grades.update'), { coursesData: coursesPayload });
            Swal.fire({
                icon: 'success',
                title: 'تم اعتماد السجل! 🚀',
                text: `تم حفظ العلامات والفصول المخصصة. معدلك التراكمي المعتمد الآن: ${response.data.new_percentage || cumulativeStats.percentage}%`,
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'font-sans rounded-3xl' }
            });
        } catch (e) {
            Swal.fire('عذراً!', 'حدثت مشكلة أثناء الحفظ، يرجى المحاولة مرة أخرى.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout user={auth.user}>
            <Head>
                <title>الحاسبة الذكية | سنفور</title>
                <meta name="description" content="حاسبة ذكية توفر تحليلات ورسوم بيانية، وتتوقع لك العلامات للوصول للهدف المنشود." />
            </Head>
            
            <div className={`min-h-screen py-8 sm:py-10 transition-colors duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-[#f8faff] text-slate-900'}`} dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    
                    {/* Header */}
                    <section className="relative text-center mb-10 pt-8">
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                            <span className="text-[12vw] font-black tracking-tighter whitespace-nowrap">SMART GPA</span>
                        </div>
                        <div className="relative z-10 space-y-3">
                            <h1 className={`text-4xl sm:text-5xl md:text-6xl font-[900] tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                الحاسبة الذكية
                            </h1>
                            <p className={`text-lg font-bold max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                أداة ذكية لتحليل أدائك، تخطيط أهدافك، وتوقع مسارك الأكاديمي بخطوات بسيطة
                            </p>
                        </div>
                    </section>

                    {/* Tabs */}
                    <div className="flex justify-center mb-6">
                        <div className={`flex p-1.5 rounded-2xl gap-1 ${isDark ? 'bg-slate-900' : 'bg-white shadow-sm border border-slate-200'}`}>
                            <button 
                                onClick={() => setActiveTab('calculator')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'calculator' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                            >
                                <SlidersHorizontal size={18} />
                                الحاسبة والسيناريوهات
                            </button>
                            <button 
                                onClick={() => setActiveTab('analytics')}
                                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                            >
                                <BarChart3 size={18} />
                                التحليلات البصرية
                            </button>
                        </div>
                    </div>

                    {activeTab === 'calculator' && (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* العمود الأيمن: لوحة القيادة وحاسبة الهدف */}
                            <div className="xl:col-span-4 space-y-6 order-1 xl:order-none">
                                {/* لوحة النتائج */}
                                <div className={`rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-900 border-slate-800'}`}>
                                    <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
                                    <div className="absolute -left-10 bottom-0 w-48 h-48 bg-cyan-500/20 blur-3xl rounded-full pointer-events-none"></div>

                                    <div className="space-y-8 relative z-10">
                                        <div className="text-center xl:text-right">
                                            <p className="text-indigo-300 text-xs font-black uppercase tracking-widest mb-2 flex items-center justify-center xl:justify-start gap-2">
                                                <Target size={16} /> التراكمي الحالي
                                            </p>
                                            <div className="flex items-baseline justify-center xl:justify-start gap-2">
                                                <h2 className="text-6xl font-[900] text-white drop-shadow-md tracking-tighter">
                                                    {cumulativeStats.percentage}
                                                </h2>
                                                <span className="text-2xl text-indigo-400 font-bold">%</span>
                                            </div>
                                        </div>

                                        <div className={`pt-6 border-t border-slate-800 text-center xl:text-right transition-all duration-500 ${hasYearFilter ? 'opacity-100 h-auto' : 'opacity-30 grayscale'}`}>
                                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2 flex items-center justify-center xl:justify-start gap-2">
                                                <TrendingUp size={16} /> معدل الفترة {selectedPeriodLabel}
                                            </p>
                                            <div className="flex items-baseline justify-center xl:justify-start gap-2">
                                                <h2 className={`text-4xl font-[900] drop-shadow-md tracking-tighter ${hasYearFilter ? 'text-white' : 'text-slate-600'}`}>
                                                    {hasYearFilter ? semesterStats.percentage : '--'}
                                                </h2>
                                                <span className={`text-xl font-bold ${hasYearFilter ? 'text-emerald-400' : 'text-slate-600'}`}>%</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 backdrop-blur-md flex justify-between items-center">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">إجمالي الساعات</span>
                                                <span className="text-xl font-black text-white">{cumulativeStats.totalCredits} <span className="text-xs font-medium text-slate-400">ساعة</span></span>
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                <CheckCircle2 size={24} />
                                            </div>
                                        </div>

                                        <button
                                            onClick={saveGrades}
                                            disabled={loading}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {loading ? 'جاري الحفظ...' : <><Save size={20} /> حفظ السيناريو نهائياً</>}
                                        </button>
                                    </div>
                                </div>

                                {/* حاسبة الهدف */}
                                <div className={`rounded-3xl p-6 border shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 rounded-xl bg-orange-100 text-orange-600">
                                            <Target size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg">حاسبة الهدف 🎯</h3>
                                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>حدد معدلك المطلوب وسنخبرك بما تحتاجه</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                min="50" max="100"
                                                placeholder="أدخل المعدل المطلوب (مثال: 80)"
                                                value={targetGpa}
                                                onChange={(e) => setTargetGpa(e.target.value)}
                                                className={`w-full py-4 px-5 pr-12 rounded-2xl border-2 text-lg font-black outline-none transition-all ${
                                                    isDark 
                                                    ? 'bg-slate-950 border-slate-800 focus:border-orange-500 text-white' 
                                                    : 'bg-slate-50 border-slate-200 focus:border-orange-500 text-slate-900 focus:bg-white'
                                                }`}
                                            />
                                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                                        </div>

                                        {targetAnalysis && (
                                            <div className={`p-4 rounded-2xl border ${
                                                targetAnalysis.status === 'impossible' ? 'bg-rose-50 border-rose-200 text-rose-700' :
                                                targetAnalysis.status === 'error' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                                                'bg-emerald-50 border-emerald-200 text-emerald-800'
                                            }`}>
                                                <p className="text-sm font-bold flex items-start gap-2">
                                                    {targetAnalysis.status === 'impossible' ? <AlertTriangle size={18} className="shrink-0 mt-0.5" /> : 
                                                     targetAnalysis.status === 'error' ? <AlertTriangle size={18} className="shrink-0 mt-0.5" /> : 
                                                     <Lightbulb size={18} className="shrink-0 mt-0.5" />}
                                                    {targetAnalysis.message}
                                                </p>
                                                
                                                {targetAnalysis.status === 'possible' && (
                                                    <button 
                                                        onClick={applyTargetGrades}
                                                        className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95"
                                                    >
                                                        توزيع العلامة المطلوبة على المواد الحالية ✨
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* العمود الأيسر: قائمة المواد والفلاتر */}
                            <div className="xl:col-span-8 space-y-6 order-2 xl:order-none">
                                {/* النصيحة الذكية */}
                                {smartNudge && (
                                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-4 items-center shadow-sm">
                                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-orange-500 shrink-0 shadow-sm">
                                            <Lightbulb size={24} />
                                        </div>
                                        <p className="font-bold text-orange-800 text-sm leading-relaxed">{smartNudge}</p>
                                    </div>
                                )}

                                {/* الفلترة */}
                                <div className={`rounded-2xl border shadow-sm p-5 sm:p-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
                                        <div>
                                            <h3 className="text-base font-black">تصفية وبناء السيناريو</h3>
                                            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>اختر الفصل لمعاينة المعدل الخاص به وتجربة "ماذا لو"</p>
                                        </div>
                                        <button
                                            onClick={() => handleYearChange('')}
                                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                                                !hasYearFilter
                                                    ? 'bg-slate-800 text-white border-slate-800'
                                                    : isDark ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            عرض الكل ({courses.length})
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <label className="block">
                                            <span className={`mb-2 block text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>السنة الدراسية</span>
                                            <div className="relative">
                                                <select
                                                    value={selectedYear}
                                                    onChange={(e) => handleYearChange(e.target.value)}
                                                    className={`w-full appearance-none rounded-xl border px-4 py-3 pl-10 text-sm font-bold shadow-sm transition-all focus:ring-2 outline-none ${
                                                        isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500 focus:ring-indigo-500/20' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 focus:bg-white'
                                                    }`}
                                                >
                                                    <option value="">اختر السنة</option>
                                                    {yearOptions.map((year) => (
                                                        <option key={year.value} value={year.value}>{year.label}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </label>

                                        <label className="block">
                                            <span className={`mb-2 block text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>الفصل الدراسي</span>
                                            <div className="relative">
                                                <select
                                                    value={selectedTerm}
                                                    onChange={(e) => handleTermChange(e.target.value)}
                                                    disabled={!selectedYear}
                                                    className={`w-full appearance-none rounded-xl border px-4 py-3 pl-10 text-sm font-bold shadow-sm transition-all focus:ring-2 outline-none disabled:cursor-not-allowed ${
                                                        isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500 focus:ring-indigo-500/20 disabled:opacity-50' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400'
                                                    }`}
                                                >
                                                    <option value="">اختر الفصل</option>
                                                    {availableTermsForYear.map((term) => (
                                                        <option key={term} value={term}>{termOptions.find((item) => item.value === term)?.label || termLabel(term)}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* قائمة المواد (What-If Sliders) */}
                                <div className={`rounded-[2.5rem] border shadow-sm overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                    <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                        <h3 className="font-black text-lg flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                <SlidersHorizontal size={18} className="text-indigo-500" />
                                            </div>
                                            مواد السيناريو التفاعلي
                                        </h3>
                                    </div>
                                    
                                    <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                        {filteredCourses.map((course) => (
                                            <div key={course.id} className={`p-5 sm:p-6 flex flex-col xl:flex-row gap-6 transition-colors ${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`}>
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 shadow-sm border ${course.type === 'compulsory' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                                        {course.credit_hours}س
                                                    </div>
                                                    <div className="flex-1 space-y-2">
                                                        <h4 className="font-black mb-1 text-base leading-tight pr-2">{course.name}</h4>
                                                        
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border shadow-sm ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                                {course.code}
                                                            </span>

                                                            <div className="relative flex items-center">
                                                                <select
                                                                    value={course.localYear}
                                                                    onChange={(e) => handleStudySlotChange(course.id, 'year', e.target.value)}
                                                                    className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg px-3 py-1 pr-7 hover:bg-indigo-100 transition-colors cursor-pointer outline-none"
                                                                >
                                                                    {yearOptions.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}
                                                                </select>
                                                                <ChevronDown size={12} className="absolute left-2 text-indigo-500 pointer-events-none" />
                                                            </div>

                                                            <div className="relative flex items-center">
                                                                <select
                                                                    value={course.localTerm}
                                                                    onChange={(e) => handleStudySlotChange(course.id, 'term', e.target.value)}
                                                                    className="appearance-none bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg px-3 py-1 pr-7 hover:bg-emerald-100 transition-colors cursor-pointer outline-none"
                                                                >
                                                                    {termOptions.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}
                                                                </select>
                                                                <ChevronDown size={12} className="absolute left-2 text-emerald-500 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* What-If Input & Slider */}
                                                <div className="w-full xl:w-64 shrink-0 flex flex-col gap-3 justify-center">
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="35" max="100"
                                                            value={course.pivot?.grade || ''}
                                                            onChange={(e) => handleGradeChange(course.id, e.target.value)}
                                                            placeholder="---"
                                                            className={`w-full h-12 rounded-xl border-2 text-center text-xl font-black transition-all outline-none ${getGradeColor(course.pivot?.grade)}`}
                                                        />
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold opacity-50">%</span>
                                                    </div>
                                                    <input 
                                                        type="range" 
                                                        min="35" max="100" 
                                                        value={course.pivot?.grade || 35}
                                                        onChange={(e) => handleGradeChange(course.id, e.target.value)}
                                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        {filteredCourses.length === 0 && (
                                            <div className="p-20 text-center flex flex-col items-center justify-center opacity-70">
                                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">📭</div>
                                                <h3 className="text-lg font-black text-slate-800 mb-1">التبويب فارغ</h3>
                                                <p className="text-sm font-bold text-slate-500">لا توجد مواد مصنفة في هذا الفصل.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* تبويب التحليلات البصرية */}
                    {activeTab === 'analytics' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                            
                            <div className={`rounded-[2.5rem] p-6 sm:p-10 border shadow-lg ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                <div className="mb-8">
                                    <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><TrendingUp size={24} /></div>
                                        مسار الأداء الأكاديمي
                                    </h2>
                                    <p className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        تتبع تطور معدلك الفصلي والتراكمي عبر الفصول الدراسية المختلفة.
                                    </p>
                                </div>

                                {gpaHistory.length > 0 ? (
                                    <div className="h-[400px] w-full mt-10" dir="ltr">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={gpaHistory} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                                                <XAxis 
                                                    dataKey="name" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold' }} 
                                                    dy={10}
                                                />
                                                <YAxis 
                                                    domain={[50, 100]} 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold' }} 
                                                    dx={-10}
                                                />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', fontWeight: 'bold', direction: 'rtl', backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#fff' : '#000' }}
                                                    formatter={(value, name) => [`${value}%`, name === 'تراكمي' ? 'المعدل التراكمي' : 'المعدل الفصلي']}
                                                    labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: '8px' }}
                                                />
                                                <Bar dataKey="فصلي" barSize={20} fill="#38bdf8" radius={[4, 4, 0, 0]} />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="تراكمي" 
                                                    stroke="#4f46e5" 
                                                    strokeWidth={4} 
                                                    dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} 
                                                    activeDot={{ r: 8 }} 
                                                />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div className="h-[300px] flex flex-col items-center justify-center opacity-50">
                                        <BarChart3 size={48} className="mb-4 text-slate-400" />
                                        <p className="font-bold">لا توجد بيانات كافية لرسم المنحنى</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-indigo-50 border-indigo-100'}`}>
                                    <h3 className="font-black text-indigo-800 dark:text-indigo-300 mb-2 flex items-center gap-2"><Lightbulb size={20} />كيف نقرأ هذا المخطط؟</h3>
                                    <p className="text-sm text-indigo-700/80 dark:text-indigo-200 font-bold leading-relaxed">
                                        الأعمدة الزرقاء الفاتحة تمثل أداءك في كل فصل على حدة (المعدل الفصلي)، بينما الخط الأزرق الداكن يمثل المعدل التراكمي الذي يتأثر بجميع الفصول. استقرار الخط أو صعوده يدل على أداء ممتاز!
                                    </p>
                                </div>
                                <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <h3 className="font-black text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-2"><Target size={20} />أعلى وأقل أداء</h3>
                                    <p className="text-sm text-emerald-700/80 dark:text-emerald-200 font-bold leading-relaxed">
                                        يتم حساب الفصول بناءً على البيانات المدخلة والمحفوظة مسبقاً. يمكنك ملاحظة أي الفصول كانت الأصعب للتركيز على تجنب نفس الأنماط مستقبلاً، وأيها كان الأفضل لتكرار التجربة.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: '::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }' }} />
        </MainLayout>
    );
}