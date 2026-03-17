import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';

export default function AdminStructure({ auth, platform = {}, colleges = [], majors = [] }) {
    const {
        data: colData,
        setData: setColData,
        post: postCol,
        processing: colProcessing,
        errors: colErrors,
        reset: resetCol,
    } = useForm({ name: '' });

    const {
        data: majData,
        setData: setMajData,
        post: postMaj,
        processing: majProcessing,
        errors: majErrors,
        reset: resetMaj,
    } = useForm({ name: '', code: '', college_id: '' });

    const handleCollegeSubmit = (e) => {
        e.preventDefault();
        postCol(route('admin.colleges.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetCol('name');
                Swal.fire({ icon: 'success', title: 'تمت الإضافة', text: 'تم حفظ الكلية بنجاح', timer: 1600, showConfirmButton: false });
            },
        });
    };

    const handleMajorSubmit = (e) => {
        e.preventDefault();
        postMaj(route('admin.majors.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetMaj('name', 'code');
                Swal.fire({ icon: 'success', title: 'تمت الإضافة', text: 'تم حفظ التخصص بنجاح', timer: 1600, showConfirmButton: false });
            },
        });
    };

    return (
        <AdminLayout user={auth?.user}>
            <Head title="إدارة الكليات والتخصصات | سنفور" />

            <div className="space-y-8" dir="rtl">
                <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-slate-200">
                    <h1 className="text-2xl font-black text-slate-800 mb-2">🏛️ إدارة الكليات والتخصصات</h1>
                    <p className="text-sm font-bold text-slate-500">صفحة مستقلة لإدارة الهيكل الأكاديمي للجامعة.</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl">الكليات: {platform.colleges_count || 0}</span>
                        <span className="text-xs font-black bg-violet-50 text-violet-700 px-3 py-1 rounded-xl">التخصصات: {platform.majors_count || 0}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">🏛️ إضافة كلية</h3>

                        <form onSubmit={handleCollegeSubmit} className="space-y-4">
                            <div>
                                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">اسم الكلية</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="مثال: كلية تكنولوجيا المعلومات"
                                    value={colData.name}
                                    onChange={(e) => setColData('name', e.target.value)}
                                    required
                                />
                                {colErrors.name && <p className="text-[11px] font-bold text-rose-500 mt-1">{colErrors.name}</p>}
                            </div>

                            <button
                                type="submit"
                                disabled={colProcessing}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black transition-colors"
                            >
                                {colProcessing ? 'جاري الحفظ...' : 'حفظ الكلية'}
                            </button>
                        </form>

                        <div className="mt-5 border-t border-slate-100 pt-4 max-h-60 overflow-y-auto space-y-2">
                            {colleges.map((college) => (
                                <div key={college.id} className="text-[12px] font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                                    {college.name}
                                </div>
                            ))}
                            {colleges.length === 0 && <p className="text-[12px] font-bold text-slate-400">لا توجد كليات مسجلة بعد.</p>}
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-slate-200">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-6">🎓 إضافة تخصص</h3>

                        <form onSubmit={handleMajorSubmit} className="space-y-4">
                            <div>
                                <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">الكلية التابعة</label>
                                <select
                                    className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500"
                                    value={majData.college_id}
                                    onChange={(e) => setMajData('college_id', e.target.value)}
                                    required
                                >
                                    <option value="">-- اختر الكلية --</option>
                                    {colleges.map((college) => (
                                        <option key={college.id} value={college.id}>{college.name}</option>
                                    ))}
                                </select>
                                {majErrors.college_id && <p className="text-[11px] font-bold text-rose-500 mt-1">{majErrors.college_id}</p>}
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">اسم التخصص</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="مثال: علم الحاسوب"
                                        value={majData.name}
                                        onChange={(e) => setMajData('name', e.target.value)}
                                        required
                                    />
                                    {majErrors.name && <p className="text-[11px] font-bold text-rose-500 mt-1">{majErrors.name}</p>}
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[12px] font-bold text-slate-600 mb-1.5 block">الرمز</label>
                                    <input
                                        type="text"
                                        dir="ltr"
                                        className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-black text-center uppercase focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="CS"
                                        value={majData.code}
                                        onChange={(e) => setMajData('code', e.target.value.toUpperCase())}
                                        required
                                    />
                                    {majErrors.code && <p className="text-[11px] font-bold text-rose-500 mt-1">{majErrors.code}</p>}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={majProcessing}
                                className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black transition-colors"
                            >
                                {majProcessing ? 'جاري الحفظ...' : 'حفظ التخصص'}
                            </button>
                        </form>

                        <div className="mt-5 border-t border-slate-100 pt-4 max-h-60 overflow-y-auto space-y-2">
                            {majors.map((major) => (
                                <div key={major.id} className="text-[12px] font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                                    <span>{major.name}</span>
                                    <span dir="ltr" className="text-[10px] text-slate-400 font-black">{major.code}</span>
                                </div>
                            ))}
                            {majors.length === 0 && <p className="text-[12px] font-bold text-slate-400">لا توجد تخصصات مسجلة بعد.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
