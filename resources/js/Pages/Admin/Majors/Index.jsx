import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';

export default function MajorsIndex({ majors }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredMajors = majors.filter(major =>
        major.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        major.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        major.college?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-50 to-violet-50 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">إدارة التخصصات</h1>
                            <p className="text-sm text-slate-600 font-bold mt-2">إدارة كافة التخصصات الأكاديمية وربطها بالكليات المعنية.</p>
                        </div>
                        <Link
                            href={route('admin.majors.create')}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 text-white rounded-2xl hover:bg-violet-700 transition shadow-sm font-black"
                        >
                            <span>+</span>
                            <span>إضافة تخصص</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                        <div className="rounded-2xl bg-white border border-slate-200 p-4 text-center">
                            <p className="text-xs text-slate-500 font-black">إجمالي التخصصات</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{majors.length}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 p-4 text-center">
                            <p className="text-xs text-slate-500 font-black">التخصصات النشطة</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{majors.length}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <input
                        type="text"
                        placeholder="ابحث عن تخصص بالاسم، الرمز، أو الكلية..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-violet-100 focus:border-violet-400 outline-none font-bold text-slate-700"
                    />
                </div>

                {filteredMajors.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredMajors.map((major) => (
                            <article
                                key={major.id}
                                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
                            >
                                <div className="h-2 bg-gradient-to-r from-violet-500 to-indigo-500" />
                                <div className="p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="px-3 py-1 bg-violet-50 text-violet-700 text-[10px] font-black rounded-full border border-violet-100">
                                            {major.college?.name || 'بدون كلية'}
                                        </span>
                                        <span className="text-xs font-black text-slate-400">#{major.id}</span>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">{major.name}</h3>
                                        <p className="text-sm font-black text-indigo-600 mt-1">الرمز: {major.code}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <Link
                                            href={route('admin.majors.edit', major.id)}
                                            className="px-3 py-2.5 bg-amber-500 text-white text-sm rounded-xl hover:bg-amber-600 transition text-center font-black"
                                        >
                                            تعديل
                                        </Link>
                                        <button
                                            onClick={() => {
                                                if (confirm('هل تريد حذف هذا التخصص؟ سيؤدي ذلك إلى حذف كافة المواد والطلاب المرتبطين به.')) {
                                                    router.delete(route('admin.majors.destroy', major.id));
                                                }
                                            }}
                                            className="px-3 py-2.5 bg-rose-500 text-white text-sm rounded-xl hover:bg-rose-600 transition font-black"
                                        >
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                        <p className="text-slate-500 font-black text-lg">لا توجد تخصصات مطابقة للبحث.</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
