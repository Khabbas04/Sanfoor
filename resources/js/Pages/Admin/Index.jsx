import React, { useState, useMemo } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';

export default function AdminIndex({ courses, majors, logs, colleges }) {
    
    // --- 1. إدارة الحالة (State Management) ---
    const [activeTab, setActiveTab] = useState('plan'); 
    const [selectedIds, setSelectedIds] = useState([]); 
    const [selectedCollege, setSelectedCollege] = useState(''); 
    const [searchQuery, setSearchQuery] = useState(''); // محرك البحث

    // --- 2. فورم الإضافة اليدوية (بدون فصل + مع متطلب) ---
    const { data, setData, post, processing, reset, errors } = useForm({
        name: '', 
        code: '', 
        credit_hours: 3, 
        type: 'compulsory', 
        prerequisite_id: '', // إضافة متطلب سابق يدوياً
        major_id: ''
    });

    // --- 3. فورم استيراد CSV ---
    const { data: fileData, setData: setFileData, post: postFile, processing: fileProcessing, errors: fileErrors } = useForm({
        csv_file: null,
        major_id: '',
    });

    // --- 4. العمليات (Actions) ---
    const handleManualSubmit = (e) => { 
        e.preventDefault(); 
        post(route('admin.courses.store'), { 
            onSuccess: () => {
                reset();
                Swal.fire({ icon: 'success', title: 'تمت الإضافة', timer: 1500, showConfirmButton: false });
            } 
        }); 
    };

    const handleImportSubmit = (e) => { 
        e.preventDefault(); 
        postFile(route('admin.courses.import'), {
            onSuccess: () => Swal.fire('تم الاستيراد!', 'تم بناء روابط الشجرة بنجاح.', 'success')
        }); 
    };

    const handleBulkDelete = () => {
        Swal.fire({
            title: 'هل أنت متأكد؟',
            text: `سيتم حذف ${selectedIds.length} مادة نهائياً!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('admin.courses.bulk_delete'), { ids: selectedIds }, {
                    onSuccess: () => setSelectedIds([])
                });
            }
        });
    };

    // --- 5. الفلترة والبحث الذكي ---
    const filteredMajors = majors.filter(m => m.college_id == selectedCollege);

    const filteredCourses = useMemo(() => {
        return courses.filter(c => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            c.code.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, courses]);

    return (
        <AdminLayout>
            <Head title="إدارة المواد - مرشد سنفور" />
            
            {/* استدعاء خط Cairo */}
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'); body { font-family: 'Cairo', sans-serif; }`}</style>

            <div className="p-6 bg-gray-50 min-h-screen">
                
                {/* الرأس الهيدر */}
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">إدارة المواد الأكاديمية</h1>
                        <p className="text-slate-500 mt-1">التحكم في الخطة الدراسية، المتطلبات، وسجلات النظام.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveTab('plan')} className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'plan' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border'}`}>📚 الخطة الدراسية</button>
                        <button onClick={() => setActiveTab('logs')} className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 border'}`}>🕵️ سجل العمليات</button>
                    </div>
                </div>

                {activeTab === 'plan' && (
                    <div className="space-y-6">
                        
                        {/* 1. قسم الرفع الذكي */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-4">🚀 استيراد خطة من ملف CSV</h2>
                                <form onSubmit={handleImportSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div>
                                        <label className="block text-xs font-bold mb-1 opacity-80">الكلية</label>
                                        <select className="w-full rounded-xl border-none text-slate-800 font-bold p-2.5" value={selectedCollege} onChange={e => setSelectedCollege(e.target.value)}>
                                            <option value="">-- اختر الكلية --</option>
                                            {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1 opacity-80">التخصص</label>
                                        <select className="w-full rounded-xl border-none text-slate-800 font-bold p-2.5" value={fileData.major_id} onChange={e => setFileData('major_id', e.target.value)} disabled={!selectedCollege}>
                                            <option value="">-- اختر التخصص --</option>
                                            {filteredMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold mb-1 opacity-80">اختر الملف</label>
                                        <input type="file" onChange={e => setFileData('csv_file', e.target.files[0])} className="w-full bg-white/20 rounded-xl p-1.5 border border-white/30 text-sm file:bg-white file:rounded-lg file:border-0 file:px-3 file:py-1 file:font-bold file:text-blue-700 cursor-pointer" />
                                    </div>
                                    <button type="submit" disabled={fileProcessing || !fileData.major_id} className="bg-white text-blue-700 h-11 rounded-xl font-black hover:bg-slate-100 transition-transform active:scale-95 disabled:opacity-50">رفع وبناء الشجرة</button>
                                </form>
                            </div>
                            <div className="absolute top-0 right-0 opacity-10 text-[10rem] translate-x-1/4 -translate-y-1/4 select-none">📊</div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            
                            {/* 2. الإضافة اليدوية (الجانب) */}
                            <div className="lg:col-span-4 bg-white p-6 rounded-[1.5rem] border border-slate-200 shadow-sm sticky top-6 h-fit">
                                <h3 className="text-lg font-black text-slate-800 mb-6 border-r-4 border-blue-600 pr-3">✍️ مادة جديدة</h3>
                                <form onSubmit={handleManualSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input type="text" placeholder="الرمز (CS101)" className="rounded-xl border-slate-200 w-full" value={data.code} onChange={e => setData('code', e.target.value)} />
                                        <input type="number" placeholder="ساعات" className="rounded-xl border-slate-200 w-full" value={data.credit_hours} onChange={e => setData('credit_hours', e.target.value)} />
                                    </div>
                                    <input type="text" placeholder="اسم المادة" className="rounded-xl border-slate-200 w-full" value={data.name} onChange={e => setData('name', e.target.value)} />
                                    
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mr-1 mb-1 block">التخصص المتبع</label>
                                        <select className="w-full rounded-xl border-slate-200" value={data.major_id} onChange={e => setData('major_id', e.target.value)}>
                                            <option value="">-- متطلب جامعة / مشترك --</option>
                                            {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-400 mr-1 mb-1 block">المتطلب السابق (اختياري)</label>
                                        <select className="w-full rounded-xl border-slate-200" value={data.prerequisite_id} onChange={e => setData('prerequisite_id', e.target.value)}>
                                            <option value="">بدون متطلب سابق</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <label className="flex-1 cursor-pointer">
                                            <input type="radio" className="hidden peer" name="type" value="compulsory" checked={data.type === 'compulsory'} onChange={e => setData('type', e.target.value)} />
                                            <div className="text-center p-2 rounded-xl border peer-checked:bg-blue-50 peer-checked:border-blue-600 peer-checked:text-blue-700 font-bold transition-all">إجباري</div>
                                        </label>
                                        <label className="flex-1 cursor-pointer">
                                            <input type="radio" className="hidden peer" name="type" value="elective" checked={data.type === 'elective'} onChange={e => setData('type', e.target.value)} />
                                            <div className="text-center p-2 rounded-xl border peer-checked:bg-green-50 peer-checked:border-green-600 peer-checked:text-green-700 font-bold transition-all">اختياري</div>
                                        </label>
                                    </div>

                                    <button type="submit" disabled={processing} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-black transition shadow-lg active:scale-95">حفظ المادة</button>
                                </form>
                            </div>

                            {/* 3. عرض المواد وبحث */}
                            <div className="lg:col-span-8 space-y-4">
                                <div className="bg-white p-4 rounded-2xl border flex items-center gap-4 shadow-sm">
                                    <div className="relative flex-1">
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                        <input 
                                            type="text" 
                                            placeholder="ابحث برمز المادة أو اسمها..." 
                                            className="w-full pr-10 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <a href={route('admin.courses.export')} className="p-2.5 bg-green-50 text-green-700 rounded-xl border border-green-100 hover:bg-green-100 transition shadow-sm font-bold text-sm">📊 Excel</a>
                                        {selectedIds.length > 0 && (
                                            <button onClick={handleBulkDelete} className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-600 hover:text-white transition font-bold text-sm">🗑️ حذف ({selectedIds.length})</button>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    <table className="w-full text-right">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="p-4 w-10">
                                                    <input type="checkbox" className="rounded-md border-slate-300" onChange={(e) => e.target.checked ? setSelectedIds(courses.map(c => c.id)) : setSelectedIds([])} />
                                                </th>
                                                <th className="p-4 font-black text-slate-500 text-xs">المادة</th>
                                                <th className="p-4 font-black text-slate-500 text-xs">التخصص</th>
                                                <th className="p-4 font-black text-slate-500 text-xs">المتطلب السابق</th>
                                                <th className="p-4 font-black text-slate-500 text-xs">النوع</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredCourses.map(course => (
                                                <tr key={course.id} className="hover:bg-blue-50/20 transition-colors group">
                                                    <td className="p-4">
                                                        <input type="checkbox" className="rounded-md border-slate-300" checked={selectedIds.includes(course.id)} onChange={() => setSelectedIds(prev => prev.includes(course.id) ? prev.filter(i => i !== course.id) : [...prev, course.id])} />
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{course.name}</div>
                                                        <div className="text-[10px] font-mono text-slate-400">{course.code} | {course.credit_hours} ساعات</div>
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-slate-500">
                                                        {course.major ? <span className="bg-slate-100 px-2 py-0.5 rounded-md">{course.major.code}</span> : <span className="text-slate-300">متطلب عام</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        {course.prerequisites && course.prerequisites.length > 0 ? (
                                                            course.prerequisites.map(pre => (
                                                                <span key={pre.id} className="inline-block bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-orange-100 ml-1">
                                                                    🔗 {pre.code}
                                                                </span>
                                                            ))
                                                        ) : <span className="text-slate-300 text-xs">-</span>}
                                                    </td>
                                                    <td className="p-4">
                                                        {course.type === 'compulsory' 
                                                            ? <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">إجباري تخصص</span>
                                                            : <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">اختياري جامعة</span>
                                                        }
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredCourses.length === 0 && (
                                        <div className="p-20 text-center text-slate-400 italic">لا توجد مواد تطابق بحثك...</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                            <h2 className="font-black text-slate-800">🕵️ سجل النشاطات الأخير</h2>
                            <span className="text-xs text-slate-400 font-bold">آخر 50 حركة</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-slate-400 text-xs font-black">
                                    <tr>
                                        <th className="p-4">الوقت</th>
                                        <th className="p-4">بواسطة</th>
                                        <th className="p-4">الحركة</th>
                                        <th className="p-4">التفاصيل</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-slate-400 font-mono text-xs">{new Date(log.created_at).toLocaleString('en-GB')}</td>
                                            <td className="p-4 font-bold text-slate-700">{log.user?.name}</td>
                                            <td className="p-4"><span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-bold text-[10px]">{log.action}</span></td>
                                            <td className="p-4 text-slate-500">{log.details}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}