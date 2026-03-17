import React, { useState, useMemo } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import Swal from 'sweetalert2';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

export default function Calculator({ auth, initialCourses }) {
    // 1. تهيئة المواد (بدون أي تعقيدات)
    const [courses, setCourses] = useState(() => {
        const coursesArray = Array.isArray(initialCourses) ? initialCourses : [];
        return coursesArray.map(c => ({
            ...c,
            localSemester: parseInt(c.pivot?.studied_semester || c.semester || 1, 10) 
        }));
    });
    
    const [loading, setLoading] = useState(false);
    const [selectedSemester, setSelectedSemester] = useState('all');

    // 2. استخراج الفصول الفريدة
    const semesters = useMemo(() => {
        const sems = new Set(courses.map(c => c.localSemester));
        return Array.from(sems).sort((a, b) => a - b);
    }, [courses]);

    // 3. فلترة المواد المعروضة (حسب الفصل المختار)
    const filteredCourses = useMemo(() => {
        if (!courses || courses.length === 0) return [];
        if (selectedSemester === 'all') return courses;
        
        return courses.filter(c => c.localSemester === parseInt(selectedSemester, 10));
    }, [courses, selectedSemester]);

    // 4. تحديث العلامة (محلياً)
    const handleGradeChange = (id, val) => {
        setCourses(prev => prev.map(c =>
            c.id === id ? { ...c, pivot: { ...c.pivot, grade: val } } : c
        ));
    };

    // 5. تحديث الفصل الدراسي (محلياً)
    const handleSemesterChange = (id, newSem) => {
        const semNumber = parseInt(newSem, 10) || 1;
        setCourses(prev => prev.map(c =>
            c.id === id ? { ...c, localSemester: semNumber } : c
        ));
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
                semester: c.localSemester
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
            
            <div className="py-12 bg-slate-50 min-h-screen relative overflow-hidden" dir="rtl">
                
                {/* خلفية تجميلية */}
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none"></div>
                <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">

                    <div className="mb-12 text-center max-w-2xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-indigo-100 shadow-sm text-indigo-600 text-xs font-black uppercase tracking-widest mb-4">
                            <span>⚡</span> مساحة العمل الأكاديمية
                        </div>
                        <h1 className="text-4xl md:text-5xl font-[900] text-slate-900 mb-4 tracking-tight">حاسبة المعدل الذكية</h1>
                        <p className="text-slate-500 font-bold text-lg leading-relaxed">
                            أدخل علاماتك وتوقع معدلك التراكمي. يمكنك نقل المواد بين الفصول الدراسية لترتيب سجلك الأكاديمي بدقة.
                        </p>
                    </div>

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
                                            يعادل <span className="text-amber-400 font-black">{cumulativeStats.gpa4}</span> من 4.0
                                        </p>
                                    </div>

                                    <div className={`pt-6 border-t border-slate-800 text-center xl:text-right transition-all duration-500 ${selectedSemester !== 'all' ? 'opacity-100 h-auto' : 'opacity-30 grayscale'}`}>
                                        <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2 flex items-center justify-center xl:justify-start gap-2">
                                            <span>📊</span> معدل الفصل {selectedSemester !== 'all' ? `الـ ${selectedSemester}` : 'المحدد'}
                                        </p>
                                        <div className="flex items-baseline justify-center xl:justify-start gap-2">
                                            <h2 className={`text-4xl font-[900] drop-shadow-md tracking-tighter ${selectedSemester !== 'all' ? 'text-white' : 'text-slate-600'}`}>
                                                {selectedSemester !== 'all' ? semesterStats.percentage : '--'}
                                            </h2>
                                            <span className={`text-xl font-bold ${selectedSemester !== 'all' ? 'text-emerald-400' : 'text-slate-600'}`}>%</span>
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
                            
                            {/* شريط التبويبات (Tabs) */}
                            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto flex gap-2">
                                <button 
                                    onClick={() => setSelectedSemester('all')}
                                    className={`px-6 py-3.5 rounded-xl font-black text-sm whitespace-nowrap transition-all ${selectedSemester === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    🌐 عرض الكل ({courses.length})
                                </button>
                                {semesters.map(sem => (
                                    <button 
                                        key={sem}
                                        onClick={() => setSelectedSemester(sem)}
                                        className={`px-6 py-3.5 rounded-xl font-black text-sm whitespace-nowrap transition-all ${selectedSemester === sem ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}
                                    >
                                        الفصل {sem}
                                    </button>
                                ))}
                            </div>

                            {/* قائمة المواد */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="font-black text-slate-800 text-lg flex items-center gap-3">
                                        <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-sm">📝</span>
                                        {selectedSemester === 'all' ? 'جميع المواد المنجزة' : `مواد الفصل ${selectedSemester}`}
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
                                                                value={course.localSemester}
                                                                onChange={(e) => handleSemesterChange(course.id, e.target.value)}
                                                                className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg px-3 py-1 pr-7 hover:bg-indigo-100 transition-colors cursor-pointer focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                            >
                                                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => (
                                                                    <option key={num} value={num} className="font-sans">درسـت في الفصل {num}</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                                                <svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
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