import React, { useState } from 'react';
import { Link, router } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';

const LANDMARK_TYPES = {
    restaurant: { name: 'مطعم', icon: '🍽️', color: 'bg-orange-100 text-orange-800' },
    prayer_room: { name: 'مصلى', icon: '🕌', color: 'bg-green-100 text-green-800' },
    library: { name: 'مكتبة', icon: '📚', color: 'bg-blue-100 text-blue-800' },
    clinic: { name: 'عيادة', icon: '🏥', color: 'bg-red-100 text-red-800' },
    parking: { name: 'موقف سيارات', icon: '🅿️', color: 'bg-yellow-100 text-yellow-800' },
    sports: { name: 'رياضة', icon: '⚽', color: 'bg-purple-100 text-purple-800' },
    shop: { name: 'محل', icon: '🏪', color: 'bg-pink-100 text-pink-800' },
    other: { name: 'أخرى', icon: '📍', color: 'bg-gray-100 text-gray-800' },
};

export default function LandmarksIndex({ landmarks }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');

    const activeCount = landmarks.filter((landmark) => landmark.is_active).length;

    const filteredLandmarks = landmarks.filter(landmark => {
        const matchesSearch =
            landmark.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            landmark.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            landmark.building_location?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = !filterType || landmark.type === filterType;

        return matchesSearch && matchesType;
    });

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-emerald-50 to-cyan-50 p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900">معالم الجامعة</h1>
                            <p className="text-sm text-slate-600 font-bold mt-2">إدارة المطاعم، المصليات، المكتبات، العيادات وباقي خدمات الحرم الجامعي.</p>
                        </div>
                        <Link
                            href={route('admin.landmarks.create')}
                            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition shadow-sm font-black"
                        >
                            <span>+</span>
                            <span>إضافة معلم</span>
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                        <div className="rounded-2xl bg-white border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-black">إجمالي المعالم</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{landmarks.length}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-black">المعالم النشطة</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{activeCount}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 p-4">
                            <p className="text-xs text-slate-500 font-black">حسب الفلتر الحالي</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">{filteredLandmarks.length}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="ابحث بالاسم أو الموقع أو الوصف..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none font-bold text-slate-700"
                    />

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none font-bold text-slate-700"
                    >
                        <option value="">جميع التصنيفات</option>
                        {Object.entries(LANDMARK_TYPES).map(([key, { name }]) => (
                            <option key={key} value={key}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {filteredLandmarks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {filteredLandmarks.map((landmark) => {
                            const typeInfo = LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other;
                            return (
                                <article
                                    key={landmark.id}
                                    className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className="h-2 bg-gradient-to-r from-emerald-500 to-cyan-500" />
                                    <div className="p-5 space-y-4">
                                        <div className="w-full h-36 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center text-5xl">
                                            {landmark.image_url ? (
                                                <img
                                                    src={landmark.image_url}
                                                    alt={landmark.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span>{typeInfo.icon}</span>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-start gap-3">
                                            <h3 className="text-lg font-black text-slate-900 leading-snug">{landmark.name}</h3>
                                            <span className={`px-2 py-1 rounded-lg text-xs font-black ${typeInfo.color}`}>
                                                {typeInfo.name}
                                            </span>
                                        </div>

                                        {landmark.building_location && (
                                            <p className="text-sm text-slate-700 font-bold">📍 {landmark.building_location}</p>
                                        )}

                                        {landmark.description && (
                                            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">{landmark.description}</p>
                                        )}

                                        <div className="flex items-center justify-between">
                                            {landmark.is_active ? (
                                                <span className="inline-flex px-2.5 py-1.5 bg-emerald-100 text-emerald-700 text-xs rounded-lg font-black">نشط</span>
                                            ) : (
                                                <span className="inline-flex px-2.5 py-1.5 bg-slate-200 text-slate-700 text-xs rounded-lg font-black">معطل</span>
                                            )}

                                            {(landmark.location_latitude || landmark.location_longitude) && (
                                                <span className="text-xs text-slate-500 font-bold">GPS متوفر</span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <Link
                                                href={route('admin.landmarks.edit', landmark.id)}
                                                className="px-3 py-2.5 bg-amber-500 text-white text-sm rounded-xl hover:bg-amber-600 transition text-center font-black"
                                            >
                                                تعديل
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    if (confirm('هل تريد حذف هذا المعلم؟')) {
                                                        router.delete(route('admin.landmarks.destroy', landmark.id));
                                                    }
                                                }}
                                                className="px-3 py-2.5 bg-rose-500 text-white text-sm rounded-xl hover:bg-rose-600 transition font-black"
                                            >
                                                حذف
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                        <p className="text-slate-500 font-black text-lg">لا توجد معالم مطابقة للفلاتر الحالية.</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
