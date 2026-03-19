import React from 'react';
import { useForm, Link } from '@inertiajs/react';
import AdminLayout from '../../../Layouts/AdminLayout';

const LANDMARK_TYPES = {
    restaurant: 'مطعم',
    prayer_room: 'مصلى',
    library: 'مكتبة',
    clinic: 'عيادة',
    parking: 'موقف سيارات',
    sports: 'رياضة',
    shop: 'محل',
    other: 'أخرى',
};

export default function LandmarkForm({ landmark }) {
    const isEditing = !!landmark;
    const { data, setData, post, put, processing, errors } = useForm({
        name: landmark?.name ?? '',
        description: landmark?.description ?? '',
        type: landmark?.type ?? '',
        building_location: landmark?.building_location ?? '',
        location_latitude: landmark?.location_latitude ?? '',
        location_longitude: landmark?.location_longitude ?? '',
        maps_url: landmark?.maps_url ?? '',
        image_url: landmark?.image_url ?? '',
        is_active: landmark?.is_active ?? true,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isEditing) {
            put(route('admin.landmarks.update', landmark.id));
        } else {
            post(route('admin.landmarks.store_new'));
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow-md p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">
                        {isEditing ? 'تعديل المعلم' : 'إضافة معلم جديد'}
                    </h1>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Landmark name - required */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                اسم المعلم *
                            </label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="مثال: مطعم القصر، مصلى العمارة أ"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.name && (
                                <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                            )}
                        </div>

                        {/* Type - required */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                التصنيف *
                            </label>
                            <select
                                value={data.type}
                                onChange={(e) => setData('type', e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">اختر التصنيف</option>
                                {Object.entries(LANDMARK_TYPES).map(([key, name]) => (
                                    <option key={key} value={key}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                            {errors.type && (
                                <p className="text-red-600 text-sm mt-1">{errors.type}</p>
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
                                placeholder="مثال: العمارة أ - الطابق الأول"
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
                                placeholder="أضف معلومات عن المعلم (ساعات العمل، الخدمات المقدمة، الخ)"
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            {errors.description && (
                                <p className="text-red-600 text-sm mt-1">{errors.description}</p>
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

                        {/* Active status */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={data.is_active}
                                onChange={(e) => setData('is_active', e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <label htmlFor="is_active" className="ml-2">
                                هذا المعلم نشط (يظهر للطلاب)
                            </label>
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
                                href={route('admin.landmarks.index')}
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
