import React from 'react';
import { useForm, Link } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';

export default function MajorForm({ major, colleges }) {
    const isEditing = !!major;
    const { data, setData, post, put, processing, errors } = useForm({
        name: major?.name ?? '',
        code: major?.code ?? '',
        college_id: major?.college_id ?? '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            put(route('admin.majors.update', major.id));
        } else {
            post(route('admin.majors.store_new'));
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-violet-600 to-indigo-600" />
                    <div className="p-8">
                        <h1 className="text-3xl font-black text-slate-900 mb-2">
                            {isEditing ? 'تعديل التخصص' : 'إضافة تخصص جديد'}
                        </h1>
                        <p className="text-sm font-bold text-slate-500 mb-8">
                            {isEditing ? 'تحديث بيانات التخصص الأكاديمي.' : 'إضافة تخصص أكاديمي جديد إلى الهيكل الجامعي.'}
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* College Selection */}
                            <div>
                                <label className="block text-sm font-black text-slate-700 mb-2">
                                    الكلية التابع لها *
                                </label>
                                <select
                                    value={data.college_id}
                                    onChange={(e) => setData('college_id', e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-4 focus:ring-violet-100 focus:border-violet-400 outline-none font-bold text-slate-700 appearance-none bg-slate-50"
                                    required
                                >
                                    <option value="">-- اختر الكلية --</option>
                                    {colleges.map((college) => (
                                        <option key={college.id} value={college.id}>
                                            {college.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.college_id && (
                                    <p className="text-rose-600 text-xs font-bold mt-2">{errors.college_id}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Major Name */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-black text-slate-700 mb-2">
                                        اسم التخصص *
                                    </label>
                                    <input
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="مثال: هندسة البرمجيات"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-4 focus:ring-violet-100 focus:border-violet-400 outline-none font-bold text-slate-700 bg-slate-50"
                                        required
                                    />
                                    {errors.name && (
                                        <p className="text-rose-600 text-xs font-bold mt-2">{errors.name}</p>
                                    )}
                                </div>

                                {/* Major Code */}
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-black text-slate-700 mb-2">
                                        رمز التخصص *
                                    </label>
                                    <input
                                        type="text"
                                        value={data.code}
                                        onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                        placeholder="SWE"
                                        dir="ltr"
                                        className="w-full px-4 py-3 border border-slate-300 rounded-2xl focus:ring-4 focus:ring-violet-100 focus:border-violet-400 outline-none font-black text-center uppercase text-slate-700 bg-slate-50"
                                        required
                                    />
                                    {errors.code && (
                                        <p className="text-rose-600 text-xs font-bold mt-2">{errors.code}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="flex-1 px-6 py-4 bg-violet-600 text-white rounded-2xl hover:bg-violet-700 transition-all font-black shadow-lg shadow-violet-200 disabled:opacity-50"
                                >
                                    {processing ? 'جاري الحفظ...' : isEditing ? 'تحديث التخصص' : 'إضافة التخصص'}
                                </button>
                                <Link
                                    href={route('admin.majors.index')}
                                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all text-center font-black"
                                >
                                    إلغاء
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
