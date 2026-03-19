import React, { useMemo, useState } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head } from '@inertiajs/react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const LANDMARK_TYPES = {
    all: { label: 'الكل', icon: '🧭' },
    restaurant: { label: 'مطاعم', icon: '🍽️' },
    prayer_room: { label: 'مصليات', icon: '🕌' },
    library: { label: 'مكتبات', icon: '📚' },
    clinic: { label: 'عيادات', icon: '🏥' },
    parking: { label: 'مواقف', icon: '🅿️' },
    sports: { label: 'رياضة', icon: '⚽' },
    shop: { label: 'محلات', icon: '🏪' },
    other: { label: 'أخرى', icon: '📍' },
};

export default function Directory({ auth, colleges = [], landmarks = [] }) {
    const [collegeSearch, setCollegeSearch] = useState('');
    const [landmarkSearch, setLandmarkSearch] = useState('');
    const [landmarkType, setLandmarkType] = useState('all');

    const filteredColleges = useMemo(() => {
        const search = collegeSearch.toLowerCase().trim();

        return colleges.filter((college) => {
            if (!search) return true;

            return (
                college.name.toLowerCase().includes(search) ||
                college.description?.toLowerCase().includes(search) ||
                college.building_location?.toLowerCase().includes(search) ||
                college.building_symbol?.toLowerCase().includes(search)
            );
        });
    }, [colleges, collegeSearch]);

    const filteredLandmarks = useMemo(() => {
        const search = landmarkSearch.toLowerCase().trim();

        return landmarks.filter((landmark) => {
            const matchesType = landmarkType === 'all' || landmark.type === landmarkType;
            if (!matchesType) return false;
            if (!search) return true;

            return (
                landmark.name.toLowerCase().includes(search) ||
                landmark.description?.toLowerCase().includes(search) ||
                landmark.building_location?.toLowerCase().includes(search)
            );
        });
    }, [landmarks, landmarkSearch, landmarkType]);

    const myCollegeId = auth?.user?.major?.college_id;

    return (
        <MainLayout user={auth?.user}>
            <Head>
                <title>دليل المباني والكليات | سنفور</title>
                <meta
                    name="description"
                    content="دليل مبسط للكليات ومعالم الجامعة مع مواقعها وخدماتها وروابط الخرائط."
                />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/campus-directory`} />
            </Head>

            <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 py-8" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                        <div className="absolute -top-24 -left-10 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />
                        <div className="absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-indigo-200/40 blur-3xl" />

                        <div className="relative z-10 p-8 sm:p-10 lg:p-12 text-center space-y-5">
                            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl border border-indigo-100">
                                🏛️
                            </span>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900">
                                دليل المباني والكليات
                            </h1>
                            <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 font-bold leading-relaxed">
                                كل كلية ومعلم جامعي صاروا في مكان واحد: ابحث بسرعة، اعرف المكان، وافتح الموقع على الخريطة مباشرة.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto pt-2">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500 font-black">عدد الكليات</p>
                                    <p className="text-2xl text-slate-900 font-black mt-1">{colleges.length}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500 font-black">عدد المعالم</p>
                                    <p className="text-2xl text-slate-900 font-black mt-1">{landmarks.length}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs text-slate-500 font-black">نتائج الكليات</p>
                                    <p className="text-2xl text-slate-900 font-black mt-1">{filteredColleges.length}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900">الكليات</h2>
                            <span className="text-xs font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                                عرض بطاقات مباشرة بدون تبويبات
                            </span>
                        </div>

                        <div className="relative">
                            <span className="absolute inset-y-0 right-4 flex items-center text-lg opacity-60">🔍</span>
                            <input
                                type="text"
                                value={collegeSearch}
                                onChange={(e) => setCollegeSearch(e.target.value)}
                                placeholder="ابحث عن كلية بالاسم أو الموقع أو الوصف"
                                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pr-11 pl-4 text-sm font-bold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                            />
                        </div>

                        {filteredColleges.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {filteredColleges.map((college) => {
                                    const isMyCollege = myCollegeId === college.id;

                                    return (
                                        <article
                                            key={college.id}
                                            className={`rounded-3xl border bg-white overflow-hidden shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                                                isMyCollege ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'
                                            }`}
                                        >
                                            <div className={`h-2 ${isMyCollege ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-gradient-to-r from-indigo-500 to-cyan-500'}`} />

                                            <div className="p-5 space-y-4">
                                                {college.image_url ? (
                                                    <img
                                                        src={college.image_url}
                                                        alt={college.name}
                                                        className="w-full h-44 rounded-2xl border border-slate-200 object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-44 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 font-black">
                                                        لا توجد صورة
                                                    </div>
                                                )}

                                                <div className="flex items-start justify-between gap-3">
                                                    <h3 className="text-xl font-black text-slate-900 leading-tight">{college.name}</h3>
                                                    {college.building_symbol && (
                                                        <span className="text-xs font-black px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50">
                                                            {college.building_symbol}
                                                        </span>
                                                    )}
                                                </div>

                                                {isMyCollege && (
                                                    <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                        🌟 كليتك الحالية
                                                    </span>
                                                )}

                                                <div className="space-y-2 text-sm text-slate-700 font-bold">
                                                    {college.building_location && <p>📍 {college.building_location}</p>}
                                                    {(college.location_latitude || college.location_longitude) && (
                                                        <p className="text-xs text-slate-500">
                                                            {college.location_latitude && `العرض: ${college.location_latitude}`}
                                                            {college.location_latitude && college.location_longitude ? ' | ' : ''}
                                                            {college.location_longitude && `الطول: ${college.location_longitude}`}
                                                        </p>
                                                    )}
                                                </div>

                                                {college.description && (
                                                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">
                                                        {college.description}
                                                    </p>
                                                )}

                                                {Array.isArray(college.services) && college.services.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {college.services.map((service, index) => (
                                                            <span
                                                                key={index}
                                                                className="px-2.5 py-1.5 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 text-xs font-black"
                                                            >
                                                                {service}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                                {college.maps_url && (
                                                    <a
                                                        href={college.maps_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm font-black text-indigo-700 hover:underline"
                                                    >
                                                        🗺️ فتح موقع الكلية على الخريطة
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center bg-slate-50">
                                <p className="text-slate-500 font-black">لا توجد كليات مطابقة للبحث.</p>
                            </div>
                        )}
                    </section>

                    <section className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900">معالم الجامعة</h2>
                            <span className="text-xs font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                                {filteredLandmarks.length} معلم
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <div className="lg:col-span-2 relative">
                                <span className="absolute inset-y-0 right-4 flex items-center text-lg opacity-60">🔎</span>
                                <input
                                    type="text"
                                    value={landmarkSearch}
                                    onChange={(e) => setLandmarkSearch(e.target.value)}
                                    placeholder="ابحث عن معلم: مطعم، مصلى، مكتبة..."
                                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pr-11 pl-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                />
                            </div>

                            <select
                                value={landmarkType}
                                onChange={(e) => setLandmarkType(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 px-4 text-sm font-bold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            >
                                {Object.entries(LANDMARK_TYPES).map(([key, value]) => (
                                    <option key={key} value={key}>
                                        {value.icon} {value.label}
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
                                            className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                                        >
                                            {landmark.image_url ? (
                                                <img
                                                    src={landmark.image_url}
                                                    alt={landmark.name}
                                                    className="w-full h-36 object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-36 bg-slate-50 border-b border-slate-200 flex items-center justify-center text-4xl">
                                                    {typeInfo.icon}
                                                </div>
                                            )}

                                            <div className="p-5 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h3 className="text-lg font-black text-slate-900">{landmark.name}</h3>
                                                    <span className="text-xs font-black px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                                                        {typeInfo.icon} {typeInfo.label}
                                                    </span>
                                                </div>

                                                {landmark.description && (
                                                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                                                        {landmark.description}
                                                    </p>
                                                )}

                                                {landmark.building_location && (
                                                    <p className="text-sm text-slate-700 font-bold">📍 {landmark.building_location}</p>
                                                )}

                                                {(landmark.location_latitude || landmark.location_longitude) && (
                                                    <p className="text-xs text-slate-500 font-bold">
                                                        {landmark.location_latitude && `العرض: ${landmark.location_latitude}`}
                                                        {landmark.location_latitude && landmark.location_longitude ? ' | ' : ''}
                                                        {landmark.location_longitude && `الطول: ${landmark.location_longitude}`}
                                                    </p>
                                                )}

                                                {landmark.maps_url && (
                                                    <a
                                                        href={landmark.maps_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm font-black text-emerald-700 hover:underline"
                                                    >
                                                        🗺️ فتح المعلم على الخريطة
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center bg-slate-50">
                                <p className="text-slate-500 font-black">لا يوجد معالم مطابقة للفلاتر الحالية.</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
