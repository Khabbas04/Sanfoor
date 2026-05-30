import MainLayout from '@/Layouts/MainLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useMemo } from 'react';

export default function InstructorStudents({ auth, students = {}, colleges = [], majors = [], filters = {} }) {
    const [search, setSearch] = useState(filters.search || '');
    const [collegeId, setCollegeId] = useState(filters.college_id || '');
    const [majorId, setMajorId] = useState(filters.major_id || '');

    const filteredMajors = useMemo(() => {
        if (!collegeId) return majors;
        return majors.filter(m => String(m.college_id) === String(collegeId));
    }, [majors, collegeId]);

    const applyFilters = () => {
        router.get(route('instructor.students'), {
            search: search || undefined,
            college_id: collegeId || undefined,
            major_id: majorId || undefined,
        }, { preserveState: true, preserveScroll: true });
    };

    const resetFilters = () => {
        setSearch(''); setCollegeId(''); setMajorId('');
        router.get(route('instructor.students'), {}, { preserveState: true });
    };

    const data = students.data || [];
    const links = students.links || [];

    return (
        <MainLayout user={auth.user}>
            <Head>
                <title>الطلاب | الكادر التدريسي | سنفور</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>

            <div className="py-6 sm:py-8 min-h-screen" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-[900] text-slate-800">👥 عرض الطلاب</h1>
                        <p className="text-slate-500 font-bold text-sm mt-1">تصفح جميع الطلاب المسجلين في منصة سنفور</p>
                    </div>

                    {/* Filters */}
                    <div className="bg-white border border-slate-100 rounded-[1.6rem] p-5 shadow-sm mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                                placeholder="بحث بالاسم أو الإيميل..."
                                className="border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-teal-500 focus:border-teal-500"
                            />
                            <select value={collegeId} onChange={e => { setCollegeId(e.target.value); setMajorId(''); }} className="border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-teal-500 focus:border-teal-500">
                                <option value="">جميع الكليات</option>
                                {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={majorId} onChange={e => setMajorId(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-teal-500 focus:border-teal-500">
                                <option value="">جميع التخصصات</option>
                                {filteredMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            <div className="flex gap-2">
                                <button onClick={applyFilters} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-sm py-3 transition-all">🔍 بحث</button>
                                <button onClick={resetFilters} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm py-3 transition-all">مسح</button>
                            </div>
                        </div>
                    </div>

                    {/* Students Table */}
                    <div className="bg-white border border-slate-100 rounded-[1.6rem] shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3.5 text-[11px] font-black text-slate-400 uppercase">الاسم</th>
                                        <th className="px-4 py-3.5 text-[11px] font-black text-slate-400 uppercase">البريد</th>
                                        <th className="px-4 py-3.5 text-[11px] font-black text-slate-400 uppercase hidden md:table-cell">الكلية</th>
                                        <th className="px-4 py-3.5 text-[11px] font-black text-slate-400 uppercase hidden md:table-cell">التخصص</th>
                                        <th className="px-4 py-3.5 text-[11px] font-black text-slate-400 uppercase hidden lg:table-cell">تاريخ التسجيل</th>
                                        <th className="px-4 py-3.5 text-[11px] font-black text-slate-400 uppercase hidden lg:table-cell">آخر دخول</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map(student => (
                                        <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50/50 last:border-b-0 transition-colors">
                                            <td className="px-4 py-3.5 font-bold text-slate-800 text-[13px]">{student.name}</td>
                                            <td className="px-4 py-3.5 text-slate-500 text-[12px] font-bold" dir="ltr">{student.email}</td>
                                            <td className="px-4 py-3.5 text-slate-500 text-[12px] font-bold hidden md:table-cell">{student.college}</td>
                                            <td className="px-4 py-3.5 hidden md:table-cell">
                                                <span className="bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-lg text-[10px] font-bold text-teal-700">{student.major}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-400 text-[11px] font-bold hidden lg:table-cell">{student.created_at}</td>
                                            <td className="px-4 py-3.5 text-slate-400 text-[11px] font-bold hidden lg:table-cell">{student.last_login}</td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr><td colSpan="6" className="text-center py-12 text-slate-400 font-bold text-sm">لا توجد نتائج مطابقة</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {links.length > 3 && (
                            <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-1 flex-wrap">
                                {links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${link.active ? 'bg-teal-600 text-white' : link.url ? 'bg-slate-50 text-slate-600 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
