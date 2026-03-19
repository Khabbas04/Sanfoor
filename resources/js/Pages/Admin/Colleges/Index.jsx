import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';

export default function CollegesIndex({ colleges }) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredColleges = colleges.filter(college =>
        college.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        college.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header with title and add button */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">الكليات</h1>
                    <Link
                        href={route('admin.colleges.create')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        + إضافة كلية
                    </Link>
                </div>

                {/* Search bar */}
                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="ابحث عن كلية..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Colleges grid */}
                {filteredColleges.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredColleges.map((college) => (
                            <div
                                key={college.id}
                                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
                            >
                                {/* College image */}
                                {college.image_url && (
                                    <img
                                        src={college.image_url}
                                        alt={college.name}
                                        className="w-full h-48 object-cover"
                                    />
                                )}

                                {/* College details */}
                                <div className="p-4">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                        {college.name}
                                    </h3>

                                    <div className="text-sm text-gray-600 space-y-2 mb-4">
                                        {college.university?.name && (
                                            <p>
                                                <span className="font-medium">الجامعة:</span>{' '}
                                                {college.university.name}
                                            </p>
                                        )}
                                        {college.building_symbol && (
                                            <p>
                                                <span className="font-medium">الرمز:</span>{' '}
                                                {college.building_symbol}
                                            </p>
                                        )}
                                        {college.building_location && (
                                            <p>
                                                <span className="font-medium">الموقع:</span>{' '}
                                                {college.building_location}
                                            </p>
                                        )}
                                    </div>

                                    {college.description && (
                                        <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                                            {college.description}
                                        </p>
                                    )}

                                    {/* Services tags */}
                                    {college.services && college.services.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {college.services.slice(0, 3).map((service, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                                                >
                                                    {service}
                                                </span>
                                            ))}
                                            {college.services.length > 3 && (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                                                    +{college.services.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex gap-2">
                                        <Link
                                            href={route('admin.colleges.edit', college.id)}
                                            className="flex-1 px-3 py-2 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition text-center"
                                        >
                                            تعديل
                                        </Link>
                                        <button
                                            onClick={() => {
                                                if (confirm('هل تريد حذف هذه الكلية؟')) {
                                                    window.location.href = route(
                                                        'admin.colleges.destroy',
                                                        college.id
                                                    );
                                                }
                                            }}
                                            className="flex-1 px-3 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition"
                                        >
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">لا توجد كليات</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
