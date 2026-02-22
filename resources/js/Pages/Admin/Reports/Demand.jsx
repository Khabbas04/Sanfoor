import React from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';

export default function Demand({ auth, courseDemand, totalStudents, colleges = [], majors = [], filters }) {
    const [selectedCollege, setSelectedCollege] = React.useState(filters.college_id || '');
    const [selectedMajor, setSelectedMajor] = React.useState(filters.major_id || '');

    // دالة تطبيق الفلترة ونقل المستخدم للمسار الجديد
    const applyFilter = (collegeId, majorId) => {
        router.get(route('admin.reports.demand'), 
            { college_id: collegeId, major_id: majorId }, 
            { preserveState: true, replace: true }
        );
    };

    const getProgressColor = (count) => {
        const percentage = (count / totalStudents) * 100;
        if (percentage > 50) return 'from-rose-500 to-orange-500';
        if (percentage > 25) return 'from-amber-500 to-yellow-400';
        return 'from-indigo-600 to-violet-500';
    };

    return (
        <AdminLayout user={auth.user}>
            <Head title="تحليل طلب المواد - Admin" />

            <div className="py-8 bg-[#f8fafc] min-h-screen" dir="rtl">
                <div className="max-w-7xl mx-auto px-4">
                    
                    {/* Header Section */}
                    <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                                <span className="p-3 bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-slate-100 transition-transform hover:scale-110">📊</span> 
                                تحليل طلب المواد
                            </h1>
                            <p className="text-slate-400 font-bold mt-3 mr-2 text-sm leading-relaxed">
                                تتبع رغبات الطلاب في "المحاكي" لتوقع احتياجات الفصل القادم وفتح الشعب المناسبة.
                            </p>
                        </div>
                        
                        {/* Quick Action Button */}
                        <button onClick={() => window.print()} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 active:scale-95">
                            <span>🖨️</span> طباعة التقرير
                        </button>
                    </div>

                    {/* 🔥 Smart Filters Section 🔥 */}
                    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 shadow-sm mb-10 group transition-all hover:shadow-indigo-100/40">
                        <div className="flex flex-wrap gap-6 items-end">
                            <div className="flex-1 min-w-[250px]">
                                <label className="text-[10px] font-black text-indigo-500 block mb-3 mr-3 uppercase tracking-widest">فرز حسب الكلية</label>
                                <select 
                                    value={selectedCollege}
                                    onChange={(e) => {
                                        setSelectedCollege(e.target.value);
                                        setSelectedMajor(''); 
                                        applyFilter(e.target.value, '');
                                    }}
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl py-4 px-5 font-black text-sm transition-all outline-none text-slate-700 shadow-inner"
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
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl py-4 px-5 font-black text-sm transition-all outline-none text-slate-700 shadow-inner"
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
                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-indigo-600 transition-all shadow-lg active:scale-95"
                            >
                                إعادة ضبط
                            </button>
                        </div>
                    </div>

                    {/* Data Visualization Section */}
                    <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-l from-indigo-500 via-purple-500 to-pink-500"></div>
                        
                        <div className="p-10 border-b border-slate-50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-slate-800">خارطة المواد الأكثر رغبة (Top 15)</h2>
                            <div className="flex gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تحديث مباشر</span>
                            </div>
                        </div>

                        <div className="p-10">
                            <div className="space-y-10">
                                {courseDemand.map((course, index) => {
                                    const percentage = totalStudents > 0 ? ((course.cart_users_count / totalStudents) * 100).toFixed(1) : 0;
                                    return (
                                        <div key={course.id} className="relative group/item">
                                            <div className="flex justify-between items-end mb-4 px-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-400 group-hover/item:bg-indigo-600 group-hover/item:text-white transition-all duration-500">
                                                        {index + 1}
                                                    </div>
                                                    <div>
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

                                            {/* Heatmap Bar */}
                                            <div className="w-full h-5 bg-slate-50 rounded-2xl overflow-hidden flex p-1 border border-slate-100 shadow-inner">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] rounded-xl bg-gradient-to-r shadow-lg shadow-indigo-100 ${getProgressColor(course.cart_users_count)}`}
                                                    style={{ width: `${percentage}%`, minWidth: '2%' }}
                                                >
                                                    <div className="w-full h-full bg-white/20 animate-shine"></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {courseDemand.length === 0 && (
                                    <div className="py-32 text-center flex flex-col items-center">
                                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-6 grayscale opacity-50 border-2 border-dashed border-slate-200">🏜️</div>
                                        <p className="text-slate-400 font-black text-lg">لا توجد بيانات لهذه الفئة حالياً</p>
                                        <p className="text-slate-300 font-bold text-xs mt-2">جرّب اختيار كلية أو تخصص آخر للبحث عن نتائج.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-center">
                            <div className="max-w-2xl text-center">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                                    هذا التقرير يعتمد على البيانات المدخلة في "محاكي سنفور الأكاديمي" ويتم تحديثه لحظياً لضمان دقة التخطيط للفصل الدراسي القادم.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes shine {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }
                .animate-shine {
                    animation: shine 2s infinite linear;
                }
            `}</style>
        </AdminLayout>
    );
}