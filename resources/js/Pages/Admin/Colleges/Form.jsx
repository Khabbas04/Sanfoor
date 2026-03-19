import React, { useState } from 'react';
import { useForm, Link } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';

export default function CollegeForm({ college }) {
    const isEditing = !!college;
    const { data, setData, post, put, processing, errors } = useForm({
        name: college?.name ?? '',
        description: college?.description ?? '',
        building_symbol: college?.building_symbol ?? '',
        building_location: college?.building_location ?? '',
        services: college?.services ?? [],
        image_url: college?.image_url ?? '',
        location_latitude: college?.location_latitude ?? '',
        location_longitude: college?.location_longitude ?? '',
        maps_url: college?.maps_url ?? '',
    });

    const [newService, setNewService] = useState('');

    const handleAddService = () => {
        if (newService.trim()) {
            setData('services', [...data.services, newService.trim()]);
            setNewService('');
        }
    };

    const handleRemoveService = (index) => {
        setData('services', data.services.filter((_, i) => i !== index));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            put(route('admin.colleges.update', college.id));
        } else {
            post(route('admin.colleges.store_new'));
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow-md p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">
                        {isEditing ? 'تعديل الكلية' : 'إضافة كلية جديدة'}
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* College name - required */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                اسم الكلية *
                            </label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="مثال: كلية الهندسة"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.name && (
                                <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                            )}
                        </div>

                        {/* Building symbol */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                رمز المبنى
                            </label>
                            <input
                                type="text"
                                value={data.building_symbol}
                                onChange={(e) => setData('building_symbol', e.target.value)}
                                placeholder="مثال: أ"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.building_symbol && (
                                <p className="text-red-600 text-sm mt-1">{errors.building_symbol}</p>
                            )}
                        </div>

                        {/* Building location */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                موقع المبنى
                            </label>
                            <input
                                type="text"
                                value={data.building_location}
                                onChange={(e) => setData('building_location', e.target.value)}
                                placeholder="مثال: الحرم الشرقي - الطابق الثاني"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.building_location && (
                                <p className="text-red-600 text-sm mt-1">{errors.building_location}</p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                الوصف
                            </label>
                            <textarea
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="أضف وصفاً عن الكلية وتخصصاتها..."
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.description && (
                                <p className="text-red-600 text-sm mt-1">{errors.description}</p>
                            )}
                        </div>

                        {/* Services */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                الخدمات
                            </label>
                            <div className="space-y-3">
                                {/* Service input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newService}
                                        onChange={(e) => setNewService(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddService();
                                            }
                                        }}
                                        placeholder="أضف خدمة (مثال: مقهى، مكتبة، صالة رياضة)"
                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddService}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                    >
                                        إضافة
                                    </button>
                                </div>

                                {/* Services list */}
                                {data.services.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {data.services.map((service, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                            >
                                                <span>{service}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveService(index)}
                                                    className="text-blue-600 hover:text-blue-900 font-bold"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {errors.services && (
                                <p className="text-red-600 text-sm mt-1">{errors.services}</p>
                            )}
                        </div>

                        {/* Image URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                رابط الصورة
                            </label>
                            <input
                                type="url"
                                value={data.image_url}
                                onChange={(e) => setData('image_url', e.target.value)}
                                placeholder="https://..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.image_url && (
                                <p className="text-red-600 text-sm mt-1">{errors.image_url}</p>
                            )}
                        </div>

                        {/* Coordinates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    خط العرض (Latitude)
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={data.location_latitude}
                                    onChange={(e) => setData('location_latitude', e.target.value)}
                                    placeholder="35.1264"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {errors.location_latitude && (
                                    <p className="text-red-600 text-sm mt-1">{errors.location_latitude}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    خط الطول (Longitude)
                                </label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={data.location_longitude}
                                    onChange={(e) => setData('location_longitude', e.target.value)}
                                    placeholder="36.2384"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {errors.location_longitude && (
                                    <p className="text-red-600 text-sm mt-1">{errors.location_longitude}</p>
                                )}
                            </div>
                        </div>

                        {/* Maps URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                رابط Google Maps
                            </label>
                            <input
                                type="url"
                                value={data.maps_url}
                                onChange={(e) => setData('maps_url', e.target.value)}
                                placeholder="https://maps.google.com/..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.maps_url && (
                                <p className="text-red-600 text-sm mt-1">{errors.maps_url}</p>
                            )}
                        </div>

                        {/* Form actions */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                            >
                                {processing ? 'جاري الحفظ...' : isEditing ? 'تحديث' : 'إضافة'}
                            </button>
                            <Link
                                href={route('admin.colleges.index')}
                                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition text-center"
                            >
                                إلغاء
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
