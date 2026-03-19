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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with title and add button */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">المعالم بالجامعة</h1>
                    <Link
                        href={route('admin.landmarks.create')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        + إضافة معلم
                    </Link>
                </div>

                {/* Search and filter bar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <input
                        type="text"
                        placeholder="ابحث بالاسم أو الموقع..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">جميع التصنيفات</option>
                        {Object.entries(LANDMARK_TYPES).map(([key, { name }]) => (
                            <option key={key} value={key}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Landmarks grid */}
                {filteredLandmarks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredLandmarks.map((landmark) => {
                            const typeInfo = LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other;
                            return (
                                <div
                                    key={landmark.id}
                                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
                                >
                                    {/* Landmark image or type icon */}
                                    <div className={`w-full h-32 flex items-center justify-center ${typeInfo.color} text-5xl`}>
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

                                    {/* Landmark details */}
                                    <div className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900 flex-1">
                                                {landmark.name}
                                            </h3>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                                                {typeInfo.name}
                                            </span>
                                        </div>

                                        <div className="text-sm text-gray-600 space-y-2 mb-3">
                                            {landmark.building_location && (
                                                <p>
                                                    <span className="font-medium">📍 الموقع:</span>{' '}
                                                    {landmark.building_location}
                                                </p>
                                            )}
                                        </div>

                                        {landmark.description && (
                                            <p className="text-sm text-gray-700 mb-3 line-clamp-2">
                                                {landmark.description}
                                            </p>
                                        )}

                                        {/* Coordinates preview */}
                                        {landmark.location_latitude && (
                                            <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded">
                                                📍 {landmark.location_latitude}, {landmark.location_longitude}
                                            </div>
                                        )}

                                        {/* Status badge */}
                                        <div className="mb-3">
                                            {landmark.is_active ? (
                                                <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                    ✓ نشط
                                                </span>
                                            ) : (
                                                <span className="inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                                    معطل
                                                </span>
                                            )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-2">
                                            <Link
                                                href={route('admin.landmarks.edit', landmark.id)}
                                                className="flex-1 px-3 py-2 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition text-center"
                                            >
                                                تعديل
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    if (confirm('هل تريد حذف هذا المعلم؟')) {
                                                        router.delete(route('admin.landmarks.destroy', landmark.id));
                                                    }
                                                }}
                                                className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition"
                                            >
                                                حذف
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">لا توجد معالم</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
