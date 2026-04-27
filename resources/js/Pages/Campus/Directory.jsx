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
    const groupedBuildings = useMemo(() => {
        const map = new Map();

        filteredColleges.forEach((college) => {
            const symbol = (college.building_symbol || 'غير محدد').trim() || 'غير محدد';
            const key = `${symbol}::${college.building_location || 'غير محدد'}`;

            if (!map.has(key)) {
                map.set(key, {
                    symbol,
                    location: college.building_location || 'غير محدد',
                    colleges: [],
                });
            }

            map.get(key).colleges.push(college);
        });

        return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol, 'ar'));
    }, [filteredColleges]);

    const buildingLegend = useMemo(() => {
        const map = new Map();

        colleges.forEach((college) => {
            const symbol = (college.building_symbol || '').trim();
            if (!symbol) return;

            if (!map.has(symbol)) {
                map.set(symbol, {
                    symbol,
                    location: college.building_location || 'غير محدد',
                    colleges: [],
                });
            }

            map.get(symbol).colleges.push(college.name);
        });

        return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol, 'ar'));
    }, [colleges]);

    const directoryStats = [
        { label: 'الكليات', value: colleges.length, hint: 'المتاحة في الدليل' },
        { label: 'المباني', value: buildingLegend.length, hint: 'رموز معرّفة' },
        { label: 'المعالم', value: landmarks.length, hint: 'الخدمات والمواقع' },
    ];

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

            <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_22%),linear-gradient(180deg,#f8fbff_0%,#ffffff_48%,#f4f7fb_100%)] py-8 sm:py-10" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
                    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
                        <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl" />

                        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] p-6 sm:p-8 lg:p-10">
                            <div className="space-y-5 text-right">
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-600">
                                    <span>🏛️</span>
                                    <span>دليل مباني الجامعة</span>
                                </div>

                                <div className="space-y-3">
                                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-950">
                                        دليل واضح وسريع للمباني والكليات
                                    </h1>
                                    <p className="max-w-2xl text-sm sm:text-base leading-7 text-slate-600 font-medium">
                                        ابحث عن الكلية أو المعلم مباشرة، وشوف الموقع المناسب بدون تشتيت أو تفاصيل زائدة.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {directoryStats.map((stat) => (
                                        <div
                                            key={stat.label}
                                            className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-4 shadow-sm"
                                        >
                                            <p className="text-xs font-black text-slate-500">{stat.label}</p>
                                            <p className="mt-2 text-2xl font-black text-slate-950">{stat.value}</p>
                                            <p className="mt-1 text-xs font-medium text-slate-500">{stat.hint}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 sm:p-6 text-white shadow-xl shadow-slate-900/10">
                                <div className="space-y-4">
                                    <p className="text-xs font-black tracking-[0.25em] text-sky-200 uppercase">Quick View</p>
                                    <div className="space-y-2">
                                        <p className="text-lg font-black">ترتيب أبسط</p>
                                        <p className="text-sm leading-7 text-slate-300">
                                            كل شيء صار مقسوم بوضوح: كليات حسب المبنى، ومعالم حسب النوع، مع بحث سريع وفلاتر مباشرة.
                                        </p>
                                    </div>

                                    <div className="grid gap-3 pt-1">
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <p className="text-[11px] font-black text-slate-400">نتائج الكليات الحالية</p>
                                            <p className="mt-1 text-2xl font-black">{filteredColleges.length}</p>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <p className="text-[11px] font-black text-slate-400">نتائج المعالم الحالية</p>
                                            <p className="mt-1 text-2xl font-black">{filteredLandmarks.length}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {buildingLegend.length > 0 && (
                        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-7 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl space-y-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="space-y-1">
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-950">رموز المباني</h2>
                                    <p className="text-sm text-slate-500 font-medium">عرض مختصر يربط الرمز بالموقع فقط.</p>
                                </div>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
                                    {buildingLegend.length} رمز
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {buildingLegend.map((entry) => (
                                    <article
                                        key={entry.symbol}
                                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-slate-950 to-slate-700 text-white flex items-center justify-center text-xl font-black shadow-sm">
                                                {entry.symbol}
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="text-sm font-black text-slate-900 truncate">{entry.location}</p>
                                                <p className="text-xs text-slate-500 font-medium">{entry.colleges.length} كلية مرتبطة</p>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-7 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl space-y-5">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="space-y-1">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-950">الكليات حسب المبنى</h2>
                                <p className="text-sm text-slate-500 font-medium">بحث مباشر مع تجميع واضح ومختصر.</p>
                            </div>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
                                {filteredColleges.length} نتيجة
                            </span>
                        </div>

                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
                            <div className="relative">
                                <span className="absolute inset-y-0 right-4 flex items-center text-lg opacity-60">🔍</span>
                                <input
                                    type="text"
                                    value={collegeSearch}
                                    onChange={(e) => setCollegeSearch(e.target.value)}
                                    placeholder="ابحث عن كلية أو موقع"
                                    className="w-full rounded-2xl border border-transparent bg-white py-3.5 pr-11 pl-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                                />
                            </div>

                            {groupedBuildings.length > 0 ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {groupedBuildings.map((group) => (
                                        <article
                                            key={`${group.symbol}-${group.location}`}
                                            className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                        >
                                            <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500" />
                                            <div className="p-5 sm:p-6 space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="min-w-[56px] h-[56px] rounded-2xl bg-slate-950 text-white flex items-center justify-center text-xl font-black shadow-sm">
                                                        {group.symbol}
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        <h3 className="text-lg font-black text-slate-950">{group.location}</h3>
                                                        <p className="text-sm text-slate-500 font-medium">{group.colleges.length} كلية داخل هذا المبنى</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {group.colleges.map((college) => {
                                                        const isMyCollege = myCollegeId === college.id;

                                                        return (
                                                            <span
                                                                key={college.id}
                                                                className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold ${
                                                                    isMyCollege
                                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                                        : 'border-slate-200 bg-slate-50 text-slate-700'
                                                                }`}
                                                            >
                                                                {isMyCollege ? '🌟 ' : ''}
                                                                {college.name}
                                                            </span>
                                                        );
                                                    })}
                                                </div>

                                                {group.colleges.some((college) => college.maps_url) && (
                                                    <a
                                                        href={group.colleges.find((college) => college.maps_url)?.maps_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                                                    >
                                                        🗺️ فتح على الخريطة
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                                    <p className="text-slate-500 font-medium">لا توجد كليات مطابقة للبحث.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-7 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl space-y-5">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="space-y-1">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-950">معالم الجامعة</h2>
                                <p className="text-sm text-slate-500 font-medium">فلترة سريعة على حسب النوع.</p>
                            </div>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600">
                                {filteredLandmarks.length} نتيجة
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                            <div className="relative">
                                <span className="absolute inset-y-0 right-4 flex items-center text-lg opacity-60">🔎</span>
                                <input
                                    type="text"
                                    value={landmarkSearch}
                                    onChange={(e) => setLandmarkSearch(e.target.value)}
                                    placeholder="ابحث عن معلم أو موقع"
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-11 pl-4 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                                />
                            </div>

                            <select
                                value={landmarkType}
                                onChange={(e) => setLandmarkType(e.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 lg:min-w-[220px]"
                            >
                                {Object.entries(LANDMARK_TYPES).map(([key, value]) => (
                                    <option key={key} value={key}>
                                        {value.icon} {value.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {filteredLandmarks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredLandmarks.map((landmark) => {
                                    const typeInfo = LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other;

                                    return (
                                        <article
                                            key={landmark.id}
                                            className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                        >
                                            <div className="relative h-40 bg-slate-950">
                                                {landmark.image_url ? (
                                                    <img
                                                        src={landmark.image_url}
                                                        alt={landmark.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-5xl text-white/90">
                                                        {typeInfo.icon}
                                                    </div>
                                                )}

                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                                                <div className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-xs font-black text-white backdrop-blur">
                                                    {typeInfo.icon} {typeInfo.label}
                                                </div>
                                            </div>

                                            <div className="p-5 space-y-3">
                                                <h3 className="text-lg font-black text-slate-950">{landmark.name}</h3>

                                                {landmark.description && (
                                                    <p className="text-sm leading-7 text-slate-600 line-clamp-2">
                                                        {landmark.description}
                                                    </p>
                                                )}

                                                {landmark.building_location && (
                                                    <p className="text-sm font-medium text-slate-700">📍 {landmark.building_location}</p>
                                                )}

                                                {landmark.maps_url && (
                                                    <a
                                                        href={landmark.maps_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-500"
                                                    >
                                                        🗺️ فتح على الخريطة
                                                    </a>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                                <p className="text-slate-500 font-medium">لا يوجد معالم مطابقة للفلاتر الحالية.</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
