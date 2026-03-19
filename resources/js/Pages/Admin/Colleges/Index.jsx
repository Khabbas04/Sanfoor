import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';

export default function CollegesIndex({ colleges }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredColleges = colleges.filter(college =>
        college.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        college.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const withImages = colleges.filter((college) => Boolean(college.image_url)).length;
    const withServices = colleges.filter((college) => Array.isArray(college.services) && college.services.length > 0).length;

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">بطاقات الكليات</h1>
                            <p className="text-sm text-slate-600 font-bold mt-2">إدارة عرض الكليات للطلاب بطريقة واضحة وحديثة.</p>
                        </div>
                        <Link
                            href={route('admin.colleges.create')}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition shadow-sm font-black"
                        >
                            <span>+</span>
                            <span>إضافة كلية</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                        <div className="rounded-2xl bg-white border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-black">إجمالي الكليات</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{colleges.length}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-black">الكليات مع صور</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{withImages}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-black">الكليات مع خدمات</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{withServices}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <input
                        type="text"
                        placeholder="ابحث عن كلية بالاسم أو الوصف..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none font-bold text-slate-700"
                    />
                </div>

                {filteredColleges.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredColleges.map((college) => (
                            <article
                                key={college.id}
                                className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className="h-2 bg-gradient-to-r from-indigo-500 to-cyan-500" />
                                <div className="p-5 space-y-4">
                                    {college.image_url ? (
                                        <img
                                            src={college.image_url}
                                            alt={college.name}
                                            className="w-full h-44 object-cover rounded-2xl border border-slate-200"
                                        />
                                    ) : (
                                        <div className="w-full h-44 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 font-black">
                                            لا توجد صورة
                                        </div>
                                    )}

                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">{college.name}</h3>
                                        {college.university?.name && (
                                            <p className="text-sm text-slate-500 font-bold mt-1">🏫 {college.university.name}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2 text-sm text-slate-700 font-bold">
                                        {college.building_symbol && <p>🔠 الرمز: {college.building_symbol}</p>}
                                        {college.building_location && <p>📍 الموقع: {college.building_location}</p>}
                                    </div>

                                    {college.description && (
                                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{college.description}</p>
                                    )}

                                    {college.services && college.services.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {college.services.slice(0, 4).map((service, idx) => (
                                                <span key={idx} className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 text-xs rounded-lg font-black border border-indigo-100">
                                                    {service}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <Link
                                            href={route('admin.colleges.edit', college.id)}
                                            className="px-3 py-2.5 bg-amber-500 text-white text-sm rounded-xl hover:bg-amber-600 transition text-center font-black"
                                        >
                                            تعديل
                                        </Link>
                                        <button
                                            onClick={() => {
                                                if (confirm('هل تريد حذف هذه الكلية؟')) {
                                                    router.delete(route('admin.colleges.destroy', college.id));
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
                        <p className="text-slate-500 font-black text-lg">لا توجد كليات مطابقة للبحث.</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
