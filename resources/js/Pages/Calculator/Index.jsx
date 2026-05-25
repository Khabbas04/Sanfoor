import React, { useState, useMemo } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head } from '@inertiajs/react';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';
import axios from 'axios';
import Swal from 'sweetalert2';

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

    // 1. تهيئة المواد (بدون أي تعقيدات)
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

    // استخراج الفصول المتاحة للسنة المختارة - كل السنة لها 3 فصول دائماً
    const availableTermsForYear = useMemo(() => {
        if (!selectedYear) return [];
        // كل سنة دائماً لها 3 فصول: الأول والثاني والصيفي
        return [1, 2, 3];
    }, [selectedYear]);

    // معالج تغيير السنة
    const handleYearChange = (year) => {
        setSelectedYear(String(year || ''));
        setSelectedTerm('');
    };

    // معالج تغيير الفصل
    const handleTermChange = (term) => {
        setSelectedTerm(String(term || ''));
    };

    // 3. فلترة المواد المعروضة (حسب السنة/الفصل المختار)
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

    // 4. تحديث العلامة (محلياً)
    const handleGradeChange = (id, val) => {
        setCourses(prev => prev.map(c =>
            c.id === id ? { ...c, pivot: { ...c.pivot, grade: val } } : c
        ));
    };

    // 5. تحديث الفصل الدراسي (محلياً)
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

    // 6. دوال الحساب الرياضية
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

    // 7. ألوان تفاعلية لحقل العلامة
    const getGradeColor = (grade) => {
        const val = parseFloat(grade);
        if (isNaN(val)) return 'text-slate-400 border-slate-200 bg-slate-50 focus:border-indigo-500 focus:bg-white focus:shadow-md';
        if (val >= 84) return 'text-emerald-700 border-emerald-300 bg-emerald-50 focus:border-emerald-500 shadow-sm'; 
        if (val >= 76) return 'text-blue-700 border-blue-300 bg-blue-50 focus:border-blue-500 shadow-sm'; 
        if (val >= 68) return 'text-indigo-700 border-indigo-300 bg-indigo-50 focus:border-indigo-500 shadow-sm'; 
        if (val >= 60) return 'text-amber-700 border-amber-300 bg-amber-50 focus:border-amber-500 shadow-sm'; 
        return 'text-rose-700 border-rose-300 bg-rose-50 focus:border-rose-500 shadow-sm'; 
    };

    // 8. دالة الحفظ
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
                <title>حاسبة الأداء الأكاديمي | سنفور</title>
                <meta name="description" content="حاسبة أكاديمية داخل سنفور لحساب النسبة والمعدل التراكمي وتتبع أداء المواد لكل فصل." />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/calculator`} />
            </Head>
            
            <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_22%),linear-gradient(180deg,#f8fbff_0%,#ffffff_48%,#f4f7fb_100%)] py-8 sm:py-10" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    <section className="relative py-8 sm:py-12 mb-10 overflow-hidden w-full flex justify-center">
                        <div className="relative w-full max-w-6xl px-4 sm:px-6 flex flex-col">
                            <div className="text-end w-full select-none z-0">
                                <span className={`text-[4.5rem] sm:text-[7rem] md:text-[10rem] font-black tracking-tighter uppercase leading-[0.85] inline-block ${isDark ? 'text-white/[0.06]' : 'text-slate-900/[0.05]'}`}>
                                    GPA CALCULATOR
                                </span>
                            </div>
                            <div className="text-start w-full mt-[-2rem] sm:mt-[-3.5rem] md:mt-[-5rem] relative z-10 sm:px-8">
                                <h1 className={`text-4xl sm:text-6xl md:text-7xl font-[900] mb-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} drop-shadow-md`}>حاسبة المعدل الذكية</h1>
                                <p className={`text-base sm:text-xl font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>احسب نسبتك ومعدلك التراكمي بسهولة</p>
                            </div>
                        </div>
                    </section>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                        {/* ==========================================
                            العمود الأيمن: لوحة النتائج (Sticky Dashboard)
                        ========================================== */}
                        <div className="xl:col-span-4 space-y-6 order-1 xl:order-none">
                            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl xl:sticky xl:top-28 border border-slate-800 relative overflow-hidden">
                                <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
                                <div className="absolute -left-10 bottom-0 w-48 h-48 bg-purple-500/20 blur-3xl rounded-full pointer-events-none"></div>

                                <div className="space-y-8 relative z-10">
                                    <div className="text-center xl:text-right">
                                        <p className="text-indigo-300 text-xs font-black uppercase tracking-widest mb-2 flex items-center justify-center xl:justify-start gap-2">
                                            <span>🎯</span> المعدل التراكمي العام
                                        </p>
                                        <div className="flex items-baseline justify-center xl:justify-start gap-2">
                                            <h2 className="text-6xl font-[900] text-white drop-shadow-md tracking-tighter">
                                                {cumulativeStats.percentage}
                                            </h2>
                                            <span className="text-2xl text-indigo-400 font-bold">%</span>
                                        </div>
                                        <p className="text-slate-400 font-bold text-sm mt-2">
                                            هذا هو المعدل المئوي المعتمد حاليًا
                                        </p>
                                    </div>

                                    <div className={`pt-6 border-t border-slate-800 text-center xl:text-right transition-all duration-500 ${hasYearFilter ? 'opacity-100 h-auto' : 'opacity-30 grayscale'}`}>
                                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2 flex items-center justify-center xl:justify-start gap-2">
                                            <span>📊</span> معدل الفترة {selectedPeriodLabel}
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
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">ساعات مدخلة</span>
                                            <span className="text-xl font-black text-white">{cumulativeStats.totalCredits} <span className="text-xs font-medium text-slate-400">ساعة</span></span>
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl">
                                            ⏱️
                                        </div>
                                    </div>

                                    <button
                                        onClick={saveGrades}
                                        disabled={loading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-lg transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                    >
                                        {loading ? (
                                            <span className="flex items-center gap-2">جاري المعالجة...</span>
                                        ) : (
                                            <><span>حفظ النتائج نهائياً</span> <span>💾</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ==========================================
                            العمود الأيسر: قائمة المواد والفلترة
                        ========================================== */}
                        <div className="xl:col-span-8 space-y-6 order-2 xl:order-none">
                            
                            {/* منتقي السنة والفصل - واجهة احترافية ثابتة */}
                            <div className="bg-white/95 rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900">تصفية حسب السنة والفصل</h3>
                                        <p className="text-xs text-slate-500 mt-1">ابدأ بدون قيمة مسبقة ثم اختر السنة والفصل الذي تريده.</p>
                                    </div>
                                    <button
                                        onClick={() => handleYearChange('')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                                            !hasYearFilter
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        عرض الكل ({courses.length})
                                    </button>
                                </div>

                                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-600">السنة الدراسية</span>
                                        <div className="relative">
                                            <select
                                                value={selectedYear}
                                                onChange={(e) => handleYearChange(e.target.value)}
                                                className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pl-10 text-sm font-bold text-slate-800 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
                                            >
                                                <option value="">اختر السنة</option>
                                                {yearOptions.map((year) => (
                                                    <option key={year.value} value={year.value}>{year.label}</option>
                                                ))}
                                            </select>
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
                                        </div>
                                    </label>

                                    <label className="block">
                                        <span className="mb-2 block text-xs font-bold text-slate-600">الفصل الدراسي</span>
                                        <div className="relative">
                                            <select
                                                value={selectedTerm}
                                                onChange={(e) => handleTermChange(e.target.value)}
                                                disabled={!selectedYear}
                                                className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pl-10 text-sm font-bold text-slate-800 shadow-sm transition-all focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                            >
                                                <option value="">اختر الفصل</option>
                                                {availableTermsForYear.map((term) => (
                                                    <option key={term} value={term}>{termOptions.find((item) => item.value === term)?.label || termLabel(term)}</option>
                                                ))}
                                            </select>
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">▾</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* قائمة المواد */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-sm">📝</span>
                                        {!hasYearFilter ? 'جميع المواد المنجزة' : hasTermFilter ? `مواد السنة ${selectedYear} - ${termLabel(parseInt(selectedTerm, 10))}` : `مواد السنة ${selectedYear}`}
                                    </h3>
                                </div>
                                
                                <div className="divide-y divide-slate-100">
                                    {filteredCourses.map((course) => (
                                        <div 
                                            key={course.id} 
                                            className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-50/80 transition-colors"
                                        >
                                            <div className="flex items-start sm:items-center gap-4 flex-1">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 shadow-sm ${course.type === 'compulsory' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                    {course.credit_hours}س
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-black text-slate-800 mb-2 text-base leading-tight pr-2">{course.name}</h4>
                                                    
                                                    {/* UI اختيار الفصل والكود */}
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase bg-white border border-slate-200 px-2 py-1 rounded-lg shadow-sm">
                                                            {course.code}
                                                        </span>

                                                        <div className="relative flex items-center">
                                                            <select
                                                                value={course.localYear}
                                                                onChange={(e) => handleStudySlotChange(course.id, 'year', e.target.value)}
                                                                className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg px-3 py-1 pr-7 hover:bg-indigo-100 transition-colors cursor-pointer focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                            >
                                                                {yearOptions.map((year) => (
                                                                    <option key={year.value} value={year.value} className="font-sans">{year.label}</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                                                <svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                                            </div>
                                                        </div>

                                                        <div className="relative flex items-center">
                                                            <select
                                                                value={course.localTerm}
                                                                onChange={(e) => handleStudySlotChange(course.id, 'term', e.target.value)}
                                                                className="appearance-none bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg px-3 py-1 pr-7 hover:bg-emerald-100 transition-colors cursor-pointer focus:ring-2 focus:ring-emerald-500/20 outline-none"
                                                            >
                                                                {termOptions.map((term) => (
                                                                    <option key={term.value} value={term.value} className="font-sans">{term.label}</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                                                <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                            
                                            {/* إدخال العلامة */}
                                            <div className="relative w-full sm:w-32 shrink-0">
                                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                                                    <span className={`text-sm font-bold ${getGradeColor(course.pivot?.grade).split(' ')[0]}`}>%</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    min="35" max="100"
                                                    value={course.pivot?.grade || ''}
                                                    onChange={(e) => handleGradeChange(course.id, e.target.value)}
                                                    placeholder="---"
                                                    className={`w-full h-14 rounded-2xl border-2 text-center text-xl font-black transition-all pl-4 pr-10 outline-none ${getGradeColor(course.pivot?.grade)}`}
                                                />
                                                <span className="absolute -top-2.5 right-6 bg-white px-2 text-[10px] font-black text-slate-500 border border-slate-200 rounded-md shadow-sm">
                                                    العلامة
                                                </span>
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
                </div>
            </div>
            
            {/* قمت بحذف جميع اكواد الأنيميشن المزعجة من الـ CSS لإيقاف الاختفاء */}
            <style dangerouslySetInnerHTML={{ __html: '::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }' }} />
        </MainLayout>
    );
}