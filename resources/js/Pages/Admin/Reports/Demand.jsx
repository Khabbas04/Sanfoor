import React from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Demand({ 
    auth, 
    courseDemand = [], // 🔥 إضافة قيمة افتراضية لحماية الكود
    totalStudents = 0, // 🔥 إضافة قيمة افتراضية
    colleges = [], 
    majors = [], 
    filters = {}       // 🔥 إضافة قيمة افتراضية
}) {
    const [selectedCollege, setSelectedCollege] = React.useState(filters.college_id || '');
    const [selectedMajor, setSelectedMajor] = React.useState(filters.major_id || '');
    const [query, setQuery] = React.useState('');

    const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'];

    const applyFilter = (collegeId, majorId) => {
        router.get(route('admin.reports.demand'), 
            { college_id: collegeId, major_id: majorId }, 
            { preserveState: true, replace: true }
        );
    };

    const getProgressColor = (count) => {
        if (totalStudents === 0) return 'from-indigo-600 to-violet-500'; // منع القسمة على صفر
        const percentage = (count / totalStudents) * 100;
        if (percentage > 50) return 'from-rose-500 to-orange-500';
        if (percentage > 25) return 'from-amber-500 to-yellow-400';
        return 'from-indigo-600 to-violet-500';
    };

    // 🔥 التأكد من وجود بيانات قبل محاولة استخراج الاسم
    const topCourseName = courseDemand.length > 0 ? courseDemand[0].name : 'لا توجد بيانات';

    const visibleCourses = React.useMemo(() => {
        if (!query) return courseDemand;
        const q = query.toLowerCase();
        return courseDemand.filter((course) => {
            const name = String(course.name || '').toLowerCase();
            const code = String(course.code || '').toLowerCase();
            return name.includes(q) || code.includes(q);
        });
    }, [courseDemand, query]);

    return (
        <AdminLayout user={auth.user}>
            <Head title="تحليل طلب المواد - Admin" />

            <div className="py-8 bg-[#f8fafc] min-h-screen font-sans" dir="rtl">
                <div className="max-w-7xl mx-auto px-4">
                    
                    <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-4">
                                <span className="p-3 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-100 text-white transition-transform hover:scale-110">🤖</span> 
                                تحليلات سنفور الذكية
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-bold mt-3 mr-2 text-sm leading-relaxed">
                                تتبع رغبات الطلاب في "المحاكي" لتوقع احتياجات الفصل القادم وفتح الشعب المناسبة.
                            </p>
                        </div>
                        
                        <div className="flex gap-3">
                            <span className="px-4 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl text-xs font-black animate-pulse flex items-center gap-2">
                                <span className="w-2 h-2 bg-current rounded-full"></span> تحديث مباشر (Live)
                            </span>
                            <button onClick={() => window.print()} className="px-6 py-3 bg-slate-100 dark:bg-white/5 rounded-2xl font-black text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all flex items-center gap-2 active:scale-95">
                                <span>🖨️</span> طباعة التقرير
                            </button>
                        </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 shadow-sm mb-10">
                        <div className="flex flex-wrap gap-6 items-end text-right">
                            <div className="flex-1 min-w-[250px]">
                                <label className="text-[10px] font-black text-indigo-500 block mb-3 mr-3 uppercase tracking-widest">فرز حسب الكلية</label>
                                <select 
                                    value={selectedCollege}
                                    onChange={(e) => {
                                        setSelectedCollege(e.target.value);
                                        setSelectedMajor(''); 
                                        applyFilter(e.target.value, '');
                                    }}
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl py-4 px-5 font-black text-sm transition-all outline-none text-slate-700 shadow-inner"
                                >
                                    <option value="">جميع كليات الجامعة</option>
                                    {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="flex-1 min-w-[250px]">
                                <label className="text-[10px] font-black text-indigo-500 block mb-3 mr-3 uppercase tracking-widest">فرز حسب التخصص</label>
                                <select 
                                    value={selectedMajor}
                                    onChange={(e) => {
                                        setSelectedMajor(e.target.value);
                                        applyFilter(selectedCollege, e.target.value);
                                    }}
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl py-4 px-5 font-black text-sm transition-all outline-none text-slate-700 shadow-inner"
                                >
                                    <option value="">جميع تخصصات الكلية</option>
                                    {majors
                                        .filter(m => !selectedCollege || m.college_id == selectedCollege)
                                        .map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                                    }
                                </select>
                            </div>

                            <button 
                                onClick={() => { setSelectedCollege(''); setSelectedMajor(''); applyFilter('', ''); }}
                                className="px-8 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                            >
                                إعادة ضبط
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                        <div className="lg:col-span-8 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
                            <div className="mb-8 flex justify-between items-center text-right">
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">توقعات الطلب على المواد</h2>
                                    <p className="text-xs text-slate-400 font-bold mt-1">المواد الـ 10 الأكثر رغبة حسب محاكاة الطلاب</p>
                                </div>
                            </div>
                            
                            {/* 🔥 حماية للرسم البياني لتجنب الأخطاء إذا كانت البيانات فارغة */}
                            {courseDemand && courseDemand.length > 0 ? (
                                <div className="h-[400px] w-full" dir="ltr">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={courseDemand.slice(0, 10)} layout="vertical" margin={{ right: 30, left: 30 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.1} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                                            <Tooltip 
                                                cursor={{fill: 'rgba(99, 102, 241, 0.05)'}}
                                                contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                            />
                                            <Bar dataKey="cart_users_count" radius={[0, 10, 10, 0]} barSize={30}>
                                                {courseDemand.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[400px] flex items-center justify-center text-slate-400 font-bold">لا توجد بيانات للرسم البياني</div>
                            )}
                        </div>

                        <div className="lg:col-span-4 flex flex-col gap-6 text-right">
                            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-500/20">
                                <h3 className="text-xl font-black mb-4 flex items-center gap-2"><span>💡</span> توصية سنفور</h3>
                                <div className="space-y-4 text-sm font-bold opacity-90 leading-relaxed">
                                    <p>بناءً على نشاط الطلاب الأخير، ننصح بفتح شعب إضافية للمواد المتصدرة لتجنب الازدحام.</p>
                                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                                        <span className="block text-[10px] uppercase opacity-60 mb-1 tracking-widest text-right">أعلى مادة طلباً</span>
                                        {/* 🔥 استخدام المتغير المحمي */}
                                        <span className="text-lg block text-right font-black">{topCourseName}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex-1">
                                <h4 className="font-black text-slate-800 mb-4">إجمالي الطلاب المشاركين</h4>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-indigo-600 leading-none">{totalStudents}</span>
                                    <span className="text-sm font-bold text-slate-400">طالب فاعِل</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-4 font-medium leading-relaxed">هذه البيانات مستمدة من 100% من محاكيات الطلاب الحالية في جامعة الزرقاء.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden relative">
                        <div className="p-10 border-b dark:border-white/5 flex justify-between items-center text-right">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">قائمة المواد المفصلة (الـ 15 الأعلى)</h2>
                            <div className="flex gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تحديث لحظي</span>
                            </div>
                        </div>

                        <div className="p-10">
                            <div className="mb-6">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="بحث باسم المادة أو الرمز..."
                                    className="w-full max-w-md rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="space-y-10">
                                {visibleCourses && visibleCourses.length > 0 ? (
                                    visibleCourses.map((course, index) => {
                                        const percentage = totalStudents > 0 ? ((course.cart_users_count / totalStudents) * 100).toFixed(1) : 0;
                                        return (
                                            <div key={course.id || index} className="relative group/item text-right">
                                                <div className="flex justify-between items-end mb-4 px-2">
                                                    <div className="flex items-center gap-4 flex-row-reverse">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border dark:border-white/5 flex items-center justify-center text-xs font-black text-slate-400 group-hover/item:bg-indigo-600 group-hover/item:text-white transition-all duration-500">
                                                            {index + 1}
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-black text-indigo-400 block mb-0.5 uppercase tracking-tighter">{course.code}</span>
                                                            <h3 className="font-black text-slate-800 text-base">{course.name}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="flex items-baseline gap-1.5 justify-end">
                                                            <span className="text-2xl font-black text-slate-900 leading-none">{course.cart_users_count}</span>
                                                            <span className="text-[11px] text-slate-400 font-bold uppercase">طالب</span>
                                                        </div>
                                                        <p className="text-[10px] font-black text-indigo-500 mt-1">{percentage}% من إجمالي المحاكاة</p>
                                                    </div>
                                                </div>

                                                <div className="w-full h-5 bg-slate-50 rounded-2xl overflow-hidden flex p-1 border border-slate-200 shadow-inner">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 rounded-xl bg-gradient-to-r shadow-lg ${getProgressColor(course.cart_users_count)}`}
                                                        style={{ width: `${percentage}%`, minWidth: '2%' }}
                                                    >
                                                        <div className="w-full h-full bg-white/20 animate-shine"></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="py-32 text-center flex flex-col items-center">
                                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-6 border-2 border-dashed border-slate-200 opacity-50">🏜️</div>
                                        <p className="text-slate-400 font-black text-lg">لا توجد بيانات لهذه الفئة حالياً</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shine {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }
                .animate-shine {
                    animation: shine 2s infinite linear;
                }
            ` }} />
        </AdminLayout>
    );
}